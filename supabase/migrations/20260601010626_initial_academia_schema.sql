CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE rol_entrenador AS ENUM ('admin', 'coach');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE genero_alumno AS ENUM ('masculino', 'femenino', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.entrenadores (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  categoria_asignada TEXT,
  rol rol_entrenador NOT NULL DEFAULT 'coach',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alumnos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  genero genero_alumno NOT NULL DEFAULT 'masculino',
  nombre_tutor TEXT NOT NULL,
  telefono_tutor TEXT NOT NULL,
  foto_estudiante_url TEXT,
  foto_documento_url TEXT,
  categoria TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.convocatorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_evento TEXT NOT NULL,
  fecha DATE NOT NULL,
  categoria TEXT NOT NULL,
  creado_por UUID NOT NULL REFERENCES public.entrenadores(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alumnos_convocatoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  convocatoria_id UUID NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (convocatoria_id, alumno_id)
);
