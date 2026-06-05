-- Recreate policies using the is_super_admin() function
CREATE POLICY "super_admin_insert" ON public.profiles
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admin_select" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR public.is_super_admin()
);

CREATE POLICY "super_admin_update" ON public.profiles
FOR UPDATE USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());
