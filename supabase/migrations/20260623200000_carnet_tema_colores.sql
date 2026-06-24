-- Tema de carnet estándar: colores personalizables por academia (sin plantilla PNG).

ALTER TABLE public.academias
  ADD COLUMN IF NOT EXISTS carnet_color_franja_inicio TEXT NOT NULL DEFAULT '#9d0208',
  ADD COLUMN IF NOT EXISTS carnet_color_franja_fin TEXT NOT NULL DEFAULT '#e85d04',
  ADD COLUMN IF NOT EXISTS carnet_color_marco_foto TEXT NOT NULL DEFAULT '#e85d04';

COMMENT ON COLUMN public.academias.carnet_color_franja_inicio IS
  'Color izquierdo del degradado de la franja superior del carnet.';
COMMENT ON COLUMN public.academias.carnet_color_franja_fin IS
  'Color derecho del degradado de la franja superior del carnet.';
COMMENT ON COLUMN public.academias.carnet_color_marco_foto IS
  'Color del marco de la foto y del icono de calendario en el carnet.';
