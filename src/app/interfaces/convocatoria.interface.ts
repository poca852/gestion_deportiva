import { Alumno } from './alumno.interface';

export interface Convocatoria {
  id: string;
  nombre_evento: string;
  fecha: string;
  categoria: string;
  creado_por: string;
  firma_entrenador_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AlumnoConvocatoria {
  id: string;
  convocatoria_id: string;
  alumno_id: string;
  alumno?: Alumno;
}

export interface ConvocatoriaConPlantilla extends Convocatoria {
  alumnos: Alumno[];
}

export interface ConvocatoriaForm {
  nombre_evento: string;
  fecha: string;
  categoria: string;
  alumno_ids: string[];
}
