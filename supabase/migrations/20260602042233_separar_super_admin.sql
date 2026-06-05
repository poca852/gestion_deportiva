-- ==============================================================
-- Separar super_admin a tabla propia
-- ==============================================================

-- Crear tabla de super_admins
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para super_admins
CREATE POLICY "super_admins_select_self"
  ON public.super_admins FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.super_admins WHERE id = auth.uid()));

CREATE POLICY "super_admins_insert_first"
  ON public.super_admins FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND (SELECT count(*) FROM public.super_admins) = 0);

CREATE POLICY "super_admins_delete_self"
  ON public.super_admins FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- Mover a David de entrenadores a super_admins
INSERT INTO public.super_admins (id)
SELECT id FROM public.entrenadores WHERE id = 'bf492748-4feb-42d9-be48-d9f415250c2b'
ON CONFLICT (id) DO NOTHING;

-- Eliminar a David de entrenadores (ya no debe estar ahí)
DELETE FROM public.entrenadores WHERE id = 'bf492748-4feb-42d9-be48-d9f415250c2b';

-- Actualizar función helper: get_user_es_super_admin consulta super_admins
CREATE OR REPLACE FUNCTION public.get_user_es_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_user_es_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_es_super_admin() TO authenticated;

-- Actualizar user_has_categoria (solo admin, ya no super_admin)
CREATE OR REPLACE FUNCTION public.user_has_categoria(p_categoria TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    public.get_user_rol() = 'admin'
    OR (
      p_categoria IS NOT NULL
      AND p_categoria = ANY(public.get_user_categorias())
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Actualizar trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_nombre text;
  v_total_entrenadores int;
  v_total_super int;
BEGIN
  SELECT count(*) INTO v_total_super FROM public.super_admins;
  SELECT count(*) INTO v_total_entrenadores FROM public.entrenadores;

  IF v_total_super = 0 AND v_total_entrenadores = 0 THEN
    INSERT INTO public.super_admins (id)
    VALUES (new.id);
    RETURN new;
  END IF;

  v_nombre := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Entrenador'
  );

  INSERT INTO public.entrenadores (id, nombre, correo, categorias_asignadas, rol, academia_id)
  VALUES (
    new.id,
    v_nombre,
    coalesce(new.email, new.id::text || '@local.invalid'),
    '{}'::text[],
    'coach'::rol_entrenador,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET correo = excluded.correo;

  RETURN new;
END;
$$;

-- RLS: ACADEMIAS
DROP POLICY IF EXISTS "academias_select_authenticated" ON public.academias;
CREATE POLICY "academias_select_authenticated"
  ON public.academias FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR public.user_belongs_to_academia(id)
  );

DROP POLICY IF EXISTS "academias_insert_super_admin" ON public.academias;
CREATE POLICY "academias_insert_super_admin"
  ON public.academias FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_es_super_admin());

DROP POLICY IF EXISTS "academias_update_by_member" ON public.academias;
CREATE POLICY "academias_update_by_member"
  ON public.academias FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND public.user_belongs_to_academia(id))
  )
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND public.user_belongs_to_academia(id))
  );

DROP POLICY IF EXISTS "academias_delete_super_admin" ON public.academias;
CREATE POLICY "academias_delete_super_admin"
  ON public.academias FOR DELETE
  TO authenticated
  USING (public.get_user_es_super_admin());

-- RLS: ENTRENADORES
DROP POLICY IF EXISTS "entrenadores_select_authenticated" ON public.entrenadores;
CREATE POLICY "entrenadores_select_authenticated"
  ON public.entrenadores FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "entrenadores_insert_admin" ON public.entrenadores;
CREATE POLICY "entrenadores_insert_admin"
  ON public.entrenadores FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  );

DROP POLICY IF EXISTS "entrenadores_update_admin" ON public.entrenadores;
CREATE POLICY "entrenadores_update_admin"
  ON public.entrenadores FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  )
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  );

DROP POLICY IF EXISTS "entrenadores_delete_admin" ON public.entrenadores;
CREATE POLICY "entrenadores_delete_admin"
  ON public.entrenadores FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (public.get_user_rol() = 'admin' AND academia_id = public.get_user_academia_id())
  );

