/** Muestra categoría en formato carnet: U12, U10 (sin guión). */
export function formatCategoriaCarnet(categoria: string): string {
  const trimmed = categoria.trim();
  if (!trimmed) return '';

  const uMatch = /^U-?(\d+)$/i.exec(trimmed);
  if (uMatch) {
    return `U${uMatch[1]}`;
  }

  const subMatch = /^Sub-?(\d+)$/i.exec(trimmed);
  if (subMatch) {
    return `U${subMatch[1]}`;
  }

  return trimmed;
}

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

export interface CarnetTextLineOptions {
  maxWidth?: number;
  measure?: (line: string) => number;
}

function carnetLineFits(
  line: string,
  options?: CarnetTextLineOptions
): boolean {
  if (!options?.maxWidth || !options.measure) {
    return true;
  }
  return options.measure(line) <= options.maxWidth - 2;
}

const APELLIDO_PARTICULAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'san',
  'santa',
  'von',
  'van',
  'der',
  'den',
  'du',
  'da',
  'di',
  'le',
  'mac',
  'mc',
]);

function esParticulaApellido(palabra: string): boolean {
  return APELLIDO_PARTICULAS.has(palabra.toLowerCase());
}

/**
 * Agrupa palabras en apellidos simples o compuestos.
 * Ej.: "De la Rosa Soto" → ["De la Rosa", "Soto"]
 *      "García De la Rosa" → ["García", "De la Rosa"]
 */
function groupCarnetApellidoUnits(apellidos: string): string[] {
  const words = apellidos.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const units: string[] = [];
  let i = 0;

  while (i < words.length) {
    if (esParticulaApellido(words[i])) {
      const parts = [words[i]];
      i++;
      while (i < words.length && esParticulaApellido(words[i])) {
        parts.push(words[i]);
        i++;
      }
      if (i < words.length) {
        parts.push(words[i]);
        i++;
      }
      units.push(parts.join(' '));
    } else {
      units.push(words[i]);
      i++;
    }
  }

  return units;
}

/**
 * Apellidos: una línea si cabe; si no, paterno arriba y materno abajo
 * (respeta compuestos con de/del/la/san…).
 */
export function splitCarnetApellidosLines(
  apellidos: string,
  options?: CarnetTextLineOptions
): string[] {
  const units = groupCarnetApellidoUnits(apellidos);
  if (units.length === 0) return [];
  if (units.length === 1) return [units[0]];

  const joined = units.join(' ');
  if (carnetLineFits(joined, options)) {
    return [joined];
  }

  return [units[0], units.slice(1).join(' ')];
}
