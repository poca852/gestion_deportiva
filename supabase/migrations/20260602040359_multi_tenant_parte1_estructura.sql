-- ==============================================================
-- Parte 1: Estructura (tablas, columnas, enum, índices)
-- ==============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla academias
CREATE TABLE IF NOT EXISTS public.academias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  sello_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columnas academia_id
ALTER TABLE public.entrenadores
  ADD COLUMN IF NOT EXISTS academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL;

ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL;

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS academia_id UUID REFERENCES public.academias(id) ON DELETE SET NULL;

-- Nuevo rol
ALTER TYPE rol_entrenador ADD VALUE IF NOT EXISTS 'super_admin';

-- Eliminar tabla vieja
DROP TABLE IF EXISTS public.academia_config CASCADE;

-- Índices
CREATE INDEX IF NOT EXISTS idx_entrenadores_academia ON public.entrenadores(academia_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_academia ON public.alumnos(academia_id);
CREATE INDEX IF NOT EXISTS idx_convocatorias_academia ON public.convocatorias(academia_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_academia_categoria ON public.alumnos(academia_id, categoria);
CREATE INDEX IF NOT EXISTS idx_convocatorias_academia_categoria ON public.convocatorias(academia_id, categoria);

-- Trigger para academias
DROP TRIGGER IF EXISTS trg_academias_updated_at ON public.academias;
CREATE TRIGGER trg_academias_updated_at
  BEFORE UPDATE ON public.academias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Actualizar trigger handle_new_user (sin usar el nuevo enum aún)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_nombre text;
  v_rol text;
BEGIN
  v_nombre := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Entrenador'
  );

  IF (SELECT count(*) FROM public.entrenadores) = 0 THEN
    v_rol := 'super_admin';
  ELSE
    v_rol := 'coach';
  END IF;

  INSERT INTO public.entrenadores (id, nombre, correo, categorias_asignadas, rol, academia_id)
  VALUES (
    new.id,
    v_nombre,
    coalesce(new.email, new.id::text || '@local.invalid'),
    '{}'::text[],
    v_rol::rol_entrenador,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET correo = excluded.correo;

  RETURN new;
END;
$$;
