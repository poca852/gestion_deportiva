CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth
STABLE
AS $$
  SELECT COALESCE(is_super_admin, false)
  FROM auth.users
  WHERE id = auth.uid();
$$;
