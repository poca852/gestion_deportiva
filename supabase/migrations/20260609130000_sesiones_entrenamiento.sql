-- Sesiones de entrenamiento por categoría y día (base para calcular faltas)
CREATE TABLE public.sesiones_entrenamiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id UUID NOT NULL REFERENCES public.academias(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  categoria TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  abierta_por UUID NOT NULL REFERENCES public.entrenadores(id) ON DELETE RESTRICT,
  cerrada_por UUID REFERENCES public.entrenadores(id) ON DELETE SET NULL,
  cerrada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academia_id, fecha, categoria)
);

CREATE INDEX idx_sesiones_academia_fecha
  ON public.sesiones_entrenamiento (academia_id, fecha DESC);

CREATE INDEX idx_sesiones_academia_categoria_fecha
  ON public.sesiones_entrenamiento (academia_id, categoria, fecha DESC);

CREATE TRIGGER trg_sesiones_entrenamiento_updated_at
  BEFORE UPDATE ON public.sesiones_entrenamiento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vincular asistencias a sesiones
ALTER TABLE public.asistencias
  ADD COLUMN IF NOT EXISTS sesion_id UUID REFERENCES public.sesiones_entrenamiento(id) ON DELETE CASCADE;

-- Backfill: crear sesiones cerradas a partir de asistencias existentes
INSERT INTO public.sesiones_entrenamiento (
  academia_id,
  fecha,
  categoria,
  estado,
  abierta_por,
  cerrada_por,
  cerrada_at
)
SELECT
  a.academia_id,
  a.fecha,
  al.categoria,
  'cerrada',
  (MIN(a.registrado_por::text))::UUID,
  (MIN(a.registrado_por::text))::UUID,
  MAX(a.created_at)
FROM public.asistencias a
JOIN public.alumnos al ON al.id = a.alumno_id
WHERE a.sesion_id IS NULL
GROUP BY a.academia_id, a.fecha, al.categoria
ON CONFLICT (academia_id, fecha, categoria) DO NOTHING;

UPDATE public.asistencias a
SET sesion_id = s.id
FROM public.alumnos al,
     public.sesiones_entrenamiento s
WHERE a.alumno_id = al.id
  AND a.sesion_id IS NULL
  AND s.academia_id = a.academia_id
  AND s.fecha = a.fecha
  AND s.categoria = al.categoria;

ALTER TABLE public.asistencias
  ALTER COLUMN sesion_id SET NOT NULL;

ALTER TABLE public.asistencias
  DROP CONSTRAINT IF EXISTS asistencias_alumno_id_fecha_key;

ALTER TABLE public.asistencias
  DROP CONSTRAINT IF EXISTS asistencias_alumno_id_sesion_id_key;

ALTER TABLE public.asistencias
  ADD CONSTRAINT asistencias_alumno_id_sesion_id_key UNIQUE (alumno_id, sesion_id);

CREATE INDEX IF NOT EXISTS idx_asistencias_sesion
  ON public.asistencias (sesion_id);

-- RLS sesiones
ALTER TABLE public.sesiones_entrenamiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY sesiones_select_by_academia
  ON public.sesiones_entrenamiento FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

CREATE POLICY sesiones_insert_by_academia
  ON public.sesiones_entrenamiento FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (
      academia_id = public.get_user_academia_id()
      AND abierta_por = auth.uid()
    )
  );

CREATE POLICY sesiones_update_by_academia
  ON public.sesiones_entrenamiento FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  )
  WITH CHECK (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

-- Resumen de asistencia/faltas por alumno (solo sesiones cerradas)
CREATE OR REPLACE FUNCTION public.get_resumen_asistencia_alumno(
  p_alumno_id UUID,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alumno RECORD;
  v_desde DATE;
  v_hasta DATE;
  v_esperados INT;
  v_presentes INT;
BEGIN
  SELECT id, academia_id, categoria, fecha_ingreso
  INTO v_alumno
  FROM public.alumnos
  WHERE id = p_alumno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alumno no encontrado';
  END IF;

  IF NOT (
    public.get_user_es_super_admin()
    OR v_alumno.academia_id = public.get_user_academia_id()
  ) THEN
    RAISE EXCEPTION 'Sin permiso para consultar este alumno';
  END IF;

  v_hasta := COALESCE(p_hasta, CURRENT_DATE);
  v_desde := COALESCE(
    p_desde,
    COALESCE(v_alumno.fecha_ingreso, DATE_TRUNC('year', CURRENT_DATE)::DATE)
  );

  SELECT COUNT(*)::INT
  INTO v_esperados
  FROM public.sesiones_entrenamiento s
  WHERE s.academia_id = v_alumno.academia_id
    AND s.categoria = v_alumno.categoria
    AND s.estado = 'cerrada'
    AND s.fecha BETWEEN v_desde AND v_hasta
    AND (v_alumno.fecha_ingreso IS NULL OR s.fecha >= v_alumno.fecha_ingreso);

  SELECT COUNT(*)::INT
  INTO v_presentes
  FROM public.asistencias a
  JOIN public.sesiones_entrenamiento s ON s.id = a.sesion_id
  WHERE a.alumno_id = p_alumno_id
    AND s.estado = 'cerrada'
    AND s.fecha BETWEEN v_desde AND v_hasta;

  RETURN json_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'esperados', v_esperados,
    'presentes', v_presentes,
    'faltas', GREATEST(v_esperados - v_presentes, 0),
    'porcentaje', CASE
      WHEN v_esperados > 0 THEN ROUND((v_presentes::NUMERIC / v_esperados) * 100, 1)
      ELSE 0
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_resumen_asistencia_alumno(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resumen_asistencia_alumno(UUID, DATE, DATE) TO authenticated;
