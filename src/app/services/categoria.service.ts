import { Injectable } from '@angular/core';
import {
  calcularCategoria as calcularCategoriaFromCatalog,
  CATEGORIAS,
  Categoria,
  isCategoriaValida,
  normalizeCategoriasAsignadas,
  validateCategoriasAsignadas,
} from '../../../supabase/functions/_shared/categorias';

export {
  CATEGORIAS,
  Categoria,
  isCategoriaValida,
  normalizeCategoriasAsignadas,
  validateCategoriasAsignadas,
};

@Injectable({
  providedIn: 'root',
})
export class CategoriaService {
  readonly all = CATEGORIAS;

  getAll(): readonly Categoria[] {
    return CATEGORIAS;
  }

  calcularCategoria(fechaNacimiento: string | Date): Categoria {
    return calcularCategoriaFromCatalog(fechaNacimiento);
  }

  isValid(value: string): value is Categoria {
    return isCategoriaValida(value);
  }

  normalizeAsignadas(value: unknown): Categoria[] {
    return normalizeCategoriasAsignadas(value);
  }

  validateAsignadas(value: unknown): {
    valid: Categoria[];
    invalid: string[];
  } {
    return validateCategoriasAsignadas(value);
  }
}
