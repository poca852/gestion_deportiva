-- Fecha de ingreso a la academia (cuándo empezó el alumno)

ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;

-- Para registros existentes, usar la fecha de creación como referencia
UPDATE public.alumnos
  SET fecha_ingreso = created_at::DATE
  WHERE fecha_ingreso IS NULL AND created_at IS NOT NULL;
