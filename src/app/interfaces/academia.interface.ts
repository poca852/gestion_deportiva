export interface Academia {
  id: string;
  nombre: string;
  direccion: string;
  logo_url: string | null;
  sello_url: string | null;
  carnet_color_franja_inicio: string;
  carnet_color_franja_fin: string;
  carnet_color_marco_foto: string;
  admin_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademiaForm {
  nombre: string;
  direccion: string;
  logo_url?: string | null;
  sello_url?: string | null;
  carnet_color_franja_inicio?: string;
  carnet_color_franja_fin?: string;
  carnet_color_marco_foto?: string;
  admin_id?: string | null;
}
