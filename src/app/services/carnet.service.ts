import { Injectable, inject } from '@angular/core';
import { toDataURL } from 'qrcode';
import { environment } from '../../environments/environment';
import { CARNET_DATA_BATCH_SIZE } from '../constants/carnet.constants';
import { Alumno } from '../interfaces/alumno.interface';
import { AcademiaContextService } from './academia-context.service';
import { SupabaseService } from './supabase.service';

export interface CarnetData {
  alumno: Alumno;
  nombreCompleto: string;
  fotoDataUrl: string | null;
  logoDataUrl: string | null;
  qrDataUrl: string;
  nombreAcademia: string;
  fechaNacimientoFormateada: string;
}

export interface CarnetSharedAssets {
  logoDataUrl: string | null;
  nombreAcademia: string;
}

@Injectable({
  providedIn: 'root',
})
export class CarnetService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly academiaContext = inject(AcademiaContextService);

  async generateQrDataUrl(alumno: Alumno): Promise<string> {
    const base = environment.siteUrl.replace(/\/$/, '');
    const profileUrl = `${base}/perfil/${alumno.public_token}`;

    try {
      return await toDataURL(profileUrl, {
        width: 280,
        margin: 1,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    } catch {
      throw new Error('No se pudo generar el código QR');
    }
  }

  async loadImageAsDataUrl(url: string | null): Promise<string | null> {
    if (!url) return null;
    try {
      return await this.supabaseService.resolveFileAsDataUrl(url);
    } catch {
      return null;
    }
  }

  async getSharedAssets(): Promise<CarnetSharedAssets> {
    const academia = this.academiaContext.academiaActual();
    const logoDataUrl = academia?.logo_url
      ? await this.loadImageAsDataUrl(academia.logo_url)
      : null;

    return {
      logoDataUrl,
      nombreAcademia: academia?.nombre ?? '',
    };
  }

  async getCarnetDataForAlumno(
    alumno: Alumno,
    shared?: CarnetSharedAssets
  ): Promise<CarnetData> {
    const assets = shared ?? (await this.getSharedAssets());

    const [qrDataUrl, fotoDataUrl] = await Promise.all([
      this.generateQrDataUrl(alumno),
      this.loadImageAsDataUrl(alumno.foto_estudiante_url),
    ]);

    return this.buildCarnetData(alumno, assets, qrDataUrl, fotoDataUrl);
  }

  async getCarnetData(alumno: Alumno): Promise<CarnetData> {
    return this.getCarnetDataForAlumno(alumno);
  }

  async prepareBatchData(
    alumnos: Alumno[],
    onProgress?: (current: number, total: number) => void
  ): Promise<CarnetData[]> {
    const shared = await this.getSharedAssets();
    const results: CarnetData[] = [];

    for (let i = 0; i < alumnos.length; i += CARNET_DATA_BATCH_SIZE) {
      const chunk = alumnos.slice(i, i + CARNET_DATA_BATCH_SIZE);
      const chunkData = await Promise.all(
        chunk.map((alumno) => this.getCarnetDataForAlumno(alumno, shared))
      );
      results.push(...chunkData);
      onProgress?.(Math.min(i + chunk.length, alumnos.length), alumnos.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return results;
  }

  private buildCarnetData(
    alumno: Alumno,
    shared: CarnetSharedAssets,
    qrDataUrl: string,
    fotoDataUrl: string | null
  ): CarnetData {
    const fechaNacimientoFormateada = new Date(
      alumno.fecha_nacimiento + 'T00:00:00'
    ).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return {
      alumno,
      nombreCompleto: `${alumno.nombres} ${alumno.apellidos}`,
      fotoDataUrl,
      logoDataUrl: shared.logoDataUrl,
      qrDataUrl,
      nombreAcademia: shared.nombreAcademia,
      fechaNacimientoFormateada,
    };
  }
}
