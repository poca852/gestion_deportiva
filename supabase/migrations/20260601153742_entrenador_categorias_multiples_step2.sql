DROP POLICY IF EXISTS "entrenadores_self_update" ON public.entrenadores;

ALTER TABLE public.entrenadores DROP COLUMN categoria_asignada;

CREATE OR REPLACE FUNCTION public.get_user_categorias()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(e.categorias_asignadas, '{}'::TEXT[])
  FROM public.entrenadores e
  WHERE e.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_has_categoria(p_categoria TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.get_user_rol() = 'admin'
    OR (
      p_categoria IS NOT NULL
      AND p_categoria = ANY(public.get_user_categorias())
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_categorias() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_categoria(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_categorias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_categoria(TEXT) TO authenticated;
