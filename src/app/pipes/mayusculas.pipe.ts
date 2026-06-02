import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'mayusculas',
  standalone: true,
})
export class MayusculasPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null || value === '') {
      return '';
    }
    return value.toLocaleUpperCase('es-ES');
  }
}
