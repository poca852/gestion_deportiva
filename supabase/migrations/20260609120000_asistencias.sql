-- Registro diario de asistencia por alumno (QR o búsqueda manual)
CREATE TABLE public.asistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  academia_id UUID NOT NULL REFERENCES public.academias(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  registrado_por UUID NOT NULL REFERENCES public.entrenadores(id) ON DELETE RESTRICT,
  metodo TEXT NOT NULL DEFAULT 'qr' CHECK (metodo IN ('qr', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, fecha)
);

CREATE INDEX idx_asistencias_academia_fecha
  ON public.asistencias (academia_id, fecha DESC);

CREATE INDEX idx_asistencias_alumno_fecha
  ON public.asistencias (alumno_id, fecha DESC);

ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY asistencias_select_by_academia
  ON public.asistencias FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

CREATE POLICY asistencias_insert_by_academia
  ON public.asistencias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (
      academia_id = public.get_user_academia_id()
      AND registrado_por = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.alumnos a
        WHERE a.id = alumno_id
          AND a.academia_id = public.get_user_academia_id()
      )
    )
  );