-- RLS: ALUMNOS
DROP POLICY IF EXISTS "alumnos_select_by_academia" ON public.alumnos;
CREATE POLICY "alumnos_select_by_academia"
  ON public.alumnos FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "alumnos_insert_by_academia" ON public.alumnos;
CREATE POLICY "alumnos_insert_by_academia"
  ON public.alumnos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "alumnos_update_by_academia" ON public.alumnos;
CREATE POLICY "alumnos_update_by_academia"
  ON public.alumnos FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  )
  WITH CHECK (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "alumnos_delete_by_academia" ON public.alumnos;
CREATE POLICY "alumnos_delete_by_academia"
  ON public.alumnos FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

-- RLS: CONVOCATORIAS
DROP POLICY IF EXISTS "convocatorias_select_by_academia" ON public.convocatorias;
CREATE POLICY "convocatorias_select_by_academia"
  ON public.convocatorias FOR SELECT
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR academia_id = public.get_user_academia_id()
  );

DROP POLICY IF EXISTS "convocatorias_insert_by_academia" ON public.convocatorias;
CREATE POLICY "convocatorias_insert_by_academia"
  ON public.convocatorias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

DROP POLICY IF EXISTS "convocatorias_update_by_academia" ON public.convocatorias;
CREATE POLICY "convocatorias_update_by_academia"
  ON public.convocatorias FOR UPDATE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

DROP POLICY IF EXISTS "convocatorias_delete_by_academia" ON public.convocatorias;
CREATE POLICY "convocatorias_delete_by_academia"
  ON public.convocatorias FOR DELETE
  TO authenticated
  USING (
    public.get_user_es_super_admin()
    OR (academia_id = public.get_user_academia_id() AND creado_por = auth.uid())
  );

-- RLS: ALUMNOS_CONVOCATORIA
DROP POLICY IF EXISTS "alumnos_convocatoria_select" ON public.alumnos_convocatoria;
CREATE POLICY "alumnos_convocatoria_select"
  ON public.alumnos_convocatoria FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.convocatorias c
      WHERE c.id = convocatoria_id
      AND (
        public.get_user_es_super_admin()
        OR c.academia_id = public.get_user_academia_id()
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
        public.get_user_es_super_admin()
        OR (c.academia_id = public.get_user_academia_id() AND c.creado_por = auth.uid())
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
        public.get_user_es_super_admin()
        OR (c.academia_id = public.get_user_academia_id() AND c.creado_por = auth.uid())
      )
    )
  );

-- STORAGE RLS
DROP POLICY IF EXISTS "storage_expedientes_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage_expedientes_delete_authenticated" ON storage.objects;

CREATE POLICY "storage_expedientes_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
  );

CREATE POLICY "storage_expedientes_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR (
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia')
        AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin')
      )
      OR (
        (storage.foldername(name))[2] = 'firmas-convocatoria'
        AND (
          public.get_user_es_super_admin()
          OR public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid
              AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin')
          )
        )
      )
    )
  );

CREATE POLICY "storage_expedientes_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
  )
  WITH CHECK (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR (
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia')
        AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin')
      )
      OR (
        (storage.foldername(name))[2] = 'firmas-convocatoria'
        AND (
          public.get_user_es_super_admin()
          OR public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid
              AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin')
          )
        )
      )
    )
  );

CREATE POLICY "storage_expedientes_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expedientes-academia'
    AND public.is_authenticated_entrenador()
    AND (
      public.get_user_es_super_admin()
      OR public.get_academia_id_from_storage_path(name) = public.get_user_academia_id()
    )
    AND (
      (storage.foldername(name))[2] IN ('fotos-estudiante', 'documentos', 'documentos-padre')
      OR (
        (storage.foldername(name))[2] IN ('logos-academia', 'sellos-academia')
        AND (public.get_user_es_super_admin() OR public.get_user_rol() = 'admin')
      )
      OR (
        (storage.foldername(name))[2] = 'firmas-convocatoria'
        AND (
          public.get_user_es_super_admin()
          OR public.get_user_rol() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.convocatorias c
            WHERE c.id = regexp_replace(split_part(name, '/', 3), '\.[^.]*$', '')::uuid
              AND (c.creado_por = auth.uid() OR public.get_user_rol() = 'admin')
          )
        )
      )
    )
  );
