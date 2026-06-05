-- Drop policies and function
DROP POLICY IF EXISTS "super_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_update" ON public.profiles;

DROP FUNCTION IF EXISTS public.is_super_admin();

-- Create function as VOLATILE without SET commands
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth
VOLATILE
AS $$
  SELECT COALESCE(is_super_admin, false)
  FROM auth.users
  WHERE id = auth.uid();
$$;

-- Recreate policies
CREATE POLICY "super_admin_insert" ON public.profiles
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admin_select" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR public.is_super_admin()
);

CREATE POLICY "super_admin_update" ON public.profiles
FOR UPDATE USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());
