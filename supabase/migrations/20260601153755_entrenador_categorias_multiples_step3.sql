CREATE POLICY "entrenadores_self_update"
  ON public.entrenadores FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND rol = (SELECT e.rol FROM public.entrenadores e WHERE e.id = auth.uid())
    AND correo = (SELECT e.correo FROM public.entrenadores e WHERE e.id = auth.uid())
    AND categorias_asignadas IS NOT DISTINCT FROM (
      SELECT e.categorias_asignadas FROM public.entrenadores e WHERE e.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "alumnos_select_by_role" ON public.alumnos;
CREATE POLICY "alumnos_select_by_role" ON public.alumnos FOR SELECT TO authenticated
  USING (public.get_user_rol() = 'admin' OR public.user_has_categoria(categoria));

DROP POLICY IF EXISTS "alumnos_insert_by_role" ON public.alumnos;
CREATE POLICY "alumnos_insert_by_role" ON public.alumnos FOR INSERT TO authenticated
  WITH CHECK (public.get_user_rol() = 'admin' OR public.user_has_categoria(categoria));

DROP POLICY IF EXISTS "alumnos_update_by_role" ON public.alumnos;
CREATE POLICY "alumnos_update_by_role" ON public.alumnos FOR UPDATE TO authenticated
  USING (public.get_user_rol() = 'admin' OR public.user_has_categoria(categoria))
  WITH CHECK (public.get_user_rol() = 'admin' OR public.user_has_categoria(categoria));

DROP POLICY IF EXISTS "alumnos_delete_by_role" ON public.alumnos;
CREATE POLICY "alumnos_delete_by_role" ON public.alumnos FOR DELETE TO authenticated
  USING (public.get_user_rol() = 'admin' OR public.user_has_categoria(categoria));

DROP POLICY IF EXISTS "convocatorias_select_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_select_by_role" ON public.convocatorias FOR SELECT TO authenticated
  USING (public.get_user_rol() = 'admin' OR public.user_has_categoria(categoria));

DROP POLICY IF EXISTS "convocatorias_insert_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_insert_by_role" ON public.convocatorias FOR INSERT TO authenticated
  WITH CHECK (public.get_user_rol() = 'admin' OR (public.user_has_categoria(categoria) AND creado_por = auth.uid()));

DROP POLICY IF EXISTS "convocatorias_update_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_update_by_role" ON public.convocatorias FOR UPDATE TO authenticated
  USING (public.get_user_rol() = 'admin' OR (public.user_has_categoria(categoria) AND creado_por = auth.uid()));

DROP POLICY IF EXISTS "convocatorias_delete_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_delete_by_role" ON public.convocatorias FOR DELETE TO authenticated
  USING (public.get_user_rol() = 'admin' OR (public.user_has_categoria(categoria) AND creado_por = auth.uid()));

DROP POLICY IF EXISTS "alumnos_convocatoria_select" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_select" ON public.alumnos_convocatoria FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_rol() = 'admin' OR public.user_has_categoria(c.categoria))));

DROP POLICY IF EXISTS "alumnos_convocatoria_insert" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_insert" ON public.alumnos_convocatoria FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_rol() = 'admin' OR (public.user_has_categoria(c.categoria) AND c.creado_por = auth.uid()))));

DROP POLICY IF EXISTS "alumnos_convocatoria_delete" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_delete" ON public.alumnos_convocatoria FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_rol() = 'admin' OR (public.user_has_categoria(c.categoria) AND c.creado_por = auth.uid()))));

DROP FUNCTION IF EXISTS public.get_user_categoria();
