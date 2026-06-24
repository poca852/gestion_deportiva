import { Injectable } from '@angular/core';
import {
  CARNET_CALENDAR,
  CARNET_CALENDAR_ICON_COLOR,
  CARNET_FIELD_LABEL_FONT_RATIO,
  CARNET_FECHA_VALOR_FONT_RATIO,
  CARNET_FRAME_BORDER_PX,
  CARNET_QR_FRAME_BORDER_PX,
  CARNET_STRIPE_HEIGHT_RATIO,
} from '../constants/carnet-standard-layout';
import {
  CARNET_LOGO_WATERMARK_OPACITY,
} from '../constants/carnet.constants';
import { CarnetTheme } from '../interfaces/carnet-theme.interface';
import {
  CarnetFieldStyle,
  CarnetLayout,
  CarnetPixelRect,
  CarnetRectField,
} from '../interfaces/carnet-layout.interface';
import {
  CarnetTextLineOptions,
  formatFechaCortaCarnet,
  splitCarnetApellidosLines,
} from '../utils/carnet-format.util';
import {
  applyFieldStyle,
  canvasAlignToTextAlign,
  fieldFontSizePx,
  loadImageFromDataUrl,
  qrFieldToPixels,
  rectFieldToPixels,
  textXForAlign,
  wrapTextToLines,
} from '../utils/carnet-layout.util';
import { CarnetData } from './carnet.service';

export interface CarnetRenderAssets {
  nombreAcademia: string;
  logoDataUrl: string | null;
  theme: CarnetTheme;
  layout: CarnetLayout;
  canvasWidth: number;
  canvasHeight: number;
}

@Injectable({
  providedIn: 'root',
})
export class CarnetCompositorService {
  async compose(
    data: CarnetData,
    assets: CarnetRenderAssets
  ): Promise<HTMLCanvasElement> {
    const layout = assets.layout;
    const width = assets.canvasWidth;
    const height = assets.canvasHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el lienzo del carnet');
    }

    const stripeHeight = this.drawStandardBase(
      ctx,
      width,
      height,
      assets.theme,
      layout,
      data.nombreAcademia
    );

    await this.drawFoto(ctx, data, layout, width, height);

    this.drawLabeledTextField(
      ctx,
      'CATEGORÍA:',
      data.categoriaDisplay,
      layout.fields.categoria,
      layout.styles?.categoria,
      width,
      height
    );

    this.drawLabeledTextField(
      ctx,
      'NOMBRES:',
      applyFieldStyle(layout.styles?.nombres, data.nombresDisplay),
      layout.fields.nombres,
      layout.styles?.nombres,
      width,
      height
    );

    this.drawLabeledTextField(
      ctx,
      'APELLIDOS:',
      applyFieldStyle(layout.styles?.apellidos, data.apellidosDisplay),
      layout.fields.apellidos,
      layout.styles?.apellidos,
      width,
      height,
      splitCarnetApellidosLines
    );

    await this.drawQr(ctx, data.qrDataUrl, layout, width, height);

    this.drawFechaNacimiento(
      ctx,
      formatFechaCortaCarnet(data.alumno.fecha_nacimiento),
      layout,
      width,
      height
    );

    if (assets.logoDataUrl) {
      await this.drawLogoWatermark(
        ctx,
        assets.logoDataUrl,
        width,
        height,
        stripeHeight
      );
    }

