-- Fix infinite recursion in profiles RLS by creating security definer function
-- This function allows querying user's company_id without triggering RLS recursion

-- Create function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Users can view company profiles" ON public.profiles;

-- Create new policy using the security definer function
CREATE POLICY "Users can view company profiles" 
ON public.profiles
FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
);