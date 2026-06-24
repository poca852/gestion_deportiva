import { Injectable, inject } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  PRINT_CAPTURE_SCALE,
  PRINT_DOCUMENT_CAPTURE_WIDTH_PX,
  PRINT_PDF_CONTENT_HEIGHT_MM,
  PRINT_PDF_CONTENT_WIDTH_MM,
  PRINT_PDF_MARGIN_MM,
} from '../constants/print.constants';
import { Convocatoria } from '../interfaces/convocatoria.interface';
import { CarnetExportService } from './carnet-export.service';

export type ConvocatoriaExportResult = 'native' | 'browser' | 'shared';

@Injectable({
  providedIn: 'root',
})
export class ConvocatoriaExportService {
  private readonly carnetExport = inject(CarnetExportService);

  buildFilename(convocatoria: Convocatoria): string {
    const slug = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();

    return `convocatoria_${slug(convocatoria.nombre_evento)}_${slug(convocatoria.categoria)}`;
  }

  async downloadPdf(
    element: HTMLElement,
    filename: string
  ): Promise<ConvocatoriaExportResult> {
    const canvas = await this.captureElement(element);
    const pdfBlob = this.buildPdfBlob(canvas);
    const result = await this.carnetExport.downloadBlobFile(
      pdfBlob,
      `${filename}.pdf`
    );
    return result.method;
  }

  async downloadImage(
    element: HTMLElement,
    filename: string
  ): Promise<ConvocatoriaExportResult> {
    const canvas = await this.captureElement(element);
    const blob = await this.carnetExport.canvasToBlob(canvas);
    const result = await this.carnetExport.downloadBlobFile(
      blob,
      `${filename}.png`
    );
    return result.method;
  }

  private buildPdfBlob(canvas: HTMLCanvasElement): Blob {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const contentWidthMm = PRINT_PDF_CONTENT_WIDTH_MM;
    const contentHeightMm = PRINT_PDF_CONTENT_HEIGHT_MM;
    const marginMm = PRINT_PDF_MARGIN_MM;
    const pxPerMm = canvas.width / contentWidthMm;
    const pageSliceHeightPx = contentHeightMm * pxPerMm;

    let offsetYPx = 0;
    let pageIndex = 0;

    while (offsetYPx < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - offsetYPx);
      const sliceHeightMm = sliceHeightPx / pxPerMm;
      const imageData = this.extractCanvasSlice(canvas, offsetYPx, sliceHeightPx);

      pdf.addImage(
        imageData,
        'PNG',
        marginMm,
        marginMm,
        contentWidthMm,
        sliceHeightMm,
        undefined,
        'FAST'
      );

      offsetYPx += sliceHeightPx;
      pageIndex++;
    }

    return pdf.output('blob');
  }

  private extractCanvasSlice(
    source: HTMLCanvasElement,
    offsetYPx: number,
    sliceHeightPx: number
  ): string {
    if (offsetYPx === 0 && sliceHeightPx >= source.height) {
      return source.toDataURL('image/png');
    }

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = source.width;
    sliceCanvas.height = sliceHeightPx;

    const context = sliceCanvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo preparar la página del PDF');
    }

    context.drawImage(
      source,
      0,
      offsetYPx,
      source.width,
      sliceHeightPx,
      0,
      0,
      source.width,
      sliceHeightPx
    );

    return sliceCanvas.toDataURL('image/png');
  }

  private async captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
    const captureWidthPx = PRINT_DOCUMENT_CAPTURE_WIDTH_PX;

    await this.carnetExport.yieldToUi();

    return html2canvas(element, {
      scale: PRINT_CAPTURE_SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: captureWidthPx,
      windowWidth: captureWidthPx,
      onclone: (_document, clonedElement) => {
        clonedElement.style.boxSizing = 'border-box';
        clonedElement.style.width = `${captureWidthPx}px`;
        clonedElement.style.minWidth = `${captureWidthPx}px`;
        clonedElement.style.maxWidth = `${captureWidthPx}px`;
        clonedElement.classList.add('print-document--export');
      },
    });
  }
}
