import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  basketballOutline,
  callOutline,
  calendarOutline,
  checkmarkCircleOutline,
  createOutline,
  searchOutline,
  idCardOutline,
  documentOutline,
  linkOutline,
  openOutline,
  copyOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';
import { catchError, forkJoin, of } from 'rxjs';
import { LazyImageComponent } from '../../../components/lazy-image/lazy-image.component';
import { PdfViewerComponent } from '../../../components/pdf-viewer/pdf-viewer.component';
import { Alumno, GeneroAlumno, NivelAlumno } from '../../../interfaces/alumno.interface';
import { Convocatoria } from '../../../interfaces/convocatoria.interface';
import { ResumenAsistenciaAlumno } from '../../../interfaces/sesion-entrenamiento.interface';
import { AlumnosService } from '../../../services/alumnos.service';
import { AsistenciasService } from '../../../services/asistencias.service';
import { PublicAlumnoService } from '../../../services/public-alumno.service';
import { SupabaseService } from '../../../services/supabase.service';
import { MayusculasPipe } from '../../../pipes/mayusculas.pipe';

@Component({
  selector: 'app-alumno-detalle',
  templateUrl: './alumno-detalle.page.html',
  styleUrls: ['./alumno-detalle.page.scss'],
  standalone: true,
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonChip,
    IonList,
    IonItem,
    IonInput,
    IonLabel,
    IonNote,
    LazyImageComponent,
    PdfViewerComponent,
    MayusculasPipe,
  ],
})
export class AlumnoDetallePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly alumnosService = inject(AlumnosService);
  private readonly asistenciasService = inject(AsistenciasService);
  private readonly publicAlumnoService = inject(PublicAlumnoService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastCtrl = inject(ToastController);

  alumnoId: string | null = null;
  alumno: Alumno | null = null;
  convocatorias: Convocatoria[] = [];
  resumenAsistencia: ResumenAsistenciaAlumno | null = null;
  fechaDesde = '';
  fechaHasta = '';
  loading = true;
  loadingConvocatorias = true;
  loadingAsistencia = true;
  loadingFotoEstudiante = false;
  loadingDocumento = false;
  loadingDocumentoPadre = false;
  fotoEstudianteUrl: string | null = null;
  documentoUrl: string | null = null;
  documentoPadreUrl: string | null = null;
  documentoEsPdf = false;
  documentoPadreEsPdf = false;

  constructor() {
    addIcons({
      callOutline,
      calendarOutline,
      createOutline,
      documentOutline,
      idCardOutline,
      linkOutline,
      openOutline,
      copyOutline,
      personOutline,
      peopleOutline,
      basketballOutline,
      checkmarkCircleOutline,
      searchOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      return;
    }

    this.alumnoId = id;

    forkJoin({
      alumno: this.alumnosService.getById(id),
      convocatorias: this.alumnosService.getConvocatoriasByAlumnoId(id),
    }).subscribe({
      next: async ({ alumno, convocatorias }) => {
        this.alumno = alumno;
        this.convocatorias = convocatorias;
        this.loadingConvocatorias = false;
        this.inicializarFechasAsistencia(alumno);
        this.consultarAsistencia();
        this.documentoEsPdf = this.supabaseService.isPdfStored(
          alumno.foto_documento_url
        );
        await this.cargarArchivos(alumno);
        this.loading = false;
      },
      error: async () => {
        this.loading = false;
        this.loadingConvocatorias = false;
        this.loadingAsistencia = false;
        const toast = await this.toastCtrl.create({
          message: 'No se pudo cargar el alumno',
          duration: 2500,
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  get nombreCompleto(): string {
    if (!this.alumno) return '';
    return `${this.alumno.nombres} ${this.alumno.apellidos}`;
  }

  get tieneDocumento(): boolean {
    return !!this.alumno?.foto_documento_url;
  }

  get tieneDocumentoPadre(): boolean {
    return !!this.alumno?.foto_documento_padre_url;
  }

  get fechaMaxima(): string {
    return this.asistenciasService.localDateString();
  }

  get telefonoTutorHref(): string | null {
    const telefono = this.alumno?.telefono_tutor?.trim();
    if (!telefono) {
      return null;
    }

    const normalizado = telefono.replace(/[^\d+]/g, '');
    return normalizado.length > 0 ? `tel:${normalizado}` : null;
  }

  get perfilPublicoUrl(): string | null {
    if (!this.alumno?.public_token) return null;
    return this.publicAlumnoService.buildPublicProfileUrl(this.alumno.public_token);
  }

  async copiarEnlacePublico(): Promise<void> {
    const url = this.perfilPublicoUrl;
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      const toast = await this.toastCtrl.create({
        message: 'Enlace del perfil público copiado',
        duration: 2500,
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: 'No se pudo copiar el enlace',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
    }
  }

  abrirPerfilPublico(): void {
    const url = this.perfilPublicoUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  nivelLabel(nivel: NivelAlumno | null): string {
    const labels: Record<string, string> = {
      basico: 'Básico',
      intermedio: 'Intermedio',
      avanzado: 'Avanzado',
    };
    return nivel ? labels[nivel] || nivel : '';
  }

  nivelColor(nivel: NivelAlumno | null): string {
    const colores: Record<string, string> = {
      basico: '#e74c3c',
      intermedio: '#f1c40f',
      avanzado: '#2ecc71',
    };
    return nivel ? colores[nivel] || '#999' : '#999';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  consultarAsistencia(): void {
    if (!this.alumnoId || !this.fechaDesde || !this.fechaHasta) {
      return;
    }

    if (this.fechaDesde > this.fechaHasta) {
      void this.mostrarToast(
        'La fecha de inicio no puede ser posterior a la fecha de fin',
        'warning'
      );
      return;
    }

    this.loadingAsistencia = true;
    this.asistenciasService
      .getResumenAlumno(this.alumnoId, this.fechaDesde, this.fechaHasta)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (resumen) => {
          this.resumenAsistencia = resumen;
          this.loadingAsistencia = false;
        },
        error: async () => {
          this.resumenAsistencia = null;
          this.loadingAsistencia = false;
          await this.mostrarToast('No se pudo cargar la asistencia', 'danger');
        },
      });
  }

  generoLabel(genero: GeneroAlumno): string {
    const labels: Record<GeneroAlumno, string> = {
      masculino: 'Masculino',
      femenino: 'Femenino',
      otro: 'Otro',
    };
    return labels[genero];
  }

  private inicializarFechasAsistencia(alumno: Alumno): void {
    this.fechaHasta = this.asistenciasService.localDateString();
    if (alumno.fecha_ingreso) {
      this.fechaDesde = alumno.fecha_ingreso;
      return;
    }

    const year = new Date().getFullYear();
    this.fechaDesde = `${year}-01-01`;
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
    });
    await toast.present();
  }

  private async cargarArchivos(alumno: Alumno): Promise<void> {
    if (alumno.foto_estudiante_url) {
      this.loadingFotoEstudiante = true;
      try {
        this.fotoEstudianteUrl = await this.supabaseService.resolveFileUrl(
          alumno.foto_estudiante_url
        );
      } catch {
        this.fotoEstudianteUrl = null;
      } finally {
        this.loadingFotoEstudiante = false;
      }
    }

    if (alumno.foto_documento_url) {
      this.loadingDocumento = true;
      try {
        this.documentoUrl = await this.supabaseService.resolveFileUrl(
          alumno.foto_documento_url
        );
      } catch {
        this.documentoUrl = null;
      } finally {
        this.loadingDocumento = false;
      }
    }

    if (alumno.foto_documento_padre_url) {
      this.loadingDocumentoPadre = true;
      this.documentoPadreEsPdf = this.supabaseService.isPdfStored(
        alumno.foto_documento_padre_url
      );
      try {
        this.documentoPadreUrl = await this.supabaseService.resolveFileUrl(
          alumno.foto_documento_padre_url
        );
      } catch {
        this.documentoPadreUrl = null;
      } finally {
        this.loadingDocumentoPadre = false;
      }
    }
  }
}
