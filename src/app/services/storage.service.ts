import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Servicio de almacenamiento que usa @capacitor/preferences en mobile
 * y fallback a localStorage en browser (desarrollo).
 *
 * Resuelve el problema de inconsistencia de sessionStorage/localStorage
 * en WebView de Android que causa pantallas en negro y datos corruptos
 * al minimizar/reabrir la aplicación.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  async get(key: string): Promise<string | null> {
    if (this.isNative) {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    }
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isNative) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    if (this.isNative) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    if (this.isNative) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
  }

  /**
   * Retorna todas las claves almacenadas.
   */
  async keys(): Promise<string[]> {
    if (this.isNative) {
      const { keys } = await Preferences.keys();
      return keys;
    }
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        result.push(key);
      }
    }
    return result;
  }

  /**
   * Retorna true si estamos en un entorno nativo (Capacitor mobile).
   */
  get isNativePlatform(): boolean {
    return this.isNative;
  }
}
