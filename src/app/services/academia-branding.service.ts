import { Injectable, inject, signal, effect } from '@angular/core';
import { Academia } from '../interfaces/academia.interface';
import { SupabaseService } from './supabase.service';
import { AcademiaContextService } from './academia-context.service';

@Injectable({
  providedIn: 'root',
})
export class AcademiaBrandingService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly academiaContext = inject(AcademiaContextService);

  readonly defaultNombre = 'Mi Academia';
  readonly nombre = signal(this.defaultNombre);
  readonly direccion = signal<string | null>(null);
  readonly logoUrl = signal<string | null>(null);
  readonly logoLoading = signal(false);
  /**
   * Indica si hay un logo disponible y resuelto exitosamente.
   * A diferencia de solo verificar logo_url en BD, esta señal
   * solo es true cuando la URL se resolvió correctamente.
   */
  readonly hasLogo = signal(false);

  /** Última ruta de almacenamiento usada para resolver la URL del logo. */
  private lastStoredPath: string | null = null;

  constructor() {
    // Reaccionar a cambios en la academia activa usando effect() (señal reactiva)
    effect(() => {
      const academia = this.academiaContext.academiaActual();
      this.applyAcademia(academia);
    });
  }

  private applyAcademia(academia: Academia | null): void {
    if (!academia) {
      this.nombre.set(this.defaultNombre);
      this.direccion.set(null);
      this.logoUrl.set(null);
      this.hasLogo.set(false);
      this.logoLoading.set(false);
      this.lastStoredPath = null;
      return;
    }

    this.nombre.set(academia.nombre);
    this.direccion.set(academia.direccion);

    if (!academia.logo_url) {
      this.logoUrl.set(null);
      this.hasLogo.set(false);
      this.logoLoading.set(false);
      this.lastStoredPath = null;
      return;
    }

    // Si es la misma ruta que ya tenemos resuelta, no hacemos nada
    if (academia.logo_url === this.lastStoredPath) {
      this.logoLoading.set(false);
      return;
    }

    // Es una ruta nueva o cambiada, resolvemos
    this.logoLoading.set(true);
    this.logoUrl.set(null);
    this.hasLogo.set(false);

    this.resolveLogo(academia.logo_url);
  }

  private async resolveLogo(logoUrl: string): Promise<void> {
    try {
      const resolved = await this.supabaseService.resolveFileUrl(logoUrl, true);
      this.logoUrl.set(resolved);
      this.hasLogo.set(resolved !== null); // Solo true si se resolvió exitosamente
      this.lastStoredPath = resolved ? logoUrl : null;
    } catch {
      this.logoUrl.set(null);
      this.hasLogo.set(false);
      this.lastStoredPath = null;
    } finally {
      this.logoLoading.set(false);
    }
  }

  /** Carga el branding desde la academia activa (útil para inicialización). */
  load(): void {
    const academia = this.academiaContext.academiaActual();
    this.applyAcademia(academia);
  }
}
