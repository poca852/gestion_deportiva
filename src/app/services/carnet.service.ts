import { Injectable, inject } from '@angular/core';
import { toDataURL } from 'qrcode';
import { environment } from '../../environments/environment';
import { CARNET_DATA_BATCH_SIZE, CARNET_HEIGHT, CARNET_WIDTH } from '../constants/carnet.constants';
import { Alumno } from '../interfaces/alumno.interface';
import { formatCategoriaCarnet } from '../utils/carnet-format.util';
import { getStandardCarnetLayout } from '../utils/carnet-layout.util';
import { themeFromAcademia } from '../utils/carnet-theme.util';
import { AcademiaContextService } from './academia-context.service';
import {
  CarnetCompositorService,
  CarnetRenderAssets,
} from './carnet-compositor.service';
import { SupabaseService } from './supabase.service';

export interface CarnetData {
  alumno: Alumno;
  nombreCompleto: string;
  nombresDisplay: string;
  apellidosDisplay: string;
  categoriaDisplay: string;
  fotoDataUrl: string | null;
  qrDataUrl: string;
  nombreAcademia: string;
}

@Injectable({
  providedIn: 'root',
})
export class CarnetService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly academiaContext = inject(AcademiaContextService);
  private readonly compositor = inject(CarnetCompositorService);

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

  async getRenderAssets(): Promise<CarnetRenderAssets> {
    const academia = this.academiaContext.academiaActual();
    const nombreAcademia = academia?.nombre ?? '';
    const theme = themeFromAcademia(academia);

    const logoDataUrl = academia?.logo_url
      ? await this.loadImageAsDataUrl(academia.logo_url)
      : null;

    return {
      nombreAcademia,
      logoDataUrl,
      theme,
      layout: getStandardCarnetLayout(),
      canvasWidth: CARNET_WIDTH,
      canvasHeight: CARNET_HEIGHT,
    };
  }

  async getCarnetDataForAlumno(
    alumno: Alumno,
    nombreAcademia = ''
  ): Promise<CarnetData> {
    const academia = this.academiaContext.academiaActual();
    const academyName = nombreAcademia || academia?.nombre || '';

    const [qrDataUrl, fotoDataUrl] = await Promise.all([
      this.generateQrDataUrl(alumno),
      this.loadImageAsDataUrl(alumno.foto_estudiante_url),
    ]);

    return this.buildCarnetData(alumno, academyName, qrDataUrl, fotoDataUrl);
  }

  async prepareBatchData(
    alumnos: Alumno[],
    onProgress?: (current: number, total: number) => void
  ): Promise<CarnetData[]> {
    const academia = this.academiaContext.academiaActual();
    const nombreAcademia = academia?.nombre ?? '';
    const results: CarnetData[] = [];

    for (let i = 0; i < alumnos.length; i += CARNET_DATA_BATCH_SIZE) {
      const chunk = alumnos.slice(i, i + CARNET_DATA_BATCH_SIZE);
      const chunkData = await Promise.all(
        chunk.map((alumno) =>
          this.getCarnetDataForAlumno(alumno, nombreAcademia)
        )
      );
      results.push(...chunkData);
      onProgress?.(Math.min(i + chunk.length, alumnos.length), alumnos.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return results;
  }

  async renderCarnetCanvas(
    data: CarnetData,
    assets?: CarnetRenderAssets
  ): Promise<HTMLCanvasElement> {
    const renderAssets = assets ?? (await this.getRenderAssets());
    return this.compositor.compose(data, renderAssets);
  }

  buildPreviewSampleData(nombreAcademia: string): CarnetData {
    const alumno: Alumno = {
      id: 'preview',
      nombres: 'Mateo Sebastian',
      apellidos: 'Alvarez Soto',
      fecha_nacimiento: '2017-02-28',
      genero: 'masculino',
      nombre_tutor: 'María García',
      telefono_tutor: '5555-1234',
      foto_estudiante_url: null,
      foto_documento_url: null,
      foto_documento_padre_url: null,
      talla_camiseta: 'M',
      categoria: 'U12',
      nivel: null,
      fecha_ingreso: null,
      public_token: 'preview-token',
      created_at: '',
      updated_at: '',
    };

    return {
      alumno,
      nombreCompleto: `${alumno.nombres} ${alumno.apellidos}`,
      nombresDisplay: alumno.nombres,
      apellidosDisplay: alumno.apellidos,
      categoriaDisplay: formatCategoriaCarnet(alumno.categoria),
      fotoDataUrl: null,
      qrDataUrl: '',
      nombreAcademia,
    };
  }

  private buildCarnetData(
    alumno: Alumno,
    nombreAcademia: string,
    qrDataUrl: string,
    fotoDataUrl: string | null
  ): CarnetData {
    return {
      alumno,
      nombreCompleto: `${alumno.nombres} ${alumno.apellidos}`,
      nombresDisplay: alumno.nombres,
      apellidosDisplay: alumno.apellidos,
      categoriaDisplay: formatCategoriaCarnet(alumno.categoria),
      fotoDataUrl,
      qrDataUrl,
      nombreAcademia,
    };
  }
}
