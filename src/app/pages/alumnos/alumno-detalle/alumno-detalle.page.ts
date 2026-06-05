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
  createOutline,
  idCardOutline,
  documentOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { LazyImageComponent } from '../../../components/lazy-image/lazy-image.component';
import { PdfViewerComponent } from '../../../components/pdf-viewer/pdf-viewer.component';
import { Alumno, GeneroAlumno, NivelAlumno } from '../../../interfaces/alumno.interface';
import { Convocatoria } from '../../../interfaces/convocatoria.interface';
import { AlumnosService } from '../../../services/alumnos.service';
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
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastCtrl = inject(ToastController);

  alumno: Alumno | null = null;
  convocatorias: Convocatoria[] = [];
  loading = true;
  loadingConvocatorias = true;
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
      personOutline,
      peopleOutline,
      basketballOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      return;
    }

    forkJoin({
      alumno: this.alumnosService.getById(id),
      convocatorias: this.alumnosService.getConvocatoriasByAlumnoId(id),
    }).subscribe({
      next: async ({ alumno, convocatorias }) => {
        this.alumno = alumno;
        this.convocatorias = convocatorias;
        this.loadingConvocatorias = false;
        this.documentoEsPdf = this.supabaseService.isPdfStored(
          alumno.foto_documento_url
        );
        await this.cargarArchivos(alumno);
        this.loading = false;
      },
      error: async () => {
        this.loading = false;
        this.loadingConvocatorias = false;
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

  get telefonoTutorHref(): string | null {
    const telefono = this.alumno?.telefono_tutor?.trim();
    if (!telefono) {
      return null;
    }

    const normalizado = telefono.replace(/[^\d+]/g, '');
    return normalizado.length > 0 ? `tel:${normalizado}` : null;
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

  generoLabel(genero: GeneroAlumno): string {
    const labels: Record<GeneroAlumno, string> = {
      masculino: 'Masculino',
      femenino: 'Femenino',
      otro: 'Otro',
    };
    return labels[genero];
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
