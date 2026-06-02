export type RolEntrenador = 'admin' | 'coach';

export interface Entrenador {
  id: string;
  nombre: string;
  correo: string;
  categorias_asignadas: string[];
  rol: RolEntrenador;
  academia_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EntrenadorForm {
  id?: string;
  nombre: string;
  correo: string;
  categorias_asignadas: string[];
  rol: RolEntrenador;
  password?: string;
  academia_id?: string | null;
}
