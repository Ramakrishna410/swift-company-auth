-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to profiles table
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add manager_id to user_roles table
ALTER TABLE public.user_roles ADD COLUMN manager_id UUID REFERENCES auth.users(id);

-- Update profiles trigger to NOT automatically create profile (we'll do it in signup flow)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated timestamp trigger for companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies for companies
CREATE POLICY "Users can view own company"
  ON public.companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert company during signup"
  ON public.companies
  FOR INSERT
  WITH CHECK (true);

-- Update profiles RLS to consider company_id
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view company profiles"
  ON public.profiles
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Update user_roles RLS to consider company
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

CREATE POLICY "Users can view company roles"
  ON public.user_roles
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM public.profiles 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Allow admins to update roles within their company
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;

CREATE POLICY "Admins can update company roles"
  ON public.user_roles
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    user_id IN (
      SELECT id FROM public.profiles 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Allow admins to delete roles within their company
CREATE POLICY "Admins can delete company roles"
  ON public.user_roles
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    user_id IN (
      SELECT id FROM public.profiles 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Update expenses RLS to be company-scoped
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Managers can view team expenses" ON public.expenses;

CREATE POLICY "Admins can view company expenses"
  ON public.expenses
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    owner_id IN (
      SELECT id FROM public.profiles 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can view company expenses"
  ON public.expenses
  FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::app_role) AND
    owner_id IN (
      SELECT id FROM public.profiles 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );