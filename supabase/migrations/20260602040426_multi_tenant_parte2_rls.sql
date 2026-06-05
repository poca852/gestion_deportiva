-- ==============================================================
-- Parte 2: Funciones helper + RLS + Storage
-- ==============================================================

-- Funciones helper RLS multi-tenant
CREATE OR REPLACE FUNCTION public.get_user_academia_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT academia_id FROM public.entrenadores WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_es_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol = 'super_admin'::rol_entrenador FROM public.entrenadores WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_academia(p_academia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.get_user_es_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.entrenadores
        WHERE id = auth.uid() AND academia_id = p_academia_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.get_academia_id_from_storage_path(path text)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (storage.foldername(path))[1]::UUID;
$$;

-- Actualizar user_has_categoria para incluir super_admin
CREATE OR REPLACE FUNCTION public.user_has_categoria(p_categoria TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    public.get_user_rol() IN ('admin', 'super_admin')
    OR (
      p_categoria IS NOT NULL
      AND p_categoria = ANY(public.get_user_categorias())
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Permisos
REVOKE ALL ON FUNCTION public.get_user_academia_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_academia_id() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_es_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_es_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.user_belongs_to_academia(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_academia(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_academia_id_from_storage_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_academia_id_from_storage_path(text) TO authenticated;

-- ==============================================================
-- RLS: ACADEMIAS
-- ==============================================================
ALTER TABLE public.academias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academias_select_authenticated"
  ON public.academias FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR public.user_belongs_to_academia(id)
  );

CREATE POLICY "academias_insert_super_admin"
  ON public.academias FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_es_super_admin());

CREATE POLICY "academias_update_by_member"
  ON public.academias FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND public.user_belongs_to_academia(id))
  )
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND public.user_belongs_to_academia(id))
  );

CREATE POLICY "academias_delete_super_admin"
  ON public.academias FOR DELETE
  TO authenticated
  USING (public.get_user_es_super_admin());

-- ==============================================================
-- RLS: ENTRENADORES
-- ==============================================================
DROP POLICY IF EXISTS "entrenadores_select_authenticated" ON public.entrenadores;
CREATE POLICY "entrenadores_select_authenticated"
  ON public.entrenadores FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "entrenadores_insert_admin" ON public.entrenadores;
CREATE POLICY "entrenadores_insert_admin"
  ON public.entrenadores FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  );

DROP POLICY IF EXISTS "entrenadores_update_admin" ON public.entrenadores;
CREATE POLICY "entrenadores_update_admin"
  ON public.entrenadores FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  )
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  );

DROP POLICY IF EXISTS "entrenadores_delete_admin" ON public.entrenadores;
CREATE POLICY "entrenadores_delete_admin"
  ON public.entrenadores FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  );

DROP POLICY IF EXISTS "entrenadores_self_update" ON public.entrenadores;
CREATE POLICY "entrenadores_self_update"
  ON public.entrenadores FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND rol = (SELECT e.rol FROM public.entrenadores e WHERE e.id = auth.uid())
    AND correo = (SELECT e.correo FROM public.entrenadores e WHERE e.id = auth.uid())
    AND academia_id IS NOT DISTINCT FROM (
      SELECT e.academia_id FROM public.entrenadores e WHERE e.id = auth.uid()
    )
    AND categorias_asignadas IS NOT DISTINCT FROM (
      SELECT e.categorias_asignadas FROM public.entrenadores e WHERE e.id = auth.uid()
    )
  );

-- ==============================================================
-- RLS: ALUMNOS
-- ==============================================================
DROP POLICY IF EXISTS "alumnos_select_by_role" ON public.alumnos;
CREATE POLICY "alumnos_select_by_academia"
  ON public.alumnos FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "alumnos_insert_by_role" ON public.alumnos;
CREATE POLICY "alumnos_insert_by_academia"
  ON public.alumnos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "alumnos_update_by_role" ON public.alumnos;
CREATE POLICY "alumnos_update_by_academia"
  ON public.alumnos FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  )
  WITH CHECK (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "alumnos_delete_by_role" ON public.alumnos;
CREATE POLICY "alumnos_delete_by_academia"
  ON public.alumnos FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

-- ==============================================================
-- RLS: CONVOCATORIAS
-- ==============================================================
DROP POLICY IF EXISTS "convocatorias_select_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_select_by_academia"
  ON public.convocatorias FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "convocatorias_insert_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_insert_by_academia"
  ON public.convocatorias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

DROP POLICY IF EXISTS "convocatorias_update_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_update_by_academia"
  ON public.convocatorias FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

DROP POLICY IF EXISTS "convocatorias_delete_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_delete_by_academia"
  ON public.convocatorias FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

-- ==============================================================
-- RLS: ALUMNOS_CONVOCATORIA
-- ==============================================================
DROP POLICY IF EXISTS "alumnos_convocatoria_select" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_select"
  ON public.alumnos_convocatoria FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.convocatorias c
      WHERE c.id = convocatoria_id
      AND (
        public.get_user_es_super_admin()
        OR c.academia_id = public.get_user_academia_id()
      )
    )
  );

DROP POLICY IF EXISTS "alumnos_convocatoria_insert" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_insert"
  ON public.alumnos_convocatoria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.convocatorias c
      WHERE c.id = convocatoria_id
      AND (
        public.get_user_es_super_admin()
        OR (c.academia_id = public.get_user_academia_id() AND c.creado_por = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "alumnos_convocatoria_delete" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_delete"
  ON public.alumnos_convocatoria FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.convocatorias c
      WHERE c.id = convocatoria_id
      AND (
        public.get_user_es_super_admin()
        OR (c.academia_id = public.get_user_academia_id() AND c.creado_por = auth.uid())
      )
    )
  );

-- ==============================================================
-- STORAGE RLS
-- ==============================================================
DROP POLICY IF EXISTS "storage_expedientes_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_delete_authenticated" ON storage.objects;

CREATE POLICY "storage_expedientes_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
  );

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