    return canvas;
  }

  private drawStandardBase(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: CarnetTheme,
    layout: CarnetLayout,
    nombreAcademia: string
  ): number {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const stripeHeight = Math.round(height * CARNET_STRIPE_HEIGHT_RATIO);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, theme.franjaInicio);
    gradient.addColorStop(1, theme.franjaFin);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width + 1, stripeHeight);

    if (nombreAcademia.trim()) {
      this.drawStripeAcademyName(
        ctx,
        applyFieldStyle(layout.styles?.nombreAcademia, nombreAcademia),
        layout.fields.nombreAcademia,
        layout.styles?.nombreAcademia,
        width,
        height,
        stripeHeight
      );
    }

    const frame = rectFieldToPixels(layout.fields.foto, width, height);
    const border = CARNET_FRAME_BORDER_PX;
    ctx.strokeStyle = theme.marcoFoto;
    ctx.lineWidth = border;
    ctx.strokeRect(
      frame.x + border / 2,
      frame.y + border / 2,
      frame.width - border,
      frame.height - border
    );

    return stripeHeight;
  }

  private drawStripeAcademyName(
    ctx: CanvasRenderingContext2D,
    text: string,
    field: CarnetRectField,
    style: CarnetFieldStyle | undefined,
    width: number,
    canvasHeight: number,
    stripeHeight: number
  ): void {
    const maxFont = fieldFontSizePx(field, canvasHeight);
    const rect: CarnetPixelRect = {
      x: 0,
      y: 0,
      width,
      height: stripeHeight,
    };
    const fontSize = this.fitFontSize(ctx, text, rect, maxFont, style?.weight);

    ctx.save();
    ctx.font = `${style?.weight ?? '700'} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = style?.color ?? '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, stripeHeight / 2);
    ctx.restore();
  }

  private drawCalendarIcon(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    color: string
  ): void {
    const size = Math.round(CARNET_CALENDAR.size * width);
    const x = Math.round(CARNET_CALENDAR.x * width);
    const y = Math.round(CARNET_CALENDAR.y * height);
    const pad = Math.round(size * 0.12);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, Math.round(size * 0.07));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const bodyX = x;
    const bodyY = y + size * 0.18;
    const bodyW = size;
    const bodyH = size * 0.78;
    ctx.strokeRect(bodyX, bodyY, bodyW, bodyH);

    const hookY = bodyY;
    ctx.beginPath();
    ctx.moveTo(bodyX + pad, hookY);
    ctx.lineTo(bodyX + pad, bodyY - size * 0.12);
    ctx.moveTo(bodyX + bodyW - pad, hookY);
    ctx.lineTo(bodyX + bodyW - pad, bodyY - size * 0.12);
    ctx.stroke();

    const dotR = Math.max(1.5, size * 0.045);
    const cols = 3;
    const rows = 3;
    const gridX = bodyX + pad;
    const gridY = bodyY + size * 0.28;
    const gridW = bodyW - pad * 2;
    const gridH = bodyH - size * 0.35;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = gridX + ((col + 0.5) * gridW) / cols;
        const cy = gridY + ((row + 0.5) * gridH) / rows;
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawFechaNacimiento(
    ctx: CanvasRenderingContext2D,
    fecha: string,
    layout: CarnetLayout,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.drawCalendarIcon(ctx, canvasWidth, canvasHeight, CARNET_CALENDAR_ICON_COLOR);

    const field = layout.fields.fecha;
    const rect = rectFieldToPixels(field, canvasWidth, canvasHeight);
    const labelSize = fieldFontSizePx(field, canvasHeight);
    const valueSize = Math.round(canvasHeight * CARNET_FECHA_VALOR_FONT_RATIO);
    const lineGap = Math.round(labelSize * 0.35);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = layout.styles?.fecha?.color ?? '#333333';

    ctx.font = `600 ${labelSize}px system-ui, sans-serif`;
    ctx.fillText('F. NACIMIENTO:', rect.x, rect.y);

    ctx.font = `800 ${valueSize}px system-ui, sans-serif`;
    ctx.fillText(fecha, rect.x, rect.y + labelSize + lineGap);
    ctx.restore();
  }

  private async drawLogoWatermark(
    ctx: CanvasRenderingContext2D,
    logoDataUrl: string,
    width: number,
    height: number,
    stripeHeight: number
  ): Promise<void> {
    const logo = await loadImageFromDataUrl(logoDataUrl);
    const imgWidth = logo.naturalWidth || logo.width;
    const imgHeight = logo.naturalHeight || logo.height;
    if (imgWidth <= 0 || imgHeight <= 0) {
      return;
    }

    const areaTop = stripeHeight;
    const areaHeight = height - stripeHeight;
    const maxWidth = width * 0.85;
    const maxHeight = areaHeight * 0.85;
    const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = areaTop + (areaHeight - drawHeight) / 2;

    ctx.save();
    ctx.globalAlpha = CARNET_LOGO_WATERMARK_OPACITY;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(logo, x, y, drawWidth, drawHeight);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private async drawFoto(
    ctx: CanvasRenderingContext2D,
    data: CarnetData,
    layout: CarnetLayout,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<void> {
    const field = layout.fields.foto;
    const frame = rectFieldToPixels(field, canvasWidth, canvasHeight);
    const inset = CARNET_FRAME_BORDER_PX + 2;
    const rect: CarnetPixelRect = {
      x: frame.x + inset,
      y: frame.y + inset,
      width: frame.width - inset * 2,
      height: frame.height - inset * 2,
    };

    if (!data.fotoDataUrl) {
      this.drawFotoPlaceholder(ctx, rect);
      return;
    }

    const foto = await loadImageFromDataUrl(data.fotoDataUrl);
    this.drawImageCover(ctx, foto, rect);
  }

  private drawFotoPlaceholder(
    ctx: CanvasRenderingContext2D,
    rect: CarnetPixelRect
  ): void {
    ctx.save();
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  private async drawQr(
    ctx: CanvasRenderingContext2D,
    qrDataUrl: string,
    layout: CarnetLayout,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<void> {
    const rect = qrFieldToPixels(layout.fields.qr, canvasWidth, canvasHeight);
    const border = CARNET_QR_FRAME_BORDER_PX;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = border;
    ctx.strokeRect(
      rect.x + border / 2,
      rect.y + border / 2,
      rect.width - border,
      rect.height - border
    );
    ctx.restore();

    if (!qrDataUrl) return;

    const qr = await loadImageFromDataUrl(qrDataUrl);
    ctx.drawImage(
      qr,
      rect.innerX,
      rect.innerY,
      rect.innerSize,
      rect.innerSize
    );
  }

  private drawLabeledTextField(
    ctx: CanvasRenderingContext2D,
    label: string,
    value: string,
    field: CarnetRectField,
    valueStyle: CarnetFieldStyle | undefined,
    canvasWidth: number,
    canvasHeight: number,
    lineSplit?: (text: string, options: CarnetTextLineOptions) => string[]
  ): void {
    if (!value.trim()) return;

    const rect = rectFieldToPixels(field, canvasWidth, canvasHeight);
    const labelSize = Math.round(canvasHeight * CARNET_FIELD_LABEL_FONT_RATIO);
    const lineGap = Math.round(labelSize * 0.35);
    const align = field.align ?? 'left';
    const weight = valueStyle?.weight ?? '800';
    const maxFont = fieldFontSizePx(field, canvasHeight);
    let fontSize = maxFont;

    ctx.save();
    ctx.textAlign = canvasAlignToTextAlign(align);
    ctx.textBaseline = 'top';
    const textX = textXForAlign(rect, align);

    ctx.font = `600 ${labelSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#666666';
    ctx.fillText(label, textX, rect.y);

    const valueTop = rect.y + labelSize + lineGap;
    const valueHeight = rect.height - (labelSize + lineGap);

    const measureLine = (line: string, size: number) => {
      ctx.font = `${weight} ${size}px system-ui, sans-serif`;
      return ctx.measureText(line).width;
    };

    let lines: string[] = [];
    while (fontSize >= 10) {
      const measure = (line: string) => measureLine(line, fontSize);
      const lineOptions: CarnetTextLineOptions = {
        maxWidth: rect.width,
        measure,
      };
      lines = lineSplit
        ? lineSplit(value, lineOptions)
        : wrapTextToLines(null, value, rect.width, measure);
      const lineHeight = fontSize * 1.1;
      const allFitWidth = lines.every(
        (line) => measureLine(line, fontSize) <= rect.width - 2
      );
      if (allFitWidth && lines.length * lineHeight <= valueHeight) {
        break;
      }
      fontSize -= 1;
    }

    const lineHeight = fontSize * 1.1;

    ctx.beginPath();
    ctx.rect(rect.x, valueTop, rect.width, valueHeight);
    ctx.clip();

    ctx.font = `${weight} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = valueStyle?.color ?? '#1a1a2e';
    lines.forEach((line, index) => {
      ctx.fillText(line, textX, valueTop + index * lineHeight);
    });
    ctx.restore();
  }

  private fitFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    rect: CarnetPixelRect,
    maxFont: number,
    weight = '700'
  ): number {
    let size = maxFont;
    const minSize = Math.max(10, Math.round(maxFont * 0.55));

    while (size >= minSize) {
      ctx.font = `${weight} ${size}px system-ui, sans-serif`;
      if (ctx.measureText(text).width <= rect.width - 4) {
        return size;
      }
      size -= 1;
    }

    return minSize;
  }

  private drawImageCover(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    rect: CarnetPixelRect
  ): void {
    const scale = Math.max(rect.width / image.width, rect.height / image.height);
    const sw = image.width * scale;
    const sh = image.height * scale;
    const sx = rect.x + (rect.width - sw) / 2;
    const sy = rect.y + (rect.height - sh) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.drawImage(image, sx, sy, sw, sh);
    ctx.restore();
  }
}
