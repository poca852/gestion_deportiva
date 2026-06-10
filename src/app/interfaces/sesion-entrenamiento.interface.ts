export type EstadoSesion = 'abierta' | 'cerrada';

export interface SesionEntrenamiento {
  id: string;
  academia_id: string;
  fecha: string;
  categoria: string;
  estado: EstadoSesion;
  abierta_por: string;
  cerrada_por: string | null;
  cerrada_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SesionConStats extends SesionEntrenamiento {
  presentes: number;
}

export interface CierreSesionResult {
  sesion: SesionEntrenamiento;
  totalEsperados: number;
  presentes: number;
  faltas: number;
}

export interface ResumenAsistenciaAlumno {
  desde: string;
  hasta: string;
  esperados: number;
  presentes: number;
  faltas: number;
  porcentaje: number;
}
