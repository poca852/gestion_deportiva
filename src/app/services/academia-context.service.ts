import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Academia } from '../interfaces/academia.interface';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AcademiaContextService {
  /** Academia actualmente activa en la sesión */
  readonly academiaActual = signal<Academia | null>(null);
  /** Lista de academias disponibles para el usuario actual */
  readonly academiasDisponibles = signal<Academia[]>([]);
  /** Indica si se están cargando las academias */
  readonly loading = signal(false);
  /** Indica si el usuario tiene una academia seleccionada */
  readonly hasAcademia = computed(() => this.academiaActual() !== null);
  /** ID de la academia activa (cómodo para filtros) */
  readonly academiaId = computed(() => this.academiaActual()?.id ?? null);
  /** Nombre de la academia activa */
  readonly nombreAcademia = computed(() => this.academiaActual()?.nombre ?? null);

  /** Contador de cambios de academia para recargar datos */
  private switchCount = 0;

  /**
   * Versión/época del contexto de academia.
   * Se incrementa al cambiar de academia, permitiendo a los servicios
   * detectar que deben recargar sus datos aunque el academiaId sea el mismo.
   */
  readonly contextEpoch = computed(() => `${this.academiaId()}-${this.switchCount}`);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
  ) {}

  /**
   * Carga las academias disponibles. Si el usuario es super_admin,
   * carga todas las academias. Si es admin/coach, carga solo su academia.
   * Además, si hay exactamente una academia disponible, la selecciona
   * automáticamente sin hacer otra consulta a la BD.
   */
  async loadAcademias(profile: {
    rol: string;
    academia_id: string | null;
  }): Promise<void> {
    this.loading.set(true);

    try {
      if (profile.rol === 'super_admin') {
        // Super-admin: ve todas las academias
        const { data, error } = await this.supabaseService.supabase
          .from('academias')
          .select('*')
          .order('nombre');

        if (error) throw error;
        const academias = (data ?? []) as Academia[];
        this.academiasDisponibles.set(academias);

        // Auto-seleccionar si solo hay una
        if (academias.length === 1) {
          this.setAcademiaFromData(academias[0]);
        }
      } else if (profile.academia_id) {
        // Admin/coach: solo su academia
        const { data, error } = await this.supabaseService.supabase
          .from('academias')
          .select('*')
          .eq('id', profile.academia_id)
          .maybeSingle();

        if (error) throw error;
        const academias = data ? [data as Academia] : [];
        this.academiasDisponibles.set(academias);

        // Auto-seleccionar la única academia disponible
        if (academias.length === 1) {
          this.setAcademiaFromData(academias[0]);
        }
      } else {
        // Sin academia asignada
        this.academiasDisponibles.set([]);
      }
    } catch {
      this.academiasDisponibles.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Establece la academia activa a partir de los datos ya cargados,
   * sin hacer otra consulta a la BD.
   */
  private setAcademiaFromData(academia: Academia): void {
    this.academiaActual.set(academia);
    this.switchCount++;
  }

  /**
   * Selecciona una academia como activa (con consulta a Supabase).
   */
  async setAcademiaActiva(academiaId: string): Promise<boolean> {
    this.loading.set(true);

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('academias')
        .select('*')
        .eq('id', academiaId)
        .single();

      if (error || !data) {
        return false;
      }

      this.academiaActual.set(data as Academia);
      this.switchCount++;
      return true;
    } catch {
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Intenta seleccionar automáticamente la primera academia disponible.
   * Ya no hace una consulta a la BD porque los datos están en academiasDisponibles.
   */
  async autoSelectAcademia(): Promise<boolean> {
    const disponibles = this.academiasDisponibles();

    if (disponibles.length === 0) {
      return false;
    }

    if (disponibles.length === 1) {
      this.setAcademiaFromData(disponibles[0]);
      return true;
    }

    // Múltiples academias: debe elegir el usuario (no auto-seleccionamos)
    return false;
  }

  /**
   * Limpia el contexto al cerrar sesión.
   */
  clear(): void {
    this.academiaActual.set(null);
    this.academiasDisponibles.set([]);
    this.switchCount = 0;
  }
}
