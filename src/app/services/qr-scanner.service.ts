import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';

export type QrScanOutcome =
  | { status: 'success'; content: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export interface ScannerAvailability {
  available: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class QrScannerService {
  getAvailability(): ScannerAvailability {
    if (Capacitor.isNativePlatform()) {
      if (!Capacitor.isPluginAvailable('CapacitorBarcodeScanner')) {
        return {
          available: false,
          message:
            'El escáner no está disponible en este dispositivo. Usa la pestaña Manual.',
        };
      }
      return { available: true };
    }

    if (!Capacitor.isPluginAvailable('CapacitorBarcodeScanner')) {
      return {
        available: false,
        message:
          'Tu navegador no admite el escáner QR. Usa la pestaña Manual para registrar asistencia por nombre.',
      };
    }

    if (!this.isSecureContext()) {
      return {
        available: false,
        message:
          'En el navegador la cámara solo funciona con HTTPS o en localhost. Usa la pestaña Manual o abre la app móvil.',
      };
    }

    return { available: true };
  }

  isWebPlatform(): boolean {
    return !Capacitor.isNativePlatform();
  }

  getWebScanHint(): string {
    return 'En el navegador necesitas permitir el acceso a la cámara. Si no funciona, usa la pestaña Manual.';
  }

  async scan(): Promise<QrScanOutcome> {
    const availability = this.getAvailability();
    if (!availability.available) {
      return {
        status: 'error',
        message: availability.message ?? this.unavailableMessage(),
      };
    }

    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanInstructions: 'Apunta al código QR del carnet del alumno',
        scanText: 'Escanear',
        web: {
          showCameraSelection: true,
          scannerFPS: 10,
        },
      });

      const content = result.ScanResult?.trim();
      if (!content) {
        return { status: 'cancelled' };
      }

      return { status: 'success', content };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : '';

      if (
        message.includes('cancel') ||
        message.includes('user') ||
        message.includes('dismiss')
      ) {
        return { status: 'cancelled' };
      }

      return {
        status: 'error',
        message: this.mapScanError(error),
      };
    }
  }

  private isSecureContext(): boolean {
    return typeof window !== 'undefined' && window.isSecureContext;
  }

  private unavailableMessage(): string {
    if (this.isWebPlatform()) {
      return 'El escáner QR no está disponible en este navegador. Usa la pestaña Manual.';
    }
    return 'El escáner no está disponible. Usa la pestaña Manual.';
  }

  private mapScanError(error: unknown): string {
    const raw = error instanceof Error ? error.message : '';
    const message = raw.toLowerCase();

    if (
      message.includes('permission') ||
      message.includes('notallowed') ||
      message.includes('denied')
    ) {
      return this.isWebPlatform()
        ? 'Permiso de cámara denegado. Actívalo en la configuración del navegador o usa la pestaña Manual.'
        : 'Permiso de cámara denegado. Actívalo en ajustes del dispositivo o usa la pestaña Manual.';
    }

    if (
      message.includes('secure') ||
      message.includes('https') ||
      message.includes('insecure')
    ) {
      return 'La cámara requiere HTTPS o localhost en el navegador. Usa la pestaña Manual o la app móvil.';
    }

    if (
      message.includes('notfound') ||
      message.includes('no camera') ||
      message.includes('devices not found')
    ) {
      return this.isWebPlatform()
        ? 'No se detectó ninguna cámara en este equipo. Usa la pestaña Manual.'
        : 'No se detectó ninguna cámara. Usa la pestaña Manual.';
    }

    if (this.isWebPlatform()) {
      return raw
        ? `${raw}. Si el problema continúa, usa la pestaña Manual.`
        : 'No se pudo abrir el escáner en el navegador. Usa la pestaña Manual o la app móvil.';
    }

    return raw || 'No se pudo abrir el escáner de QR. Usa la pestaña Manual.';
  }
}
