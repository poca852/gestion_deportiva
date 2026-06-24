-- Plantilla de carnet configurable por academia (imagen + layout JSON)

ALTER TABLE public.academias
  ADD COLUMN IF NOT EXISTS carnet_plantilla_url TEXT,
  ADD COLUMN IF NOT EXISTS carnet_layout JSONB,
  ADD COLUMN IF NOT EXISTS carnet_plantilla_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.academias.carnet_plantilla_url IS
  'Ruta en storage de la plantilla PNG/JPEG del carnet (horizontal, una cara).';
COMMENT ON COLUMN public.academias.carnet_layout IS
  'Posiciones de campos dinámicos (foto, nombre, QR, etc.) en coordenadas relativas 0-1.';
COMMENT ON COLUMN public.academias.carnet_plantilla_updated_at IS
  'Marca de tiempo del último cambio de plantilla; útil para invalidar caché.';

-- Storage: permitir carpeta plantillas-carnet (solo admin de academia o super_admin)
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
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia', 'plantillas-carnet')
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
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia', 'plantillas-carnet')
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
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia', 'plantillas-carnet')
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
