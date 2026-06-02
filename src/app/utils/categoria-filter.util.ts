/** null = sin filtro (admin); string = una categoría; string[] = varias o ninguna (coach). */
export type CategoriaFilter = string | string[] | null | undefined;

/** Evita tipos recursivos profundos del cliente de Supabase. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyCategoriaFilter(query: any, categoria?: CategoriaFilter): any {
  if (categoria == null) {
    return query;
  }
  if (Array.isArray(categoria)) {
    if (categoria.length === 0) {
      return query.in('categoria', ['__none__']);
    }
    if (categoria.length === 1) {
      return query.eq('categoria', categoria[0]);
    }
    return query.in('categoria', categoria);
  }
  return query.eq('categoria', categoria);
}
