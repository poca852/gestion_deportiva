import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { Alumno, AlumnoForm } from '../interfaces/alumno.interface';
import { Convocatoria } from '../interfaces/convocatoria.interface';
import { AcademiaContextService } from './academia-context.service';
import {
  applyCategoriaFilter,
  CategoriaFilter,
} from '../utils/categoria-filter.util';

export interface AlumnosStats {
  total: number;
  porCategoria: { categoria: string; total: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class AlumnosService {
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
    // Super-admin sin academia seleccionada: sin filtro
    return query;
  }

  private buildQuery() {
    return this.supabaseService.supabase.from('alumnos');
  }

  getAll(categoria?: CategoriaFilter): Observable<Alumno[]> {
    let query = this.withAcademiaFilter(
      this.buildQuery().select('*').order('apellidos')
    );
    query = applyCategoriaFilter(query, categoria);

    return from(
      (query as Promise<{ data: Alumno[] | null; error: unknown }>).then(
        ({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Alumno[];
        }
      )
    );
  }

  getAllPaginated(opts: {
    categoria?: CategoriaFilter;
    search?: string;
    page: number;
    perPage: number;
  }): Observable<{ data: Alumno[]; count: number }> {
    const rangeStart = opts.page * opts.perPage;
    const rangeEnd = rangeStart + opts.perPage - 1;

    let query = this.withAcademiaFilter(
      this.buildQuery()
        .select('*', { count: 'exact', head: false })
        .order('apellidos')
        .range(rangeStart, rangeEnd)
    );

    query = applyCategoriaFilter(query, opts.categoria);

    if (opts.search) {
      const term = `%${opts.search}%`;
      query = query.or(
        `nombres.ilike.${term},apellidos.ilike.${term},nombre_tutor.ilike.${term},telefono_tutor.ilike.${term}`
      );
    }

    return from(
      (
        query as Promise<{
          data: Alumno[] | null;
          error: unknown;
          count: number | null;
        }>
      ).then(({ data, error, count }) => {
        if (error) throw error;
        return {
          data: (data ?? []) as Alumno[],
          count: count ?? 0,
        };
      })
    );
  }

  getById(id: string): Observable<Alumno> {
    return from(
      this.buildQuery()
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Alumno;
        })
    );
  }

  create(form: AlumnoForm): Observable<Alumno> {
    const academiaId = this.academiaContext.academiaId();
    const record = academiaId ? { ...form, academia_id: academiaId } : form;

    return from(
      this.buildQuery()
        .insert(record)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Alumno;
        })
    );
  }

  update(id: string, form: Partial<AlumnoForm> & { updated_at?: string }): Observable<Alumno> {
    let query = this.buildQuery()
      .update(form)
      .eq('id', id);

    if (form.updated_at) {
      query = query.eq('updated_at', form.updated_at);
    }

    return from(
      query
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            if ('code' in error && error.code === 'PGRST204') {
              throw new Error(
                'El alumno fue modificado por otro usuario. Recarga y vuelve a intentar.'
              );
            }
            throw error;
          }
          return data as Alumno;
        })
    );
  }

  delete(id: string): Observable<void> {
    return from(this.deleteAsync(id));
  }

  private async deleteAsync(id: string): Promise<void> {
    let alumno: {
      foto_estudiante_url: string | null;
      foto_documento_url: string | null;
      foto_documento_padre_url: string | null;
    } | null = null;
    try {
      const { data, error: fetchError } =
        await this.buildQuery()
          .select(
            'foto_estudiante_url, foto_documento_url, foto_documento_padre_url'
          )
          .eq('id', id)
          .single();
      if (fetchError) throw fetchError;
      alumno = data;
    } catch {
      // Continuar igual aunque falle la consulta
    }

    const { error } = await this.buildQuery()
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (alumno) {
      try {
        await this.supabaseService.removeExpedientesByStored(
          alumno.foto_estudiante_url,
          alumno.foto_documento_url,
          alumno.foto_documento_padre_url
        );
      } catch {
        // Fallo en limpieza de archivos no debe bloquear la eliminación
      }
    }
  }

  getConvocatoriasByAlumnoId(
    alumnoId: string
  ): Observable<Convocatoria[]> {
    return from(
      this.supabaseService.supabase
        .from('alumnos_convocatoria')
        .select('convocatoria:convocatorias(*)')
        .eq('alumno_id', alumnoId)
        .then(({ data, error }) => {
          if (error) throw error;

          const convocatorias = (data ?? [])
            .map(
              (row: {
                convocatoria: Convocatoria | Convocatoria[] | null;
              }) => {
                const conv = row.convocatoria;
                return Array.isArray(conv) ? conv[0] : conv;
              }
            )
            .filter((c): c is Convocatoria => !!c)
            .sort((a, b) => b.fecha.localeCompare(a.fecha));

          return convocatorias;
        })
    );
  }

  getStats(categoria?: CategoriaFilter): Observable<AlumnosStats> {
    let query = this.withAcademiaFilter(
      this.buildQuery().select('categoria')
    );
    query = applyCategoriaFilter(query, categoria);

    return from(
      (
        query as Promise<{ data: { categoria: string }[] | null; error: unknown }>
      ).then(({ data, error }) => {
        if (error) throw error;

        const counts = new Map<string, number>();
        for (const row of data ?? []) {
          const cat = row.categoria as string;
          counts.set(cat, (counts.get(cat) ?? 0) + 1);
        }

        const porCategoria = [...counts.entries()]
          .map(([c, total]) => ({ categoria: c, total }))
          .sort((a, b) => a.categoria.localeCompare(b.categoria));

        return { total: data?.length ?? 0, porCategoria };
      })
    );
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
}
