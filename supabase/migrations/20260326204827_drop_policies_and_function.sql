-- Drop policies that depend on the function
DROP POLICY IF EXISTS "super_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_update" ON public.profiles;

-- Now drop the function
DROP FUNCTION IF EXISTS public.is_super_admin();
