export type CarnetFieldAlign = 'left' | 'center' | 'right';
export type CarnetPhotoShape = 'rect' | 'circle';

export interface CarnetRectField {
  /** Posición X relativa (0–1) respecto al ancho del carnet. */
  x: number;
  /** Posición Y relativa (0–1) respecto al alto del carnet. */
  y: number;
  /** Ancho relativo (0–1). */
  w: number;
  /** Alto relativo (0–1). */
  h: number;
  align?: CarnetFieldAlign;
  /** Tamaño de fuente como fracción del alto del carnet. */
  fontSizeRatio?: number;
}

export interface CarnetFotoField extends CarnetRectField {
  shape?: CarnetPhotoShape;
}

export interface CarnetQrField {
  /** Tamaño del QR (sin marco) como fracción del ancho del carnet. */
  size: number;
  /** Padding del marco blanco como fracción del ancho. */
  framePadding?: number;
  /** Alinear borde inferior del marco con el icono de fecha (misma fila inferior). */
  alignBottomWithCalendar?: boolean;
}

export interface CarnetFieldStyle {
  color?: string;
  weight?: string;
  uppercase?: boolean;
}

export interface CarnetLayoutFields {
  foto: CarnetFotoField;
  nombres: CarnetRectField;
  apellidos: CarnetRectField;
  categoria: CarnetRectField;
  nombreAcademia: CarnetRectField;
  qr: CarnetQrField;
  fecha: CarnetRectField;
}

export interface CarnetLayout {
  version: number;
  fields: CarnetLayoutFields;
  styles?: Partial<
    Record<
      'nombres' | 'apellidos' | 'categoria' | 'nombreAcademia' | 'fecha',
      CarnetFieldStyle
    >
  >;
}

export interface CarnetPixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CarnetQrPixelRect extends CarnetPixelRect {
  innerX: number;
  innerY: number;
  innerSize: number;
}
