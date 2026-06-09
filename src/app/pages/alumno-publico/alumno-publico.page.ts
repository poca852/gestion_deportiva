import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonNote,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  documentOutline,
  downloadOutline,
  eyeOutline,
  personCircleOutline,
  ribbonOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { LazyImageComponent } from '../../components/lazy-image/lazy-image.component';
import { PdfViewerComponent } from '../../components/pdf-viewer/pdf-viewer.component';
import { AlumnoPublicProfile } from '../../interfaces/alumno-publico.interface';
import { PublicAlumnoService } from '../../services/public-alumno.service';
import { MayusculasPipe } from '../../pipes/mayusculas.pipe';

@Component({
  selector: 'app-alumno-publico',
  templateUrl: './alumno-publico.page.html',
  styleUrls: ['./alumno-publico.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonSpinner,
    IonIcon,
    IonButton,
    IonNote,
    LazyImageComponent,
    PdfViewerComponent,
    MayusculasPipe,
  ],
})
export class AlumnoPublicoPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicAlumnoService = inject(PublicAlumnoService);
  private readonly toastCtrl = inject(ToastController);

  perfil: AlumnoPublicProfile | null = null;
  loading = true;
  errorMessage: string | null = null;
  descargandoDocumento = false;

  constructor() {
    addIcons({
      calendarOutline,
      documentOutline,
      downloadOutline,
      eyeOutline,
      personCircleOutline,
      ribbonOutline,
      shieldCheckmarkOutline,
    });
  }

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading = false;
      this.errorMessage = 'Enlace de perfil inválido';
      return;
    }

    this.publicAlumnoService.getProfileByToken(token).subscribe({
      next: (perfil) => {
        this.perfil = perfil;
        this.loading = false;
      },
      error: (err: Error) => {
        this.loading = false;
        this.errorMessage = err.message || 'No se pudo cargar el perfil';
      },
    });
  }

  get nombreCompleto(): string {
    if (!this.perfil) return '';
    return `${this.perfil.nombres} ${this.perfil.apellidos}`;
  }

  get iniciales(): string {
    if (!this.perfil) return '';
    const n = this.perfil.nombres.charAt(0) || '';
    const a = this.perfil.apellidos.charAt(0) || '';
    return (n + a).toUpperCase();
  }

  get tieneDocumento(): boolean {
    return !!this.perfil?.documento_url;
  }

  get documentoDownloadName(): string {
    if (!this.perfil) return 'documento-alumno';
    const slug = `${this.perfil.apellidos}-${this.perfil.nombres}`
      .toLowerCase()
      .replace(/\s+/g, '-');
    return this.perfil.documento_es_pdf
      ? `partida-nacimiento-${slug}.pdf`
      : `documento-${slug}.jpg`;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  async descargarDocumento(): Promise<void> {
    if (!this.perfil?.documento_url || this.descargandoDocumento) return;

    this.descargandoDocumento = true;
    try {
      const response = await fetch(this.perfil.documento_url);
      const blob = await response.blob();

      if (Capacitor.isNativePlatform()) {
        await this.descargarNativo(blob);
      } else {
        this.descargarWeb(blob);
      }
    } catch {
      const toast = await this.toastCtrl.create({
        message: 'No se pudo descargar el documento',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.descargandoDocumento = false;
    }
  }

  private descargarWeb(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.documentoDownloadName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private async descargarNativo(blob: Blob): Promise<void> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const base64 = await this.blobToBase64(blob);

    try {
      await Filesystem.writeFile({
        path: this.documentoDownloadName,
        data: base64,
        directory: Directory.Documents,
      });

      const toast = await this.toastCtrl.create({
        message: `Documento guardado: ${this.documentoDownloadName}`,
        duration: 4000,
        color: 'success',
      });
      await toast.present();
    } catch {
      window.open(this.perfil!.documento_url!, '_blank');
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(blob);
    });
  }
}
