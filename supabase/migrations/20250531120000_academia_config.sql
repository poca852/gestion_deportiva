-- Migración: tabla academia_config (configuración global de la academia)
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Requiere que ya existan: public.set_updated_at(), public.get_user_rol()

CREATE TABLE IF NOT EXISTS public.academia_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_academia_config_updated_at ON public.academia_config;
CREATE TRIGGER trg_academia_config_updated_at
  BEFORE UPDATE ON public.academia_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.academia_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academia_config_select_authenticated" ON public.academia_config;
CREATE POLICY "academia_config_select_authenticated"
  ON public.academia_config FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "academia_config_insert_admin" ON public.academia_config;
CREATE POLICY "academia_config_insert_admin"
  ON public.academia_config FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_rol() = 'admin');

DROP POLICY IF EXISTS "academia_config_update_admin" ON public.academia_config;
CREATE POLICY "academia_config_update_admin"
  ON public.academia_config FOR UPDATE
  TO authenticated
  USING (public.get_user_rol() = 'admin')
  WITH CHECK (public.get_user_rol() = 'admin');

INSERT INTO public.academia_config (id, nombre, direccion, logo_url)
VALUES (true, 'Academia Real Libertad', 'Dirección pendiente', NULL)
ON CONFLICT (id) DO NOTHING;
