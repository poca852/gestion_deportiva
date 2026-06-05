import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraSource,
  CameraResultType,
  Photo,
} from '@capacitor/camera';

export interface CapturedMedia {
  file: File;
  preview: string;
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly isNative = Capacitor.isNativePlatform();

  /**
   * Toma una foto usando la cámara del dispositivo.
   * En native usa el plugin Camera, en web usa `<input capture="camera">`.
   */
  async takePhoto(): Promise<CapturedMedia | null> {
    if (this.isNative) {
      return this.captureWithCamera(CameraSource.Camera);
    }
    return this.captureFromWebInput({ useCamera: true });
  }

  /**
   * Selecciona una foto desde la galería del dispositivo.
   * En native usa el plugin Camera, en web usa `<input accept="image/*">`.
   */
  async pickFromGallery(): Promise<CapturedMedia | null> {
    if (this.isNative) {
      return this.captureWithCamera(CameraSource.Photos);
    }
    return this.captureFromWebInput({ useCamera: false });
  }

  /**
   * Muestra un selector nativo que pregunta al usuario si usar cámara o galería
   * (solo en native). En web abre el selector de archivos para imágenes.
   */
  async pickPhotoWithPrompt(): Promise<CapturedMedia | null> {
    if (this.isNative) {
      return this.captureWithCamera(CameraSource.Prompt);
    }
    return this.captureFromWebInput({ useCamera: false });
  }

  /**
   * Abre un selector de archivos limitado a PDF. Funciona en web y en WebView nativo.
   */
  async pickPdf(): Promise<File | null> {
    return this.pickFile({
      accept: '.pdf,application/pdf',
      description: 'Selecciona el documento PDF',
    });
  }

  // ──────────────────────────────────────
  //  Native (Camera plugin)
  // ──────────────────────────────────────

  private async captureWithCamera(
    source: CameraSource
  ): Promise<CapturedMedia | null> {
    try {
      const photo: Photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
        width: 1920,
      });

      if (!photo.webPath) {
        return null;
      }

      const file = await this.photoToFile(photo);
      return { file, preview: photo.webPath };
    } catch (err: unknown) {
      // Usuario canceló → no es un error real
      if (this.isUserCancelledError(err)) {
        return null;
      }
      throw err;
    }
  }

  private async photoToFile(photo: Photo): Promise<File> {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    const mimeType =
      photo.format === 'jpeg'
        ? 'image/jpeg'
        : photo.format === 'png'
          ? 'image/png'
          : photo.format === 'webp'
            ? 'image/webp'
            : blob.type || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    const fileName = `captured-${Date.now()}.${extension}`;
    return new File([blob], fileName, { type: mimeType });
  }

  private isUserCancelledError(err: unknown): boolean {
    const msg = String(err).toLowerCase();
    return (
      msg.includes('cancel') ||
      msg.includes('user cancelled') ||
      msg.includes('user dismissed')
    );
  }

  // ──────────────────────────────────────
  //  Web fallback (file input)
  // ──────────────────────────────────────

  private captureFromWebInput(options: {
    useCamera: boolean;
  }): Promise<CapturedMedia | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      if (options.useCamera) {
        input.capture = 'environment';
      }
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const preview = URL.createObjectURL(file);
        resolve({ file, preview });
      });
      document.body.appendChild(input);
      input.click();
      // Limpiar después de un tiempo si no se selecciona nada
      setTimeout(() => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      }, 60000);
    });
  }

  private pickFile(options: {
    accept: string;
    description: string;
  }): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept;
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        resolve(file ?? null);
      });
      document.body.appendChild(input);
      input.click();
      setTimeout(() => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      }, 60000);
    });
  }
}
