import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { slugifyCarnetText } from '../utils/carnet-format.util';
import { CarnetData } from './carnet.service';

export type CarnetExportPhase = 'preparing' | 'generating' | 'packaging';

export interface CarnetBatchProgress {
  phase: CarnetExportPhase;
  current: number;
  total: number;
  label?: string;
}

export type CarnetDownloadResult =
  | { method: 'native'; filename: string }
  | { method: 'browser'; filename: string }
  | { method: 'shared'; filename: string };

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

  downloadResultMessage(result: CarnetDownloadResult): string {
    switch (result.method) {
      case 'native':
        return `Archivo guardado en el dispositivo: ${result.filename}`;
      case 'shared':
        return `Selecciona dónde guardar: ${result.filename}`;
      case 'browser':
        return `Descarga iniciada: ${result.filename}`;
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
   * Descarga un blob. En nativo guarda en Documents; si falla, abre el
   * selector para compartir/guardar (Android/iOS). En web usa el diálogo
   * del navegador o un enlace de descarga.
   */
  async downloadBlobFile(
    blob: Blob,
    filename: string
  ): Promise<CarnetDownloadResult> {
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      const saved = await this.saveBlobToDocuments(blob, filename);
      if (saved) {
        return { method: 'native', filename };
      }

      const shared = await this.shareBlobNative(
        blob,
        filename,
        'Guardar archivo',
        filename
      );
      if (shared) {
        return { method: 'shared', filename };
      }

      throw new Error('No se pudo guardar el archivo en el dispositivo');
    }

    await this.downloadBlobInBrowser(blob, filename);
    return { method: 'browser', filename };
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
        const shared = await this.shareBlobNative(blob, filename, title, text);
        return shared ? 'shared' : false;
      }

      return await this.shareBlobOnWeb(blob, filename, title, text);
    } catch {
      return false;
    }
  }

  async downloadCanvas(
    canvas: HTMLCanvasElement,
    filename: string
  ): Promise<CarnetDownloadResult> {
    const blob = await this.canvasToBlob(canvas);
    return this.downloadBlobFile(blob, filename);
  }

  async shareCanvas(
    canvas: HTMLCanvasElement,
    filename: string,
    text: string
  ): Promise<'shared' | 'downloaded' | false> {
    const blob = await this.canvasToBlob(canvas);
    return this.shareBlob(blob, filename, 'Carnet', text);
  }

  private async shareBlobNative(
    blob: Blob,
    filename: string,
    title: string,
    text: string
  ): Promise<boolean> {
    try {
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

      return true;
    } catch {
      return false;
    }
  }

  private async shareBlobOnWeb(
    blob: Blob,
    filename: string,
    title: string,
    text: string
  ): Promise<'shared' | 'downloaded' | false> {
    const mime = filename.endsWith('.zip') ? 'application/zip' : 'image/png';
    const file = new File([blob], filename, { type: mime });

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
