-- Function to securely set or change a user's role
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the user themselves or an admin to set the role
  IF auth.uid() = _user_id OR has_role(auth.uid(), 'admin') THEN
    -- Remove any existing roles for this user to avoid duplicates
    DELETE FROM public.user_roles WHERE user_id = _user_id;

    -- Insert the desired role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
  ELSE
    RAISE EXCEPTION 'Not authorized to set role';
  END IF;
END;
$$;