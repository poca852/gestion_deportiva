-- ============================================================
-- Academias de Baloncesto - Esquema Supabase (Multi-tenant)
-- Versión final con super_admin separado
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE rol_entrenador AS ENUM ('admin', 'coach');
CREATE TYPE genero_alumno AS ENUM ('masculino', 'femenino', 'otro');

-- ------------------------------------------------------------
-- Tabla: super_admins (dueño del sistema, NO es entrenador)
-- ------------------------------------------------------------
CREATE TABLE public.super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabla: academias
-- ------------------------------------------------------------
CREATE TABLE public.academias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  sello_url TEXT,
  admin_id UUID REFERENCES public.entrenadores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabla: entrenadores
-- ------------------------------------------------------------
CREATE TABLE public.entrenadores (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  categorias_asignadas TEXT[] NOT NULL DEFAULT '{}',
  rol rol_entrenador NOT NULL DEFAULT 'coach',
  academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabla: alumnos
-- ------------------------------------------------------------
CREATE TABLE public.alumnos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  genero genero_alumno NOT NULL DEFAULT 'masculino',
  nombre_tutor TEXT NOT NULL,
  telefono_tutor TEXT NOT NULL,
  foto_estudiante_url TEXT,
  foto_documento_url TEXT,
  foto_documento_padre_url TEXT,
  talla_camiseta TEXT,
  categoria TEXT NOT NULL,
  nivel TEXT,
  fecha_ingreso DATE,
  academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabla: convocatorias
-- ------------------------------------------------------------
CREATE TABLE public.convocatorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_evento TEXT NOT NULL,
  fecha DATE NOT NULL,
  categoria TEXT NOT NULL,
  creado_por UUID NOT NULL REFERENCES public.entrenadores(id) ON DELETE RESTRICT,
  firma_entrenador_url TEXT,
  academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Tabla: alumnos_convocatoria
-- ------------------------------------------------------------
CREATE TABLE public.alumnos_convocatoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  convocatoria_id UUID NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (convocatoria_id, alumno_id)
);

-- Índices
CREATE INDEX idx_alumnos_categoria ON public.alumnos(categoria);
CREATE INDEX idx_alumnos_apellidos ON public.alumnos(apellidos);
CREATE INDEX idx_convocatorias_categoria ON public.convocatorias(categoria);
CREATE INDEX idx_convocatorias_fecha ON public.convocatorias(fecha);
CREATE INDEX idx_alumnos_convocatoria_convocatoria ON public.alumnos_convocatoria(convocatoria_id);
CREATE INDEX idx_entrenadores_academia ON public.entrenadores(academia_id);
CREATE INDEX idx_alumnos_academia ON public.alumnos(academia_id);
CREATE INDEX idx_convocatorias_academia ON public.convocatorias(academia_id);
CREATE INDEX idx_alumnos_academia_categoria ON public.alumnos(academia_id, categoria);
CREATE INDEX idx_convocatorias_academia_categoria ON public.convocatorias(academia_id, categoria);

-- Triggers updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_academias_updated_at
  BEFORE UPDATE ON public.academias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_entrenadores_updated_at
  BEFORE UPDATE ON public.entrenadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_alumnos_updated_at
  BEFORE UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_convocatorias_updated_at
  BEFORE UPDATE ON public.convocatorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('expedientes-academia', 'expedientes-academia', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrenadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos_convocatoria ENABLE ROW LEVEL SECURITY;

-- Helpers RLS
CREATE OR REPLACE FUNCTION public.get_user_rol()
RETURNS rol_entrenador AS $$
  SELECT rol FROM public.entrenadores WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_categorias()
RETURNS TEXT[] AS $$
  SELECT COALESCE(categorias_asignadas, '{}'::TEXT[])
  FROM public.entrenadores WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_has_categoria(p_categoria TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    public.get_user_rol() = 'admin'
    OR (
      p_categoria IS NOT NULL
      AND p_categoria = ANY(public.get_user_categorias())
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

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

CREATE OR REPLACE FUNCTION public.get_user_es_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_user_academia_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT academia_id FROM public.entrenadores WHERE id = auth.uid();
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

REVOKE ALL ON FUNCTION public.is_authenticated_entrenador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authenticated_entrenador() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_rol() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_categorias() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_categoria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_categorias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_categoria() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_es_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_es_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_academia_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_academia_id() TO authenticated;

REVOKE ALL ON FUNCTION public.user_belongs_to_academia(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_academia(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_academia_id_from_storage_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_academia_id_from_storage_path(text) TO authenticated;

-- SUPER_ADMINS
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
CREATE POLICY "academias_select_authenticated"
  ON public.academias FOR SELECT
  TO authenticated
  USING (public.get_user_es_super_admin() OR public.user_belongs_to_academia(id));

CREATE POLICY "academias_insert_super_admin"
  ON public.academias FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_es_super_admin());

CREATE POLICY "academias_update_by_member"
  ON public.academias FOR UPDATE
  TO authenticated
  USING (public.get_user_es_super_admin() OR (public.get_user_rol() = 'admin' AND public.user_belongs_to_academia(id)))
  WITH CHECK (public.get_user_es_super_admin() OR (public.get_user_rol() = 'admin' AND public.user_belongs_to_academia(id)));

CREATE POLICY "academias_delete_super_admin"
  ON public.academias FOR DELETE
  TO authenticated
  USING (public.get_user_es_super_admin());

-- ENTRENADORES
CREATE POLICY "entrenadores_select_authenticated"
  ON public.entrenadores FOR SELECT
  TO authenticated
  USING (public.get_user_es_super_admin() OR academia_id = public.get_user_academia_id() OR id = auth.uid());

CREATE POLICY "entrenadores_insert_admin"
  ON public.entrenadores FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_es_super_admin() OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id()));

CREATE POLICY "entrenadores_update_admin"
  ON public.entrenadores FOR UPDATE
  TO authenticated
  USING (public.get_user_es_super_admin() OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id()))
  WITH CHECK (public.get_user_es_super_admin() OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id()));

