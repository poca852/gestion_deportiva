/** A4 y área imprimible (96 CSS px/pulgada, estándar web). */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PRINT_PDF_MARGIN_MM = 15;
export const PRINT_PDF_CONTENT_WIDTH_MM = A4_WIDTH_MM - 2 * PRINT_PDF_MARGIN_MM;
export const PRINT_PDF_CONTENT_HEIGHT_MM = A4_HEIGHT_MM - 2 * PRINT_PDF_MARGIN_MM;

export const CSS_PX_PER_MM = 96 / 25.4;

/** Ancho fijo del documento al exportar (coincide con max-width de .print-document). */
export const PRINT_DOCUMENT_CAPTURE_WIDTH_PX = 800;
export const PRINT_CAPTURE_SCALE = 2;
