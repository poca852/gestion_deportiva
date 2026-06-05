/**
 * Catálogo canónico de categorías de baloncesto.
 * Fuente única compartida entre Angular y Edge Functions.
 * Mantener sincronizado con la migración SQL `categorias_catalogo_validacion`.
 */
export const CATEGORIA_CATALOG = [
  { id: 'Mosquito', maxAge: 6, porEdad: true },
  { id: 'U8', maxAge: 8, porEdad: true },
  { id: 'U10', maxAge: 10, porEdad: true },
  { id: 'U12', maxAge: 12, porEdad: true },
  { id: 'U14', maxAge: 14, porEdad: true },
  { id: 'U16', maxAge: 16, porEdad: true },
  { id: 'U18', maxAge: 18, porEdad: true },
  { id: 'U20', maxAge: 20, porEdad: true },
  { id: 'Senior', maxAge: null, porEdad: true },
  { id: 'Libre', maxAge: null, porEdad: false },
] as const;

export type Categoria = (typeof CATEGORIA_CATALOG)[number]['id'];

export const CATEGORIAS: readonly Categoria[] = CATEGORIA_CATALOG.map(
  (entry) => entry.id
);

const CATEGORIAS_SET = new Set<string>(CATEGORIAS);

export function isCategoriaValida(value: string): value is Categoria {
  return CATEGORIAS_SET.has(value);
}

export function calcularCategoria(fechaNacimiento: string | Date): Categoria {
  const fecha =
    typeof fechaNacimiento === 'string'
      ? new Date(fechaNacimiento + 'T00:00:00')
      : fechaNacimiento;

  const edad = new Date().getFullYear() - fecha.getFullYear();

  for (const entry of CATEGORIA_CATALOG) {
    if (!entry.porEdad) {
      continue;
    }
    if (entry.maxAge !== null && edad <= entry.maxAge) {
      return entry.id;
    }
  }

  return 'Senior';
}

export function normalizeCategoriasAsignadas(value: unknown): Categoria[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => String(item).trim())
        .filter((item): item is Categoria => isCategoriaValida(item))
    ),
  ];
}

export function validateCategoriasAsignadas(value: unknown): {
  valid: Categoria[];
  invalid: string[];
} {
  if (!Array.isArray(value)) {
    return { valid: [], invalid: [] };
  }

  const trimmed = [
    ...new Set(value.map((item) => String(item).trim()).filter(Boolean)),
  ];
  const valid = trimmed.filter((item): item is Categoria => isCategoriaValida(item));
  const invalid = trimmed.filter((item) => !isCategoriaValida(item));

  return { valid, invalid };
}
