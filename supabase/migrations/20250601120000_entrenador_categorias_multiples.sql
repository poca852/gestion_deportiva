-- Entrenadores: varias categorías asignadas (TEXT[])

ALTER TABLE public.entrenadores
  ADD COLUMN IF NOT EXISTS categorias_asignadas TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.entrenadores
SET categorias_asignadas = ARRAY[categoria_asignada]
WHERE categoria_asignada IS NOT NULL
  AND categoria_asignada <> ''
  AND categorias_asignadas = '{}';

DROP POLICY IF EXISTS "entrenadores_self_update" ON public.entrenadores;

ALTER TABLE public.entrenadores
  DROP COLUMN IF EXISTS categoria_asignada;

-- Helpers de categoría

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
REVOKE ALL ON FUNCTION public.user_has_categoria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_categorias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_categoria() TO authenticated;

-- Política self_update: coach no puede cambiar sus categorías
DROP POLICY IF EXISTS "entrenadores_self_update" ON public.entrenadores;
CREATE POLICY "entrenadores_self_update"
  ON public.entrenadores FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND rol = (SELECT e.rol FROM public.entrenadores e WHERE e.id = auth.uid())
    AND correo = (SELECT e.correo FROM public.entrenadores e WHERE e.id = auth.uid())
    AND categorias_asignadas IS NOT DISTINCT FROM (
      SELECT e.categorias_asignadas FROM public.entrenadores e WHERE e.id = auth.uid()
    )
  );

-- ALUMNOS
DROP POLICY IF EXISTS "alumnos_select_by_role" ON public.alumnos;
CREATE POLICY "alumnos_select_by_role"
  ON public.alumnos FOR SELECT
  TO authenticated
  USING (
    public.get_user_rol() = 'admin'
    OR public.user_has_categoria(categoria)
  );

DROP POLICY IF EXISTS "alumnos_insert_by_role" ON public.alumnos;
CREATE POLICY "alumnos_insert_by_role"
  ON public.alumnos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_rol() = 'admin'
    OR public.user_has_categoria(categoria)
  );

DROP POLICY IF EXISTS "alumnos_update_by_role" ON public.alumnos;
CREATE POLICY "alumnos_update_by_role"
  ON public.alumnos FOR UPDATE
  TO authenticated
  USING (
    public.get_user_rol() = 'admin'
    OR public.user_has_categoria(categoria)
  )
  WITH CHECK (
    public.get_user_rol() = 'admin'
    OR public.user_has_categoria(categoria)
  );

DROP POLICY IF EXISTS "alumnos_delete_by_role" ON public.alumnos;
CREATE POLICY "alumnos_delete_by_role"
  ON public.alumnos FOR DELETE
  TO authenticated
  USING (
    public.get_user_rol() = 'admin'
    OR public.user_has_categoria(categoria)
  );

-- CONVOCATORIAS
DROP POLICY IF EXISTS "convocatorias_select_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_select_by_role"
  ON public.convocatorias FOR SELECT
  TO authenticated
  USING (
    public.get_user_rol() = 'admin'
    OR public.user_has_categoria(categoria)
  );

DROP POLICY IF EXISTS "convocatorias_insert_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_insert_by_role"
  ON public.convocatorias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_rol() = 'admin'
    OR (public.user_has_categoria(categoria) AND creado_por = auth.uid())
  );

DROP POLICY IF EXISTS "convocatorias_update_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_update_by_role"
  ON public.convocatorias FOR UPDATE
  TO authenticated
  USING (
    public.get_user_rol() = 'admin'
    OR (public.user_has_categoria(categoria) AND creado_por = auth.uid())
  );

DROP POLICY IF EXISTS "convocatorias_delete_by_role" ON public.convocatorias;
CREATE POLICY "convocatorias_delete_by_role"
  ON public.convocatorias FOR DELETE
  TO authenticated
  USING (
    public.get_user_rol() = 'admin'
    OR (public.user_has_categoria(categoria) AND creado_por = auth.uid())
  );

-- ALUMNOS_CONVOCATORIA
DROP POLICY IF EXISTS "alumnos_convocatoria_select" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_select"
  ON public.alumnos_convocatoria FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.convocatorias c
      WHERE c.id = convocatoria_id
      AND (
        public.get_user_rol() = 'admin'
        OR public.user_has_categoria(c.categoria)
      )
    )
  );

DROP POLICY IF EXISTS "alumnos_convocatoria_insert" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_insert"
  ON public.alumnos_convocatoria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.convocatorias c
      WHERE c.id = convocatoria_id
      AND (
        public.get_user_rol() = 'admin'
        OR (public.user_has_categoria(c.categoria) AND c.creado_por = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "alumnos_convocatoria_delete" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_delete"
  ON public.alumnos_convocatoria FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.convocatorias c
      WHERE c.id = convocatoria_id
      AND (
        public.get_user_rol() = 'admin'
        OR (public.user_has_categoria(c.categoria) AND c.creado_por = auth.uid())
      )
    )
  );

DROP FUNCTION IF EXISTS public.get_user_categoria();
