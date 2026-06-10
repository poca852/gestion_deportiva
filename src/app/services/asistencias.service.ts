import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Alumno } from '../interfaces/alumno.interface';
import {
  AsistenciaConAlumno,
  MetodoAsistencia,
  RegistroAsistenciaResult,
} from '../interfaces/asistencia.interface';
import {
  CierreSesionResult,
  ResumenAsistenciaAlumno,
  SesionConStats,
  SesionEntrenamiento,
} from '../interfaces/sesion-entrenamiento.interface';
import { AcademiaContextService } from './academia-context.service';
import { SupabaseService } from './supabase.service';

type AlumnoAsistencia = {
  id: string;
  nombres: string;
  apellidos: string;
  categoria: string;
  academia_id: string;
};

@Injectable({
  providedIn: 'root',
})
export class AsistenciasService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly academiaContext: AcademiaContextService
  ) {}

  private buildAsistenciasQuery() {
    return this.supabaseService.supabase.from('asistencias');
  }

  private buildSesionesQuery() {
    return this.supabaseService.supabase.from('sesiones_entrenamiento');
  }

  getSesionesHoy(fecha?: string): Observable<SesionConStats[]> {
    const targetDate = fecha ?? this.localDateString();
    const academiaId = this.academiaContext.academiaId();

    let query = this.buildSesionesQuery()
      .select(
        `
        *,
        asistencias(count)
      `
      )
      .eq('fecha', targetDate)
      .order('categoria');

    if (academiaId) {
      query = query.eq('academia_id', academiaId);
    }

    return from(
      query.then(({ data, error }) => {
        if (error) throw error;

        return (data ?? []).map((row) => {
          const asistencias = row.asistencias as { count: number }[] | null;
          const presentes = asistencias?.[0]?.count ?? 0;
          const { asistencias: _omit, ...sesion } = row as SesionEntrenamiento & {
            asistencias: { count: number }[];
          };

          return {
            ...(sesion as SesionEntrenamiento),
            presentes,
          };
        });
      })
    );
  }

  getHoy(fecha?: string): Observable<AsistenciaConAlumno[]> {
    const targetDate = fecha ?? this.localDateString();
    const academiaId = this.academiaContext.academiaId();

    let query = this.buildAsistenciasQuery()
      .select(
        `
        *,
        alumno:alumnos(id, nombres, apellidos, categoria, foto_estudiante_url)
      `
      )
      .eq('fecha', targetDate)
      .order('created_at', { ascending: false });

    if (academiaId) {
      query = query.eq('academia_id', academiaId);
    }

    return from(
      query.then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as AsistenciaConAlumno[];
      })
    );
  }

  registrar(
    alumnoId: string,
    metodo: MetodoAsistencia,
    registradoPor: string,
    fecha?: string
  ): Observable<RegistroAsistenciaResult> {
    return from(this.registrarAsync(alumnoId, metodo, registradoPor, fecha));
  }

  registrarPorPublicToken(
    publicToken: string,
    registradoPor: string,
    fecha?: string
  ): Observable<RegistroAsistenciaResult> {
    return from(
      this.registrarPorPublicTokenAsync(publicToken, registradoPor, fecha)
    );
  }

  cerrarSesion(
    sesionId: string,
    cerradaPor: string
  ): Observable<CierreSesionResult> {
    return from(this.cerrarSesionAsync(sesionId, cerradaPor));
  }

  getResumenAlumno(
    alumnoId: string,
    desde?: string,
    hasta?: string
  ): Observable<ResumenAsistenciaAlumno> {
    return from(this.getResumenAlumnoAsync(alumnoId, desde, hasta));
  }

  private async registrarPorPublicTokenAsync(
    publicToken: string,
    registradoPor: string,
    fecha?: string
  ): Promise<RegistroAsistenciaResult> {
    const academiaId = this.academiaContext.academiaId();

    let alumnoQuery = this.supabaseService.supabase
      .from('alumnos')
      .select('id, nombres, apellidos, categoria, academia_id')
      .eq('public_token', publicToken);

    if (academiaId) {
      alumnoQuery = alumnoQuery.eq('academia_id', academiaId);
    }

    const { data: alumno, error: alumnoError } = await alumnoQuery.maybeSingle();

    if (alumnoError) {
      throw alumnoError;
    }

    if (!alumno) {
      return {
        status: 'not_found',
        message: 'No se encontró un alumno con ese código QR',
      };
    }

    return this.registrarAsync(alumno.id, 'qr', registradoPor, fecha, alumno);
  }

  private async registrarAsync(
    alumnoId: string,
    metodo: MetodoAsistencia,
    registradoPor: string,
    fecha?: string,
    alumnoPrecargado?: AlumnoAsistencia
  ): Promise<RegistroAsistenciaResult> {
    const targetDate = fecha ?? this.localDateString();
    const academiaId = this.academiaContext.academiaId();

    if (!academiaId) {
      throw new Error('No hay academia seleccionada');
    }

    let alumno = alumnoPrecargado;
    if (!alumno) {
      const { data, error } = await this.supabaseService.supabase
        .from('alumnos')
        .select('id, nombres, apellidos, categoria, academia_id')
        .eq('id', alumnoId)
        .eq('academia_id', academiaId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return {
          status: 'not_found',
          message: 'Alumno no encontrado en esta academia',
        };
      }
      alumno = data;
    }

    const sesionResult = await this.obtenerOCrearSesionAbierta(
      academiaId,
      targetDate,
      alumno.categoria,
      registradoPor
    );

    if (sesionResult.status === 'closed') {
      return {
        status: 'session_closed',
        alumno,
        message: `La sesión de ${alumno.categoria} ya fue cerrada hoy. No se pueden registrar más asistencias.`,
      };
    }

    const sesion = sesionResult.sesion;

    const { data: existing, error: existingError } =
      await this.buildAsistenciasQuery()
        .select('id, created_at')
        .eq('alumno_id', alumnoId)
        .eq('sesion_id', sesion.id)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return {
        status: 'duplicate',
        alumno,
        horaRegistro: this.formatHora(existing.created_at),
        message: `${alumno.nombres} ${alumno.apellidos} ya registró asistencia en la sesión de ${alumno.categoria}`,
      };
    }

    const { data: inserted, error: insertError } =
      await this.buildAsistenciasQuery()
        .insert({
          alumno_id: alumnoId,
          academia_id: academiaId,
          sesion_id: sesion.id,
          fecha: targetDate,
          registrado_por: registradoPor,
          metodo,
        })
        .select(
          `
          *,
          alumno:alumnos(id, nombres, apellidos, categoria, foto_estudiante_url)
        `
        )
        .single();

    if (insertError) {
      if ('code' in insertError && insertError.code === '23505') {
        return {
          status: 'duplicate',
          alumno,
          message: `${alumno.nombres} ${alumno.apellidos} ya registró asistencia en la sesión de ${alumno.categoria}`,
        };
      }
      throw insertError;
    }

    return {
      status: 'ok',
      asistencia: inserted as AsistenciaConAlumno,
    };
  }

  private async obtenerOCrearSesionAbierta(
    academiaId: string,
    fecha: string,
    categoria: string,
    abiertaPor: string
  ): Promise<
    | { status: 'ok'; sesion: SesionEntrenamiento }
    | { status: 'closed'; sesion: SesionEntrenamiento }
  > {
    const { data: existing, error: existingError } =
      await this.buildSesionesQuery()
        .select('*')
        .eq('academia_id', academiaId)
        .eq('fecha', fecha)
        .eq('categoria', categoria)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      if (existing.estado === 'cerrada') {
        return { status: 'closed', sesion: existing as SesionEntrenamiento };
      }
      return { status: 'ok', sesion: existing as SesionEntrenamiento };
    }

    const { data: created, error: createError } = await this.buildSesionesQuery()
      .insert({
        academia_id: academiaId,
        fecha,
        categoria,
        estado: 'abierta',
        abierta_por: abiertaPor,
      })
      .select('*')
      .single();

    if (createError) {
      if ('code' in createError && createError.code === '23505') {
        const { data: retry, error: retryError } = await this.buildSesionesQuery()
          .select('*')
          .eq('academia_id', academiaId)
          .eq('fecha', fecha)
          .eq('categoria', categoria)
          .single();

        if (retryError) throw retryError;
        if (retry.estado === 'cerrada') {
          return { status: 'closed', sesion: retry as SesionEntrenamiento };
        }
        return { status: 'ok', sesion: retry as SesionEntrenamiento };
      }
      throw createError;
    }

    return { status: 'ok', sesion: created as SesionEntrenamiento };
  }

  private async cerrarSesionAsync(
    sesionId: string,
    cerradaPor: string
  ): Promise<CierreSesionResult> {
    const { data: sesion, error: sesionError } = await this.buildSesionesQuery()
      .select('*')
      .eq('id', sesionId)
      .single();

    if (sesionError) throw sesionError;

    const sesionData = sesion as SesionEntrenamiento;
    if (sesionData.estado === 'cerrada') {
      throw new Error('Esta sesión ya fue cerrada');
    }

    const { data: updated, error: updateError } = await this.buildSesionesQuery()
      .update({
        estado: 'cerrada',
        cerrada_por: cerradaPor,
        cerrada_at: new Date().toISOString(),
      })
      .eq('id', sesionId)
      .eq('estado', 'abierta')
      .select('*')
      .single();

    if (updateError) throw updateError;

    const totalEsperados = await this.contarAlumnosEsperados(
      sesionData.academia_id,
      sesionData.categoria,
      sesionData.fecha
    );

    const { count, error: countError } = await this.buildAsistenciasQuery()
      .select('*', { count: 'exact', head: true })
      .eq('sesion_id', sesionId);

    if (countError) throw countError;

    const presentes = count ?? 0;

    return {
      sesion: updated as SesionEntrenamiento,
      totalEsperados,
      presentes,
      faltas: Math.max(totalEsperados - presentes, 0),
    };
  }

  private async contarAlumnosEsperados(
    academiaId: string,
    categoria: string,
    fecha: string
  ): Promise<number> {
    let query = this.supabaseService.supabase
      .from('alumnos')
      .select('*', { count: 'exact', head: true })
      .eq('academia_id', academiaId)
      .eq('categoria', categoria)
      .or(`fecha_ingreso.is.null,fecha_ingreso.lte.${fecha}`);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  private async getResumenAlumnoAsync(
    alumnoId: string,
    desde?: string,
    hasta?: string
  ): Promise<ResumenAsistenciaAlumno> {
    const { data, error } = await this.supabaseService.supabase.rpc(
      'get_resumen_asistencia_alumno',
      {
        p_alumno_id: alumnoId,
        p_desde: desde ?? null,
        p_hasta: hasta ?? null,
      }
    );

    if (error) throw error;

    return data as ResumenAsistenciaAlumno;
  }

  localDateString(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatHora(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatFechaDisplay(fecha: string): string {
    return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
