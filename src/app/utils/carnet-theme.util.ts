import {
  CarnetTheme,
  DEFAULT_CARNET_THEME,
} from '../interfaces/carnet-theme.interface';
import { Academia } from '../interfaces/academia.interface';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

export function normalizeHexColor(
  value: string | null | undefined,
  fallback: string
): string {
  const trimmed = value?.trim() ?? '';
  return isValidHexColor(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function themeFromAcademia(
  academia: Pick<
    Academia,
    'carnet_color_franja_inicio' | 'carnet_color_franja_fin' | 'carnet_color_marco_foto'
  > | null | undefined
): CarnetTheme {
  if (!academia) {
    return { ...DEFAULT_CARNET_THEME };
  }

  return {
    franjaInicio: normalizeHexColor(
      academia.carnet_color_franja_inicio,
      DEFAULT_CARNET_THEME.franjaInicio
    ),
    franjaFin: normalizeHexColor(
      academia.carnet_color_franja_fin,
      DEFAULT_CARNET_THEME.franjaFin
    ),
    marcoFoto: normalizeHexColor(
      academia.carnet_color_marco_foto,
      DEFAULT_CARNET_THEME.marcoFoto
    ),
  };
}

export function carnetStripeGradient(theme: CarnetTheme): string {
  return `linear-gradient(90deg, ${theme.franjaInicio} 0%, ${theme.franjaFin} 100%)`;
}
