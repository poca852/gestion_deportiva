ALTER TABLE public.entrenadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos_convocatoria ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_rol()
RETURNS rol_entrenador AS $$
  SELECT rol FROM public.entrenadores WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_categoria()
RETURNS TEXT AS $$
  SELECT categoria_asignada FROM public.entrenadores WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
