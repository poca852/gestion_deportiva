-- ==============================================================
-- Multi-tenancy: academias independientes + super_admin separado
-- ==============================================================

-- Extensión uuid-ossp (idempotente)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================
-- 1. NUEVA TABLA: academias (reemplaza academia_config)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.academias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  sello_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar columna admin_id a academias
ALTER TABLE public.academias
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.entrenadores(id) ON DELETE SET NULL;

-- ==============================================================
-- 2. NUEVA TABLA: super_admins (dueño del sistema)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================
-- 3. AGREGAR academia_id A TABLAS EXISTENTES
-- ==============================================================
ALTER TABLE public.entrenadores
  ADD COLUMN IF NOT EXISTS academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL;

ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL;

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL;

-- ==============================================================
-- 4. ELIMINAR academia_config (tabla vieja single-row)
-- ==============================================================
DROP TABLE IF EXISTS public.academia_config CASCADE;

-- ==============================================================
-- 5. ÍNDICES DE RENDIMIENTO
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_entrenadores_academia ON public.entrenadores(academia_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_academia ON public.alumnos(academia_id);
CREATE INDEX IF NOT EXISTS idx_convocatorias_academia ON public.convocatorias(academia_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_academia_categoria ON public.alumnos(academia_id, categoria);
CREATE INDEX IF NOT EXISTS idx_convocatorias_academia_categoria ON public.convocatorias(academia_id, categoria);

-- ==============================================================
-- 6. TRIGGERS updated_at
-- ==============================================================
DROP TRIGGER IF EXISTS trg_academias_updated_at ON public.academias;
CREATE TRIGGER trg_academias_updated_at
  BEFORE UPDATE ON public.academias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================
-- 7. ACTUALIZAR TRIGGER handle_new_user
--    Primer usuario → super_admins
--    Siguientes → entrenadores como coach
-- ==============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_nombre text;
  v_total_entrenadores int;
  v_total_super int;
BEGIN
  SELECT count(*) INTO v_total_super FROM public.super_admins;
  SELECT count(*) INTO v_total_entrenadores FROM public.entrenadores;

  IF v_total_super = 0 AND v_total_entrenadores = 0 THEN
    INSERT INTO public.super_admins (id)
    VALUES (new.id);
    RETURN new;
  END IF;

  v_nombre := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Entrenador'
  );

  INSERT INTO public.entrenadores (id, nombre, correo, categorias_asignadas, rol, academia_id)
  VALUES (
    new.id,
    v_nombre,
    coalesce(new.email, new.id::text || '@local.invalid'),
    '{}'::text[],
    'coach'::rol_entrenador,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET correo = excluded.correo;

  RETURN new;
END;
$$;

-- ==============================================================
-- 8. FUNCIONES HELPER ACTUALIZADAS
-- ==============================================================

-- get_user_es_super_admin consulta la tabla super_admins
CREATE OR REPLACE FUNCTION public.get_user_es_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE id = auth.uid());
$$;

-- get_user_academia_id
CREATE OR REPLACE FUNCTION public.get_user_academia_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT academia_id FROM public.entrenadores WHERE id = auth.uid();
$$;

-- user_has_categoria (solo admin, ya no incluye super_admin)
CREATE OR REPLACE FUNCTION public.user_has_categoria(p_categoria TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    public.get_user_rol() = 'admin'
    OR (
      p_categoria IS NOT NULL
      AND p_categoria = ANY(public.get_user_categorias())
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- user_belongs_to_academia
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

-- get_academia_id_from_storage_path
CREATE OR REPLACE FUNCTION public.get_academia_id_from_storage_path(path text)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (storage.foldername(path))[1]::UUID;
$$;

-- Permisos
REVOKE ALL ON FUNCTION public.get_user_es_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_es_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_academia_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_academia_id() TO authenticated;

REVOKE ALL ON FUNCTION public.user_belongs_to_academia(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_academia(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_academia_id_from_storage_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_academia_id_from_storage_path(text) TO authenticated;

-- ==============================================================
-- 9. RLS POLICIES
-- ==============================================================

-- SUPER_ADMINS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_select_self"
  ON public.super_admins FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "super_admins_insert_first"
  ON public.super_admins FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND (SELECT count(*) FROM public.super_admins) = 0);

CREATE POLICY "super_admins_delete_self"
  ON public.super_admins FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ACADEMIAS
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

-- ENTRENADORES
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

CREATE POLICY "entrenadores_delete_admin"
  ON public.entrenadores FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  );

CREATE POLICY "entrenadores_self_insert"
  ON public.entrenadores FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

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

-- ALUMNOS
DROP POLICY IF EXISTS "alumnos_select_by_academia" ON public.alumnos;
CREATE POLICY "alumnos_select_by_academia"
  ON public.alumnos FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "alumnos_insert_by_academia" ON public.alumnos;
CREATE POLICY "alumnos_insert_by_academia"
  ON public.alumnos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

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

CREATE POLICY "alumnos_delete_by_academia"
  ON public.alumnos FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

-- CONVOCATORIAS
DROP POLICY IF EXISTS "convocatorias_select_by_academia" ON public.convocatorias;
CREATE POLICY "convocatorias_select_by_academia"
  ON public.convocatorias FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

CREATE POLICY "convocatorias_insert_by_academia"
  ON public.convocatorias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

CREATE POLICY "convocatorias_update_by_academia"
  ON public.convocatorias FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

CREATE POLICY "convocatorias_delete_by_academia"
  ON public.convocatorias FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

-- ALUMNOS_CONVOCATORIA
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
-- 10. STORAGE RLS
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

-- Sin acceso directo de anon a tablas
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
