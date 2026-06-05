DROP POLICY IF EXISTS alumnos_select_by_role ON public.alumnos;
DROP POLICY IF EXISTS alumnos_insert_by_role ON public.alumnos;
DROP POLICY IF EXISTS alumnos_update_by_role ON public.alumnos;
DROP POLICY IF EXISTS alumnos_delete_by_role ON public.alumnos;

CREATE POLICY alumnos_select_by_role ON public.alumnos FOR SELECT TO authenticated USING (public.get_user_rol() = 'admin' OR categoria = public.get_user_categoria());
CREATE POLICY alumnos_insert_by_role ON public.alumnos FOR INSERT TO authenticated WITH CHECK (public.get_user_rol() = 'admin' OR categoria = public.get_user_categoria());
CREATE POLICY alumnos_update_by_role ON public.alumnos FOR UPDATE TO authenticated USING (public.get_user_rol() = 'admin' OR categoria = public.get_user_categoria()) WITH CHECK (public.get_user_rol() = 'admin' OR categoria = public.get_user_categoria());
CREATE POLICY alumnos_delete_by_role ON public.alumnos FOR DELETE TO authenticated USING (public.get_user_rol() = 'admin' OR categoria = public.get_user_categoria());

DROP POLICY IF EXISTS convocatorias_select_by_role ON public.convocatorias;
DROP POLICY IF EXISTS convocatorias_insert_by_role ON public.convocatorias;
DROP POLICY IF EXISTS convocatorias_update_by_role ON public.convocatorias;
DROP POLICY IF EXISTS convocatorias_delete_by_role ON public.convocatorias;

CREATE POLICY convocatorias_select_by_role ON public.convocatorias FOR SELECT TO authenticated USING (public.get_user_rol() = 'admin' OR categoria = public.get_user_categoria());
CREATE POLICY convocatorias_insert_by_role ON public.convocatorias FOR INSERT TO authenticated WITH CHECK (public.get_user_rol() = 'admin' OR (categoria = public.get_user_categoria() AND creado_por = auth.uid()));
CREATE POLICY convocatorias_update_by_role ON public.convocatorias FOR UPDATE TO authenticated USING (public.get_user_rol() = 'admin' OR (categoria = public.get_user_categoria() AND creado_por = auth.uid()));
CREATE POLICY convocatorias_delete_by_role ON public.convocatorias FOR DELETE TO authenticated USING (public.get_user_rol() = 'admin' OR (categoria = public.get_user_categoria() AND creado_por = auth.uid()));