CREATE POLICY "entrenadores_delete_admin"
  ON public.entrenadores FOR DELETE
  TO authenticated
  USING (public.get_user_es_super_admin() OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id()));

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
    AND academia_id IS NOT DISTINCT FROM (SELECT e.academia_id FROM public.entrenadores e WHERE e.id = auth.uid())
    AND categorias_asignadas IS NOT DISTINCT FROM (SELECT e.categorias_asignadas FROM public.entrenadores e WHERE e.id = auth.uid())
  );

-- ALUMNOS
CREATE POLICY "alumnos_select_by_academia"
  ON public.alumnos FOR SELECT
  TO authenticated
  USING (public.get_user_es_super_admin() OR academia_id = public.get_user_academia_id());

CREATE POLICY "alumnos_insert_by_academia"
  ON public.alumnos FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_es_super_admin() OR academia_id = public.get_user_academia_id());

CREATE POLICY "alumnos_update_by_academia"
  ON public.alumnos FOR UPDATE
  TO authenticated
  USING (public.get_user_es_super_admin() OR academia_id = public.get_user_academia_id())
  WITH CHECK (public.get_user_es_super_admin() OR academia_id = public.get_user_academia_id());

CREATE POLICY "alumnos_delete_by_academia"
  ON public.alumnos FOR DELETE
  TO authenticated
  USING (public.get_user_es_super_admin() OR academia_id = public.get_user_academia_id());

-- CONVOCATORIAS
CREATE POLICY "convocatorias_select_by_academia"
  ON public.convocatorias FOR SELECT
  TO authenticated
  USING (public.get_user_es_super_admin() OR academia_id = public.get_user_academia_id());

CREATE POLICY "convocatorias_insert_by_academia"
  ON public.convocatorias FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_es_super_admin() OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid()));

CREATE POLICY "convocatorias_update_by_academia"
  ON public.convocatorias FOR UPDATE
  TO authenticated
  USING (public.get_user_es_super_admin() OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid()));

CREATE POLICY "convocatorias_delete_by_academia"
  ON public.convocatorias FOR DELETE
  TO authenticated
  USING (public.get_user_es_super_admin() OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid()));

-- ALUMNOS_CONVOCATORIA
CREATE POLICY "alumnos_convocatoria_select"
  ON public.alumnos_convocatoria FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_es_super_admin() OR c.academia_id = public.get_user_academia_id())));

CREATE POLICY "alumnos_convocatoria_insert"
  ON public.alumnos_convocatoria FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_es_super_admin() OR (c.academia_id = public.get_user_academia_id() AND c.creado_por = auth.uid()))));

CREATE POLICY "alumnos_convocatoria_delete"
  ON public.alumnos_convocatoria FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = convocatoria_id AND (public.get_user_es_super_admin() OR (c.academia_id = public.get_user_academia_id() AND c.creado_por = auth.uid()))));

-- STORAGE
CREATE POLICY "storage_expedientes_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (public.get_user_es_super_admin() OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id())
  );

CREATE POLICY "storage_expedientes_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (public.get_user_es_super_admin() OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id())
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR ((storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia') AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin'))
      OR ((storage.foldername(name))[2] = 'firmas-convocatoria' AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin' OR EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin'))))
    )
  );

CREATE POLICY "storage_expedientes_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (public.get_user_es_super_admin() OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id())
  )
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (public.get_user_es_super_admin() OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id())
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR ((storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia') AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin'))
      OR ((storage.foldername(name))[2] = 'firmas-convocatoria' AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin' OR EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin'))))
    )
  );

CREATE POLICY "storage_expedientes_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (public.get_user_es_super_admin() OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id())
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR ((storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia') AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin'))
      OR ((storage.foldername(name))[2] = 'firmas-convocatoria' AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin' OR EXISTS (SELECT 1 FROM public.convocatorias c WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin'))))
    )
  );

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
