import { Alumno } from './alumno.interface';

export type MetodoAsistencia = 'qr' | 'manual';

export interface Asistencia {
  id: string;
  alumno_id: string;
  academia_id: string;
  sesion_id: string;
  fecha: string;
  registrado_por: string;
  metodo: MetodoAsistencia;
  created_at: string;
}

export interface AsistenciaConAlumno extends Asistencia {
  alumno: Pick<
    Alumno,
    'id' | 'nombres' | 'apellidos' | 'categoria' | 'foto_estudiante_url'
  >;
}

export type RegistroAsistenciaStatus =
  | 'ok'
  | 'duplicate'
  | 'not_found'
  | 'session_closed';

export interface RegistroAsistenciaResult {
  status: RegistroAsistenciaStatus;
  asistencia?: AsistenciaConAlumno;
  alumno?: Pick<Alumno, 'id' | 'nombres' | 'apellidos' | 'categoria'>;
  horaRegistro?: string;
  message?: string;
}
