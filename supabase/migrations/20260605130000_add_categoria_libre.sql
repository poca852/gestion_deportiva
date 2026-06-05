-- Añade la categoría "Libre" al catálogo validado en BD.
-- Sincronizado con supabase/functions/_shared/categorias.ts
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
    'Senior',
    'Libre'
  ]::TEXT[];
$$;
