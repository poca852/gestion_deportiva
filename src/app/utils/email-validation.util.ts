import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Patrón práctico: usuario@dominio con TLD de al menos 2 caracteres. */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email) {
    return false;
  }
  return EMAIL_REGEX.test(email);
}

export function emailValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') {
      return null;
    }
    return isValidEmail(String(value)) ? null : { email: true };
  };
}
