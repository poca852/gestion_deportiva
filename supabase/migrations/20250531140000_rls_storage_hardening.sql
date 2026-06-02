-- Endurecimiento RLS + Storage: solo usuarios autenticados con perfil de entrenador
-- pueden subir archivos. Bucket expedientes-academia pasa a privado.

-- ---------------------------------------------------------------------------
-- Helpers de seguridad
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_authenticated_entrenador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.entrenadores e WHERE e.id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_authenticated_entrenador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authenticated_entrenador() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_rol() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_categoria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_categoria() TO authenticated;

-- Sin acceso directo de anon a tablas (RLS ya aplicaba, esto cierra API/GraphQL)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- ---------------------------------------------------------------------------
-- Entrenadores: un coach no puede elevar su propio rol
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "entrenadores_self_update" ON public.entrenadores;
CREATE POLICY "entrenadores_self_update"
  ON public.entrenadores FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND rol = (SELECT e.rol FROM public.entrenadores e WHERE e.id = auth.uid())
    AND correo = (SELECT e.correo FROM public.entrenadores e WHERE e.id = auth.uid())
    AND categoria_asignada IS NOT DISTINCT FROM (
      SELECT e.categoria_asignada FROM public.entrenadores e WHERE e.id = auth.uid()
    )
  );

-- Academia: solo admin puede borrar configuración
DROP POLICY IF EXISTS "academia_config_delete_admin" ON public.academia_config;
CREATE POLICY "academia_config_delete_admin"
  ON public.academia_config FOR DELETE
  TO authenticated
  USING (public.get_user_rol() = 'admin');

-- ---------------------------------------------------------------------------
-- Storage: expedientes-academia (privado, solo autenticados con perfil)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'expedientes-academia';

DROP POLICY IF EXISTS "storage_expedientes_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_delete" ON storage.objects;

CREATE POLICY "storage_expedientes_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
  );

CREATE POLICY "storage_expedientes_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      (storage.foldername(name))[1] IN ('fotos-estudiante', 'documentos')
      OR (
        (storage.foldername(name))[1] = 'logos-academia'
        AND public.get_user_rol() = 'admin'
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
        (storage.foldername(name))[1] = 'logos-academia'
        AND public.get_user_rol() = 'admin'
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
        (storage.foldername(name))[1] = 'logos-academia'
        AND public.get_user_rol() = 'admin'
      )
    )
  );
