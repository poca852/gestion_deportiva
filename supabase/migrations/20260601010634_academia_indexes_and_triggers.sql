CREATE INDEX IF NOT EXISTS idx_alumnos_categoria ON public.alumnos(categoria);
CREATE INDEX IF NOT EXISTS idx_alumnos_apellidos ON public.alumnos(apellidos);
CREATE INDEX IF NOT EXISTS idx_convocatorias_categoria ON public.convocatorias(categoria);
CREATE INDEX IF NOT EXISTS idx_convocatorias_fecha ON public.convocatorias(fecha);
CREATE INDEX IF NOT EXISTS idx_alumnos_convocatoria_convocatoria ON public.alumnos_convocatoria(convocatoria_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entrenadores_updated_at ON public.entrenadores;
CREATE TRIGGER trg_entrenadores_updated_at
  BEFORE UPDATE ON public.entrenadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_alumnos_updated_at ON public.alumnos;
CREATE TRIGGER trg_alumnos_updated_at
  BEFORE UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_convocatorias_updated_at ON public.convocatorias;
CREATE TRIGGER trg_convocatorias_updated_at
  BEFORE UPDATE ON public.convocatorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
