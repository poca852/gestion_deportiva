-- Elimina columnas y storage de plantilla PNG por academia (reemplazado por carnet estándar en código).

ALTER TABLE public.academias
  DROP COLUMN IF EXISTS carnet_plantilla_url,
  DROP COLUMN IF EXISTS carnet_layout,
  DROP COLUMN IF EXISTS carnet_plantilla_updated_at;

-- Quitar carpeta plantillas-carnet de las políticas de storage
DROP POLICY IF EXISTS "storage_expedientes_insert_authenticated" ON storage.objects;
CREATE POLICY "storage_expedientes_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR (
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia')
        AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin')
      )
      OR (
        (storage.foldername(name))[2] = 'firmas-convocatoria'
        AND (
          public.get_user_es_super_admin()
          OR public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid
              AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin')
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "storage_expedientes_update_authenticated" ON storage.objects;
CREATE POLICY "storage_expedientes_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
  )
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR (
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia')
        AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin')
      )
      OR (
        (storage.foldername(name))[2] = 'firmas-convocatoria'
        AND (
          public.get_user_es_super_admin()
          OR public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid
              AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin')
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "storage_expedientes_delete_authenticated" ON storage.objects;
CREATE POLICY "storage_expedientes_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR (
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia')
        AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin')
      )
      OR (
        (storage.foldername(name))[2] = 'firmas-convocatoria'
        AND (
          public.get_user_es_super_admin()
          OR public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid
              AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin')
          )
        )
      )
    )
  );
