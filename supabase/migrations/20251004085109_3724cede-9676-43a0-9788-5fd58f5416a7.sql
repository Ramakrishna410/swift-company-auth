-- Add employee_id and email to profiles table
ALTER TABLE public.profiles
ADD COLUMN employee_id TEXT UNIQUE,
ADD COLUMN email TEXT;

-- Create function to generate employee_id
CREATE OR REPLACE FUNCTION public.generate_employee_id(p_company_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name TEXT;
  v_initials TEXT;
  v_count INTEGER;
  v_employee_id TEXT;
BEGIN
  -- Get company name
  SELECT name INTO v_company_name
  FROM companies
  WHERE id = p_company_id;
  
  -- Extract initials (first 4 letters, uppercase)
  v_initials := UPPER(SUBSTRING(REGEXP_REPLACE(v_company_name, '[^a-zA-Z]', '', 'g'), 1, 4));
  
  -- Count existing employees in this company
  SELECT COUNT(*) INTO v_count
  FROM profiles
  WHERE company_id = p_company_id;
  
  -- Generate employee_id: EMP-{initials}-{4digit_number}
  v_employee_id := 'EMP-' || v_initials || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
  
  RETURN v_employee_id;
END;
$$;

-- Update existing profiles to have employee_ids
DO $$
DECLARE
  profile_record RECORD;
  new_emp_id TEXT;
BEGIN
  FOR profile_record IN 
    SELECT id, company_id FROM profiles WHERE employee_id IS NULL
  LOOP
    new_emp_id := public.generate_employee_id(profile_record.company_id);
    UPDATE profiles 
    SET employee_id = new_emp_id 
    WHERE id = profile_record.id;
  END LOOP;
END $$;