import { CARNET_WIDTH } from './carnet.constants';

import { CarnetLayout } from '../interfaces/carnet-layout.interface';



/** Carnet ID-1 apaisado: 85.60 mm × 53.98 mm. */

export const CARNET_PHYSICAL_WIDTH_MM = 85.6;

export const CARNET_PHYSICAL_HEIGHT_MM = 53.98;



/** Franja superior (Inkscape). */

export const CARNET_STRIPE_HEIGHT_MM = 8.784;

export const CARNET_STRIPE_HEIGHT_RATIO =

  CARNET_STRIPE_HEIGHT_MM / CARNET_PHYSICAL_HEIGHT_MM;



/** Marco de foto del alumno (Inkscape). */

export const CARNET_PHOTO_WIDTH_MM = 16.98;

export const CARNET_PHOTO_HEIGHT_MM = 20.75;

export const CARNET_PHOTO_WIDTH_RATIO =

  CARNET_PHOTO_WIDTH_MM / CARNET_PHYSICAL_WIDTH_MM;

export const CARNET_PHOTO_HEIGHT_RATIO =

  CARNET_PHOTO_HEIGHT_MM / CARNET_PHYSICAL_HEIGHT_MM;



/** Separación bajo la franja hasta el marco de foto (~2 mm). */

export const CARNET_PHOTO_TOP_GAP_MM = 2;

export const CARNET_PHOTO_Y_RATIO =

  CARNET_STRIPE_HEIGHT_RATIO +

  CARNET_PHOTO_TOP_GAP_MM / CARNET_PHYSICAL_HEIGHT_MM;



/** Margen derecho de la columna de datos y QR. */

export const CARNET_RIGHT_MARGIN_RATIO = 0.048;



/** Columna derecha: termina antes del QR. */

const RIGHT_COL_X = 0.28;

const CARNET_TEXT_QR_GAP_PX = 10;



const STANDARD_CARNET_QR = {

  size: 0.19,

  framePadding: 0.014,

  alignBottomWithCalendar: true,

} as const;



function carnetRightColWidthRatio(): number {

  const qrSize = STANDARD_CARNET_QR.size;

  const qrPad = STANDARD_CARNET_QR.framePadding ?? 0.014;

  const frameSize = Math.round(

    CARNET_WIDTH * qrSize + Math.round(CARNET_WIDTH * qrPad) * 2

  );

  const qrLeft =

    Math.round((1 - CARNET_RIGHT_MARGIN_RATIO) * CARNET_WIDTH) - frameSize;

  const colX = Math.round(RIGHT_COL_X * CARNET_WIDTH);

  return Math.max(0.3, (qrLeft - colX - CARNET_TEXT_QR_GAP_PX) / CARNET_WIDTH);

}



const RIGHT_COL_W = carnetRightColWidthRatio();



/** Etiquetas de campos (CATEGORÍA, NOMBRES, etc.). */

export const CARNET_FIELD_LABEL_FONT_RATIO = 0.028;



/** Color fijo del icono de calendario (no configurable). */

export const CARNET_CALENDAR_ICON_COLOR = '#1a1a2e';



/**

 * Layout fijo — posiciones originales; columna de texto acotada al QR.

 */

export const STANDARD_CARNET_LAYOUT: CarnetLayout = {

  version: 10,

  fields: {

    foto: {

      x: 0.048,

      y: CARNET_PHOTO_Y_RATIO,

      w: CARNET_PHOTO_WIDTH_RATIO,

      h: CARNET_PHOTO_HEIGHT_RATIO,

      shape: 'rect',

    },

    categoria: {

      x: RIGHT_COL_X,

      y: CARNET_PHOTO_Y_RATIO,

      w: RIGHT_COL_W,

      h: 0.08,

      align: 'left',

      fontSizeRatio: 0.05,

    },

    nombres: {

      x: RIGHT_COL_X,

      y: 0.35,

      w: RIGHT_COL_W,

      h: 0.11,

      align: 'left',

      fontSizeRatio: 0.042,

    },

    apellidos: {

      x: RIGHT_COL_X,

      y: 0.47,

      w: RIGHT_COL_W,

      h: 0.13,

      align: 'left',

      fontSizeRatio: 0.042,

    },

    nombreAcademia: {

      x: 0,

      y: 0,

      w: 1,

      h: CARNET_STRIPE_HEIGHT_RATIO,

      align: 'center',

      fontSizeRatio: 0.058,

    },

    qr: { ...STANDARD_CARNET_QR },

    fecha: {

      x: 0.115,

      y: 0.848,

      w: 0.28,

      h: 0.1,

      align: 'left',

      fontSizeRatio: 0.03,

    },

  },

  styles: {

    nombres: { color: '#1a1a2e', weight: '800', uppercase: true },

    apellidos: { color: '#1a1a2e', weight: '800', uppercase: true },

    categoria: { color: '#9d0208', weight: '700', uppercase: true },

    nombreAcademia: { color: '#ffffff', weight: '700', uppercase: true },

    fecha: { color: '#333333', weight: '600', uppercase: false },

  },

};



/** Grosor del borde del marco de foto en px (canvas 1011×638). */

export const CARNET_FRAME_BORDER_PX = 4;



/** Borde visible del marco blanco del QR (px en canvas 1011×638). */

export const CARNET_QR_FRAME_BORDER_PX = 2;



/** Icono de calendario junto a la fecha de nacimiento. */

export const CARNET_CALENDAR = {

  x: 0.048,

  y: 0.848,

  size: 0.058,

} as const;



/** Tamaño de la fecha (valor) respecto al alto del carnet. */

export const CARNET_FECHA_VALOR_FONT_RATIO = 0.042;

