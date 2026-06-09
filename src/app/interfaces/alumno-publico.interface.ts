export interface AlumnoPublicProfile {
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  categoria: string;
  foto_url: string | null;
  documento_url: string | null;
  documento_es_pdf: boolean;
  academia_nombre: string;
  academia_logo_url: string | null;
}

export interface AlumnoPublicProfileResponse {
  data: AlumnoPublicProfile;
}
