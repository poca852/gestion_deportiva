import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Academia, AcademiaForm } from '../interfaces/academia.interface';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AcademiaService {
  constructor(private readonly supabaseService: SupabaseService) {}

  getAll(): Observable<Academia[]> {
    return from(
      this.supabaseService.supabase
        .from('academias')
        .select('*')
        .order('nombre')
        .then(({ data, error }) => {
          if (error) throw this.mapError(error);
          return (data ?? []) as Academia[];
        })
    );
  }

  getById(id: string): Observable<Academia | null> {
    return from(
      this.supabaseService.supabase
        .from('academias')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw this.mapError(error);
          return (data as Academia | null) ?? null;
        })
    );
  }

  update(id: string, form: Partial<AcademiaForm>): Observable<Academia> {
    return from(
      this.supabaseService.supabase
        .from('academias')
        .update(form)
        .eq('id', id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error || !data) throw this.mapError(error);
          return data as Academia;
        })
    );
  }

  create(form: AcademiaForm): Observable<Academia> {
    return from(
      this.supabaseService.supabase
        .from('academias')
        .insert({
          nombre: form.nombre,
          direccion: form.direccion,
          logo_url: form.logo_url,
          sello_url: form.sello_url,
        })
        .select()
        .single()
        .then(({ data, error }) => {
          if (error || !data) throw this.mapError(error);
          return data as Academia;
        })
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabaseService.supabase
        .from('academias')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw this.mapError(error);
        })
    );
  }

  uploadLogo(
    file: File,
    previousLogoPath: string | null
  ): Observable<string> {
    return from(
      this.supabaseService
        .uploadAcademiaLogo(file, previousLogoPath)
        .catch((err) => {
          throw this.mapError(err);
        })
    );
  }

  uploadSello(
    file: File,
    previousSelloPath: string | null
  ): Observable<string> {
    return from(
      this.supabaseService
        .uploadAcademiaSello(file, previousSelloPath)
        .catch((err) => {
          throw this.mapError(err);
        })
    );
  }

  private mapError(error: unknown): Error {
    const rawMessage =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || 'Error inesperado';

    const message = rawMessage.toLowerCase();

    if (
      message.includes('schema cache') ||
      message.includes('could not find') ||
      message.includes('column')
    ) {
      return new Error(
        'La base de datos no está actualizada. Ejecuta la migración en Supabase.'
      );
    }

    if (
      message.includes('violates row-level security') ||
      message.includes('permission denied') ||
      message.includes('not authorized') ||
      message.includes('row-level security')
    ) {
      return new Error(
        'No tienes permiso para esta acción. Debes iniciar sesión como administrador.'
      );
    }

    if (message.includes('failed to fetch') || message.includes('network')) {
      return new Error(
        'No se pudo conectar con el servidor. Verifica tu internet e intenta de nuevo.'
      );
    }

    return new Error(rawMessage || 'No se pudo guardar la configuración.');
  }
}
