/** Colores personalizables del carnet estándar por academia. */
export interface CarnetTheme {
  franjaInicio: string;
  franjaFin: string;
  marcoFoto: string;
}

export const DEFAULT_CARNET_THEME: CarnetTheme = {
  franjaInicio: '#9d0208',
  franjaFin: '#e85d04',
  marcoFoto: '#e85d04',
};
