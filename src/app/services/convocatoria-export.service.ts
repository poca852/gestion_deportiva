import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Convocatoria } from '../interfaces/convocatoria.interface';

@Injectable({
  providedIn: 'root',
})
export class ConvocatoriaExportService {
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

  async downloadPdf(element: HTMLElement, filename: string): Promise<void> {
    const canvas = await this.captureElement(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;
    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = margin;

    pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidth, renderHeight);
    pdf.save(`${filename}.pdf`);
  }

  async downloadImage(element: HTMLElement, filename: string): Promise<void> {
    const canvas = await this.captureElement(element);
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  printWithFilename(filename: string): void {
    const previousTitle = document.title;
    document.title = filename;

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };

    window.addEventListener('afterprint', restoreTitle);
    window.print();
  }

  private async captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
    return html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800,
    });
  }
}
