export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  /** 'super_admin' | 'admin' | 'coach' */
  rol: string;
  categorias_asignadas: string[];
  academia_id: string | null;
}
