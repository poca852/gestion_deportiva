-- Drop policies and function
DROP POLICY IF EXISTS "super_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_update" ON public.profiles;

DROP FUNCTION IF EXISTS public.is_super_admin();

-- Create function with RLS bypass using a subtransaction
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth
VOLATILE
AS $$
DECLARE
  result boolean;
BEGIN
  -- Use a subtransaction to set row_security
  BEGIN
    SET LOCAL row_security = off;
    SELECT COALESCE(is_super_admin, false) INTO result
    FROM auth.users
    WHERE id = auth.uid();
  EXCEPTION
    WHEN OTHERS THEN
      result := false;
  END;
  RETURN COALESCE(result, false);
END;
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
