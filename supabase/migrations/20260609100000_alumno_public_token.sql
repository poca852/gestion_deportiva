-- Token opaco para acceso público al perfil del alumno (sin exponer el UUID interno)
ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS public_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Backfill para alumnos existentes
UPDATE public.alumnos
SET public_token = gen_random_uuid()
WHERE public_token IS NULL;

ALTER TABLE public.alumnos
  ALTER COLUMN public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alumnos_public_token
  ON public.alumnos (public_token);
