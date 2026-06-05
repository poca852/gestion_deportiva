-- Corrige handle_new_user tras migrar categoria_asignada -> categorias_asignadas

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_nombre text;
  v_rol rol_entrenador;
BEGIN
  v_nombre := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Entrenador'
  );

  v_rol := CASE
    WHEN (SELECT count(*) FROM public.entrenadores) = 0 THEN 'admin'::rol_entrenador
    ELSE 'coach'::rol_entrenador
  END;

  INSERT INTO public.entrenadores (id, nombre, correo, categorias_asignadas, rol)
  VALUES (
    new.id,
    v_nombre,
    coalesce(new.email, new.id::text || '@local.invalid'),
    '{}'::text[],
    v_rol
  )
  ON CONFLICT (id) DO UPDATE
    SET correo = excluded.correo;

  RETURN new;
END;
$$;
