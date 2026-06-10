import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AcademiaContextService } from './academia-context.service';
import {
  AlumnoConvocatoria,
  Convocatoria,
  ConvocatoriaConPlantilla,
  ConvocatoriaForm,
} from '../interfaces/convocatoria.interface';
import { Alumno } from '../interfaces/alumno.interface';
import {
  applyCategoriaFilter,
  CategoriaFilter,
} from '../utils/categoria-filter.util';

@Injectable({
  providedIn: 'root',
})
export class ConvocatoriasService {
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
    return this.supabaseService.supabase.from('convocatorias');
  }

  getAll(categoria?: CategoriaFilter): Observable<Convocatoria[]> {
    let query = this.withAcademiaFilter(
      this.buildQuery()
        .select('*')
        .order('fecha', { ascending: false })
    );

    query = applyCategoriaFilter(query, categoria);

    return from(
      (
        query as Promise<{ data: Convocatoria[] | null; error: unknown }>
      ).then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as Convocatoria[];
      })
    );
  }

  getWithPlantilla(id: string): Observable<ConvocatoriaConPlantilla> {
    return from(this.getWithPlantillaAsync(id));
  }

  create(form: ConvocatoriaForm, creadoPor: string): Observable<Convocatoria> {
    return from(this.createAsync(form, creadoPor));
  }

  update(id: string, form: ConvocatoriaForm): Observable<Convocatoria> {
    return from(this.updateAsync(id, form));
  }

  saveFirma(id: string, firmaPath: string): Observable<Convocatoria> {
    return from(
      this.buildQuery()
        .update({ firma_entrenador_url: firmaPath })
        .eq('id', id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Convocatoria;
        })
    );
  }

  delete(id: string, firmaUrl?: string | null): Observable<void> {
    return from(this.deleteAsync(id, firmaUrl));
  }

  count(categoria?: CategoriaFilter): Observable<number> {
    let query = this.withAcademiaFilter(
      this.buildQuery().select('*', { count: 'exact', head: true })
    );

    query = applyCategoriaFilter(query, categoria);

    return from(
      (
        query as Promise<{ count: number | null; error: unknown }>
      ).then(({ count, error }) => {
        if (error) throw error;
        return count ?? 0;
      })
    );
  }

  private async deleteAsync(
    id: string,
    firmaUrl?: string | null
  ): Promise<void> {
    const { error: relError } = await this.supabaseService.supabase
      .from('alumnos_convocatoria')
      .delete()
      .eq('convocatoria_id', id);

    if (relError) throw relError;

    await this.supabaseService.removeExpedientesByStored(firmaUrl);

    const { data, error: convError } = await this.buildQuery()
      .delete()
      .eq('id', id)
      .select();

    if (convError) throw convError;

    if (!data || data.length === 0) {
      throw new Error(
        'No se pudo eliminar la convocatoria. Es posible que no tengas permisos o ya haya sido eliminada.'
      );
    }
  }

  private async getWithPlantillaAsync(
    id: string
  ): Promise<ConvocatoriaConPlantilla> {
    const { data: convocatoria, error: convError } =
      await this.buildQuery()
        .select('*')
        .eq('id', id)
        .single();

    if (convError) throw convError;

    const { data: relaciones, error: relError } =
      await this.supabaseService.supabase
        .from('alumnos_convocatoria')
        .select('*, alumno:alumnos(*)')
        .eq('convocatoria_id', id);

    if (relError) throw relError;

    const alumnos = (relaciones ?? [])
      .map((r: AlumnoConvocatoria & { alumno: Alumno }) => r.alumno)
      .filter(Boolean)
      .sort((a, b) => a.apellidos.localeCompare(b.apellidos));

    return {
      ...(convocatoria as Convocatoria),
      alumnos,
    };
  }

  private async createAsync(
    form: ConvocatoriaForm,
    creadoPor: string
  ): Promise<Convocatoria> {
    const { alumno_ids, ...convocatoriaData } = form;
    const academiaId = this.academiaContext.academiaId();
    const record = academiaId
      ? { ...convocatoriaData, creado_por: creadoPor, academia_id: academiaId }
      : { ...convocatoriaData, creado_por: creadoPor };

    const { data: convocatoria, error: convError } =
      await this.buildQuery()
        .insert(record)
        .select()
        .single();

    if (convError) throw convError;

    if (alumno_ids.length > 0) {
      const rows = alumno_ids.map((alumnoId) => ({
        convocatoria_id: convocatoria.id,
        alumno_id: alumnoId,
      }));

      const { error: relError } = await this.supabaseService.supabase
        .from('alumnos_convocatoria')
        .insert(rows);

      if (relError) throw relError;
    }

    return convocatoria as Convocatoria;
  }

  private async updateAsync(
    id: string,
    form: ConvocatoriaForm
  ): Promise<Convocatoria> {
    const { data: convocatoria, error: convError } =
      await this.buildQuery()
        .update({
          nombre_evento: form.nombre_evento,
          fecha: form.fecha,
          categoria: form.categoria,
        })
        .eq('id', id)
        .select()
        .single();

    if (convError) throw convError;

    const { error: delError } = await this.supabaseService.supabase
      .from('alumnos_convocatoria')
      .delete()
      .eq('convocatoria_id', id);

    if (delError) throw delError;

    if (form.alumno_ids.length > 0) {
      const rows = form.alumno_ids.map((alumnoId) => ({
        convocatoria_id: id,
        alumno_id: alumnoId,
      }));

      const { error: relError } = await this.supabaseService.supabase
        .from('alumnos_convocatoria')
        .insert(rows);

      if (relError) throw relError;
    }

    return convocatoria as Convocatoria;
  }
}
