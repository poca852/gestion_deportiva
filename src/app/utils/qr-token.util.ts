const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PERFIL_PATH_PATTERN =
  /\/perfil\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;

/** Extrae el public_token de una URL de perfil o de un UUID en bruto. */
export function extractPublicTokenFromQr(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const pathMatch = trimmed.match(PERFIL_PATH_PATTERN);
  if (pathMatch?.[1]) {
    return pathMatch[1].toLowerCase();
  }

  if (UUID_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}
