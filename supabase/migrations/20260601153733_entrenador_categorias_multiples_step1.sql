ALTER TABLE public.entrenadores
  ADD COLUMN IF NOT EXISTS categorias_asignadas TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.entrenadores
SET categorias_asignadas = ARRAY[categoria_asignada]
WHERE categoria_asignada IS NOT NULL
  AND categoria_asignada <> ''
  AND categorias_asignadas = '{}';
