export function mapCategoriaConstraintError(rawMessage: string): string | null {
  const message = rawMessage.toLowerCase();

  if (
    message.includes('alumnos_categoria_valida') ||
    message.includes('convocatorias_categoria_valida') ||
    message.includes('entrenadores_categorias_asignadas_validas') ||
    message.includes('is_categoria_valida') ||
    message.includes('are_categorias_asignadas_validas')
  ) {
    return 'La categoría seleccionada no es válida.';
  }

  if (message.includes('categorías no válidas')) {
    return rawMessage;
  }

  return null;
}
