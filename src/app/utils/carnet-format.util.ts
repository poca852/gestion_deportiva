export function formatFechaCortaCarnet(fecha: string): string {
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function slugifyCarnetText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/^_+|_+$/g, '');
}
