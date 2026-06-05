-- Catálogo canónico de categorías (sincronizado con shared/domain/categorias.ts)
CREATE OR REPLACE FUNCTION public.categorias_validas()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT ARRAY[
    'U8',
    'U10',
    'U12',
    'U14',
    'U16',
    'U18',
    'U20',
    'Senior'
  ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.is_categoria_valida(p_categoria TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT p_categoria = ANY(public.categorias_validas());
$$;

CREATE OR REPLACE FUNCTION public.are_categorias_asignadas_validas(p_categorias TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(p_categorias, '{}'::TEXT[]) <@ public.categorias_validas();
$$;

ALTER TABLE public.alumnos
  DROP CONSTRAINT IF EXISTS alumnos_categoria_valida;

ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_categoria_valida
  CHECK (public.is_categoria_valida(categoria));

ALTER TABLE public.convocatorias
  DROP CONSTRAINT IF EXISTS convocatorias_categoria_valida;

ALTER TABLE public.convocatorias
  ADD CONSTRAINT convocatorias_categoria_valida
  CHECK (public.is_categoria_valida(categoria));

ALTER TABLE public.entrenadores
  DROP CONSTRAINT IF EXISTS entrenadores_categorias_asignadas_validas;

ALTER TABLE public.entrenadores
  ADD CONSTRAINT entrenadores_categorias_asignadas_validas
  CHECK (public.are_categorias_asignadas_validas(categorias_asignadas));

REVOKE ALL ON FUNCTION public.categorias_validas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_categoria_valida(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.are_categorias_asignadas_validas(TEXT[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.categorias_validas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_categoria_valida(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_categorias_asignadas_validas(TEXT[]) TO authenticated;
