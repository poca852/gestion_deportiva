DROP POLICY IF EXISTS alumnos_convocatoria_select ON public.alumnos_convocatoria;
DROP POLICY IF EXISTS alumnos_convocatoria_insert ON public.alumnos_convocatoria;
DROP POLICY IF EXISTS alumnos_convocatoria_delete ON public.alumnos_convocatoria;

CREATE POLICY alumnos_convocatoria_select ON public.alumnos_convocatoria FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_rol() = 'admin' OR c.categoria = public.get_user_categoria())));
CREATE POLICY alumnos_convocatoria_insert ON public.alumnos_convocatoria FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_rol() = 'admin' OR (c.categoria = public.get_user_categoria() AND c.creado_por = auth.uid()))));
CREATE POLICY alumnos_convocatoria_delete ON public.alumnos_convocatoria FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_rol() = 'admin' OR (c.categoria = public.get_user_categoria() AND c.creado_por = auth.uid()))));

DROP POLICY IF EXISTS storage_expedientes_select ON storage.objects;
DROP POLICY IF EXISTS storage_expedientes_insert ON storage.objects;
DROP POLICY IF EXISTS storage_expedientes_update ON storage.objects;
DROP POLICY IF EXISTS storage_expedientes_delete ON storage.objects;

CREATE POLICY storage_expedientes_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'expedientes-academia');
CREATE POLICY storage_expedientes_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expedientes-academia');
CREATE POLICY storage_expedientes_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'expedientes-academia') WITH CHECK (bucket_id = 'expedientes-academia');
CREATE POLICY storage_expedientes_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'expedientes-academia');
