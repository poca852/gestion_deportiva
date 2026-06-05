import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import {
  CARNET_CAPTURE_SCALE,
  CARNET_HEIGHT,
  CARNET_WIDTH,
} from '../constants/carnet.constants';
import { slugifyCarnetText } from '../utils/carnet-format.util';
import { CarnetData } from './carnet.service';

export type CarnetExportPhase = 'preparing' | 'generating' | 'packaging';

export interface CarnetBatchProgress {
  phase: CarnetExportPhase;
  current: number;
  total: number;
  label?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CarnetExportService {
  async yieldToUi(): Promise<void> {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  buildCarnetFilename(data: CarnetData): string {
    return `carnet_${slugifyCarnetText(data.nombreCompleto)}.png`;
  }

  buildZipFilename(categorias: string[]): string {
    const label =
      categorias.length === 0
        ? 'todas'
        : categorias.map((c) => slugifyCarnetText(c)).join('_');
    const fecha = new Date().toISOString().slice(0, 10);
    return `carnets_${label}_${fecha}.zip`;
  }

  async captureElement(
    element: HTMLElement,
    options?: { scale?: number; resetParentScale?: HTMLElement | null }
  ): Promise<HTMLCanvasElement> {
    const scale = options?.scale ?? CARNET_CAPTURE_SCALE;
    const wrapper = options?.resetParentScale ?? null;
    const originalTransform = wrapper?.style.transform ?? '';

    if (wrapper) {
      wrapper.style.transform = 'none';
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      return await html2canvas(element, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: CARNET_WIDTH,
        height: CARNET_HEIGHT,
      });
    } finally {
      if (wrapper) {
        wrapper.style.transform = originalTransform;
      }
    }
  }

  async canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) {
      throw new Error('No se pudo convertir el carnet a imagen');
    }
    return blob;
  }

  async buildZip(
    files: { path: string; blob: Blob }[],
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    const zip = new JSZip();

    for (const file of files) {
      zip.file(file.path, file.blob);
    }

    return zip.generateAsync(
      {
        type: 'blob',
        mimeType: 'application/zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      },
      (metadata: JSZip.JSZipMetadata) => onProgress?.(metadata.percent)
    );
  }

  /**
   * Descarga un blob. En nativo guarda en Documents; en web usa el diálogo
   * del navegador o un enlace de descarga.
   */
  async downloadBlobFile(
    blob: Blob,
    filename: string
  ): Promise<'native' | 'browser'> {
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      const saved = await this.saveBlobToDocuments(blob, filename);
      if (saved) {
        return 'native';
      }
    }

    await this.downloadBlobInBrowser(blob, filename);
    return 'browser';
  }

  downloadBlob(blob: Blob, filename: string): void {
    void this.downloadBlobInBrowser(blob, filename);
  }

  private async downloadBlobInBrowser(
    blob: Blob,
    filename: string
  ): Promise<void> {
    const isZip = filename.endsWith('.zip');
    const downloadBlob =
      isZip && blob.type !== 'application/zip'
        ? new Blob([blob], { type: 'application/zip' })
        : blob;

    if ('showSaveFilePicker' in window) {
      try {
        const pickerTypes = isZip
          ? [
              {
                description: 'Archivo ZIP',
                accept: { 'application/zip': ['.zip'] },
              },
            ]
          : [
              {
                description: 'Imagen PNG',
                accept: { 'image/png': ['.png'] },
              },
            ];

        const handle = await (
          window as Window & {
            showSaveFilePicker: (options: {
              suggestedName: string;
              types: { description: string; accept: Record<string, string[]> }[];
            }) => Promise<FileSystemFileHandle>;
          }
        ).showSaveFilePicker({
          suggestedName: filename,
          types: pickerTypes,
        });
        const writable = await handle.createWritable();
        await writable.write(downloadBlob);
        await writable.close();
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') {
          return;
        }
      }
    }

    const url = URL.createObjectURL(downloadBlob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async saveBlobToDocuments(blob: Blob, filename: string): Promise<boolean> {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await this.blobToBase64(blob);

      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
      });

      return true;
    } catch {
      return false;
    }
  }

  async shareBlob(
    blob: Blob,
    filename: string,
    title: string,
    text: string
  ): Promise<'shared' | 'downloaded' | false> {
    try {
      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const base64 = await this.blobToBase64(blob);

        await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });

        const { uri } = await Filesystem.getUri({
          path: filename,
          directory: Directory.Cache,
        });

        await Share.share({
          title,
          text,
          files: [uri],
          dialogTitle: title,
        });

        return 'shared';
      }

      return await this.shareBlobOnWeb(blob, filename, title, text);
    } catch {
      return false;
    }
  }

  async downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
    const blob = await this.canvasToBlob(canvas);
    await this.downloadBlobFile(blob, filename);
  }

  async shareCanvas(
    canvas: HTMLCanvasElement,
    filename: string,
    text: string
  ): Promise<'shared' | 'downloaded' | false> {
    const blob = await this.canvasToBlob(canvas);
    return this.shareBlob(blob, filename, 'Carnet', text);
  }

  private async shareBlobOnWeb(
    blob: Blob,
    filename: string,
    title: string,
    text: string
  ): Promise<'shared' | 'downloaded' | false> {
    const file = new File([blob], filename, { type: 'application/zip' });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title, text, files: [file] });
        return 'shared';
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') {
          return false;
        }
      }
    }

    // En web muchos navegadores no permiten compartir ZIP: descargar como alternativa
    await this.downloadBlobInBrowser(blob, filename);
    return 'downloaded';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
