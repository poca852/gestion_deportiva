DROP POLICY IF EXISTS entrenadores_select_authenticated ON public.entrenadores;
DROP POLICY IF EXISTS entrenadores_insert_admin ON public.entrenadores;
DROP POLICY IF EXISTS entrenadores_update_admin ON public.entrenadores;
DROP POLICY IF EXISTS entrenadores_delete_admin ON public.entrenadores;
DROP POLICY IF EXISTS entrenadores_self_insert ON public.entrenadores;
DROP POLICY IF EXISTS entrenadores_self_update ON public.entrenadores;

CREATE POLICY entrenadores_select_authenticated ON public.entrenadores FOR SELECT TO authenticated USING (true);
CREATE POLICY entrenadores_insert_admin ON public.entrenadores FOR INSERT TO authenticated WITH CHECK (public.get_user_rol() = 'admin');
CREATE POLICY entrenadores_update_admin ON public.entrenadores FOR UPDATE TO authenticated USING (public.get_user_rol() = 'admin') WITH CHECK (public.get_user_rol() = 'admin');
CREATE POLICY entrenadores_delete_admin ON public.entrenadores FOR DELETE TO authenticated USING (public.get_user_rol() = 'admin');
CREATE POLICY entrenadores_self_insert ON public.entrenadores FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY entrenadores_self_update ON public.entrenadores FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
