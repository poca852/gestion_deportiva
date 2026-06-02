import { Injectable } from '@angular/core';

export const CATEGORIAS = [
  'U8',
  'U10',
  'U12',
  'U14',
  'U16',
  'U18',
  'U20',
  'Senior',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

@Injectable({
  providedIn: 'root',
})
export class CategoriaService {
  calcularCategoria(fechaNacimiento: string | Date): Categoria {
    const fecha =
      typeof fechaNacimiento === 'string'
        ? new Date(fechaNacimiento + 'T00:00:00')
        : fechaNacimiento;

    const edad = new Date().getFullYear() - fecha.getFullYear();

    if (edad <= 8) return 'U8';
    if (edad <= 10) return 'U10';
    if (edad <= 12) return 'U12';
    if (edad <= 14) return 'U14';
    if (edad <= 16) return 'U16';
    if (edad <= 18) return 'U18';
    if (edad <= 20) return 'U20';
    return 'Senior';
  }
}
