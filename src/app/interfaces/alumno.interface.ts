export type GeneroAlumno = 'masculino' | 'femenino' | 'otro';
export type NivelAlumno = 'basico' | 'intermedio' | 'avanzado';

export interface Alumno {
  id: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  genero: GeneroAlumno;
  nombre_tutor: string;
  telefono_tutor: string;
  foto_estudiante_url: string | null;
  foto_documento_url: string | null;
  foto_documento_padre_url: string | null;
  talla_camiseta: string | null;
  categoria: string;
  nivel: NivelAlumno | null;
  fecha_ingreso: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AlumnoForm {
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  genero: GeneroAlumno;
  nombre_tutor: string;
  telefono_tutor: string;
  categoria: string;
  nivel: NivelAlumno | null;
  foto_estudiante_url?: string | null;
  foto_documento_url?: string | null;
  foto_documento_padre_url?: string | null;
  talla_camiseta?: string | null;
  fecha_ingreso?: string | null;
}
