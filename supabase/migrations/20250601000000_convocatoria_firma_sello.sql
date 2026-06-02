-- Sello del equipo, firma del entrenador y políticas de storage

ALTER TABLE public.academia_config
  ADD COLUMN IF NOT EXISTS sello_url TEXT;

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS firma_entrenador_url TEXT;

-- Storage: permitir sellos-academia (admin) y firmas-convocatoria (admin o creador)
DROP POLICY IF EXISTS "storage_expedientes_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_delete_authenticated" ON storage.objects;

CREATE POLICY "storage_expedientes_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      (storage.foldername(name))[1] IN ('fotos-estudiante', 'documentos')
      OR (
        (storage.foldername(name))[1] IN ('logos-academia', 'sellos-academia')
        AND public.get_user_rol() = 'admin'
      )
      OR (
        (storage.foldername(name))[1] = 'firmas-convocatoria'
        AND (
          public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 2), '\.[^.]*$', '')::uuid
              AND c.creado_por = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "storage_expedientes_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
  )
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      (storage.foldername(name))[1] IN ('fotos-estudiante', 'documentos')
      OR (
        (storage.foldername(name))[1] IN ('logos-academia', 'sellos-academia')
        AND public.get_user_rol() = 'admin'
      )
      OR (
        (storage.foldername(name))[1] = 'firmas-convocatoria'
        AND (
          public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 2), '\.[^.]*$', '')::uuid
              AND c.creado_por = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "storage_expedientes_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      (storage.foldername(name))[1] IN ('fotos-estudiante', 'documentos')
      OR (
        (storage.foldername(name))[1] IN ('logos-academia', 'sellos-academia')
        AND public.get_user_rol() = 'admin'
      )
      OR (
        (storage.foldername(name))[1] = 'firmas-convocatoria'
        AND (
          public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 2), '\.[^.]*$', '')::uuid
              AND c.creado_por = auth.uid()
          )
        )
      )
    )
  );
