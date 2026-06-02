import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AcademiaContextService } from './academia-context.service';
import { Entrenador, EntrenadorForm } from '../interfaces/entrenador.interface';

@Injectable({
  providedIn: 'root',
})
export class EntrenadoresService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly academiaContext: AcademiaContextService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private withAcademiaFilter(query: any): any {
    const academiaId = this.academiaContext.academiaId();
    if (academiaId) {
      return query.eq('academia_id', academiaId);
    }
    return query;
  }

  private buildQuery() {
    return this.supabaseService.supabase.from('entrenadores');
  }

  count(): Observable<number> {
    return from(
      (
        this.withAcademiaFilter(
          this.buildQuery().select('*', { count: 'exact', head: true })
        ) as Promise<{ count: number | null; error: unknown }>
      ).then(({ count, error }) => {
        if (error) throw this.mapError(error);
        return count ?? 0;
      })
    );
  }

  getAll(): Observable<Entrenador[]> {
    return from(
      (
        this.withAcademiaFilter(
          this.buildQuery().select('*').order('nombre')
        ) as Promise<{ data: Entrenador[] | null; error: unknown }>
      ).then(({ data, error }) => {
        if (error) throw this.mapError(error);
        return (data ?? []) as Entrenador[];
      })
    );
  }

  create(form: EntrenadorForm): Observable<Entrenador> {
    return from(this.createAsync(form));
  }

  update(id: string, form: Partial<EntrenadorForm>): Observable<Entrenador> {
    return from(
      this.buildQuery()
        .update({
          nombre: form.nombre,
          correo: form.correo,
          categorias_asignadas: form.categorias_asignadas,
          rol: form.rol,
          academia_id: form.academia_id,
        })
        .eq('id', id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw this.mapError(error);
          return data as Entrenador;
        })
    );
  }

  updatePassword(coachId: string, password: string): Observable<void> {
    return from(this.updatePasswordAsync(coachId, password));
  }

  private async updatePasswordAsync(
    coachId: string,
    password: string
  ): Promise<void> {
    const { data, error } = await this.supabaseService.supabase.functions.invoke(
      'update-coach-password',
      {
        body: { coach_id: coachId, password },
      }
    );

    if (error) {
      throw await this.mapFunctionInvokeError(error);
    }

    if (!data) {
      throw this.mapError('No se pudo actualizar la contraseña');
    }
  }

  delete(id: string): Observable<void> {
    return from(
      this.buildQuery()
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw this.mapError(error);
        })
    );
  }

  private async createAsync(form: EntrenadorForm): Promise<Entrenador> {
    if (!form.password) {
      throw new Error('La contraseña es obligatoria para nuevos entrenadores');
    }

    const body: Record<string, unknown> = {
      nombre: form.nombre,
      correo: form.correo,
      password: form.password,
      categorias_asignadas: form.categorias_asignadas,
      rol: form.rol,
    };

    // Incluir academia_id si se especificó en el formulario
    if (form.academia_id) {
      body['academia_id'] = form.academia_id;
    }

    const { data, error } = await this.supabaseService.supabase.functions.invoke(
      'create-coach',
      { body }
    );

    if (error) {
      throw await this.mapFunctionInvokeError(error);
    }

    if (!data?.data) {
      throw this.mapError(data?.error || 'Respuesta inválida al crear entrenador');
    }

    return data.data as Entrenador;
  }

  private async mapFunctionInvokeError(error: unknown): Promise<Error> {
    const response = (error as { context?: Response })?.context;
    if (response) {
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) {
          return this.mapError(body.error);
        }
      } catch {
        // Si no se puede parsear el body, usamos el mensaje base.
      }
    }

    const rawMessage =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || 'No se pudo crear el entrenador';
    return this.mapError(rawMessage);
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
      message.includes('already been registered') ||
      message.includes('already exists') ||
      message.includes('duplicate key') ||
      message.includes('entrenadores_correo_key')
    ) {
      return new Error('Ese correo ya está registrado. Usa otro correo.');
    }

    if (message.includes('invalid email')) {
      return new Error('El correo no es válido.');
    }

    if (
      message.includes('password should be at least') ||
      (message.includes('password') && message.includes('6'))
    ) {
      return new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    if (
      message.includes('only admins can create coaches') ||
      message.includes('forbidden') ||
      message.includes('not authorized') ||
      message.includes('user not allowed')
    ) {
      return new Error('Solo un administrador puede crear entrenadores.');
    }

    if (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('timeout')
    ) {
      return new Error(
        'No se pudo conectar con el servidor. Verifica tu internet e intenta de nuevo.'
      );
    }

    if (message.includes('database error creating new user')) {
      return new Error(
        'No se pudo crear la cuenta del entrenador. Contacta al administrador del sistema.'
      );
    }

    return new Error(rawMessage || 'Ocurrió un error al procesar la solicitud.');
  }
}
