import {
  CARNET_CALENDAR,
  CARNET_RIGHT_MARGIN_RATIO,
  STANDARD_CARNET_LAYOUT,
} from '../constants/carnet-standard-layout';
import {
  CarnetFieldAlign,
  CarnetFieldStyle,
  CarnetLayout,
  CarnetPixelRect,
  CarnetQrField,
  CarnetQrPixelRect,
  CarnetRectField,
} from '../interfaces/carnet-layout.interface';

/** Layout fijo del carnet estándar (sin personalización por academia). */
export function getStandardCarnetLayout(): CarnetLayout {
  return structuredClone(STANDARD_CARNET_LAYOUT);
}

export function rectFieldToPixels(
  field: CarnetRectField,
  canvasWidth: number,
  canvasHeight: number
): CarnetPixelRect {
  return {
    x: Math.round(field.x * canvasWidth),
    y: Math.round(field.y * canvasHeight),
    width: Math.round(field.w * canvasWidth),
    height: Math.round(field.h * canvasHeight),
  };
}

export function calendarIconBottomPx(
  canvasWidth: number,
  canvasHeight: number
): number {
  const top = Math.round(CARNET_CALENDAR.y * canvasHeight);
  const size = Math.round(CARNET_CALENDAR.size * canvasWidth);
  return top + size;
}

export function qrFieldToPixels(
  field: CarnetQrField,
  canvasWidth: number,
  canvasHeight: number
): CarnetQrPixelRect {
  const innerSize = Math.round(field.size * canvasWidth);
  const padding = Math.round((field.framePadding ?? 0.007) * canvasWidth);
  const frameSize = innerSize + padding * 2;
  const x = Math.round(
    (1 - CARNET_RIGHT_MARGIN_RATIO) * canvasWidth - frameSize
  );

  let y: number;
  if (field.alignBottomWithCalendar) {
    y = calendarIconBottomPx(canvasWidth, canvasHeight) - frameSize;
  } else {
    y = Math.round((field as CarnetQrField & { y?: number }).y ?? 0);
  }

  return {
    x,
    y,
    width: frameSize,
    height: frameSize,
    innerX: x + padding,
    innerY: y + padding,
    innerSize,
  };
}

export function fieldFontSizePx(
  field: CarnetRectField,
  canvasHeight: number,
  fallbackRatio = 0.04
): number {
  const ratio = field.fontSizeRatio ?? fallbackRatio;
  return Math.max(10, Math.round(ratio * canvasHeight));
}

export function fieldStyleToCss(
  field: CarnetRectField,
  canvasWidth: number,
  canvasHeight: number
): Record<string, string> {
  const rect = rectFieldToPixels(field, canvasWidth, canvasHeight);
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

export function qrStyleToCss(
  field: CarnetQrField,
  canvasWidth: number,
  canvasHeight: number
): {
  frame: Record<string, string>;
  inner: Record<string, string>;
} {
  const rect = qrFieldToPixels(field, canvasWidth, canvasHeight);
  const padding = rect.innerX - rect.x;
  return {
    frame: {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    },
    inner: {
      width: `${rect.innerSize}px`,
      height: `${rect.innerSize}px`,
      margin: `${padding}px`,
    },
  };
}

export function canvasAlignToTextAlign(
  align: CarnetFieldAlign | undefined
): CanvasTextAlign {
  switch (align) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    default:
      return 'center';
  }
}

export function textXForAlign(
  rect: CarnetPixelRect,
  align: CarnetFieldAlign | undefined
): number {
  switch (align) {
    case 'left':
      return rect.x;
    case 'right':
      return rect.x + rect.width;
    default:
      return rect.x + rect.width / 2;
  }
}

export function applyFieldStyle(
  style: CarnetFieldStyle | undefined,
  text: string
): string {
  const value = style?.uppercase ? text.toUpperCase() : text;
  return value;
}

let sharedMeasureCanvas: HTMLCanvasElement | null = null;

export function createCarnetLineMeasurer(
  weight: '600' | '700' | '800' = '800'
): (line: string, fontSizePx: number) => number {
  if (typeof document !== 'undefined') {
    sharedMeasureCanvas = sharedMeasureCanvas ?? document.createElement('canvas');
    const ctx = sharedMeasureCanvas.getContext('2d');
    if (ctx) {
      return (line, fontSizePx) => {
        ctx.font = `${weight} ${fontSizePx}px system-ui, sans-serif`;
        return ctx.measureText(line).width;
      };
    }
  }

  return (line, fontSizePx) => line.length * fontSizePx * 0.62;
}

export function wrapTextToLines(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  maxWidth: number,
  measure?: (line: string) => number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const measureWidth =
    measure ??
    ((line: string) => {
      if (!ctx) return line.length * 8;
      return ctx.measureText(line).width;
    });

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (measureWidth(candidate) <= maxWidth - 2) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }

  lines.push(current);
  return lines;
}

export function loadImageFromDataUrl(
  dataUrl: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!dataUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    const finish = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width <= 0 || height <= 0) {
        reject(new Error('La imagen no tiene dimensiones válidas'));
        return;
      }
      resolve(img);
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        void img.decode().then(finish).catch(finish);
        return;
      }
      finish();
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = dataUrl;
  });
}
