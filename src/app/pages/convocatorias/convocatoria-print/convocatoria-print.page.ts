import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { forkJoin, firstValueFrom } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline,
  imageOutline,
  printOutline,
} from 'ionicons/icons';
import { SignaturePadComponent } from '../../../components/signature-pad/signature-pad.component';
import { LazyImageComponent } from '../../../components/lazy-image/lazy-image.component';
import { Academia } from '../../../interfaces/academia.interface';
import { ConvocatoriaConPlantilla } from '../../../interfaces/convocatoria.interface';
import { AcademiaContextService } from '../../../services/academia-context.service';
import { AcademiaBrandingService } from '../../../services/academia-branding.service';
import { AuthService } from '../../../services/auth.service';
import { ConvocatoriaExportService } from '../../../services/convocatoria-export.service';
import { ConvocatoriasService } from '../../../services/convocatorias.service';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-convocatoria-print',
  templateUrl: './convocatoria-print.page.html',
  styleUrls: ['./convocatoria-print.page.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonIcon,
    IonSpinner,
    LazyImageComponent,
    SignaturePadComponent,
  ],
})
export class ConvocatoriaPrintPage implements OnInit {
  @ViewChild('printDocument') printDocumentRef?: ElementRef<HTMLElement>;
  @ViewChild('signaturePad') signaturePad?: SignaturePadComponent;

  private readonly route = inject(ActivatedRoute);
  private readonly convocatoriasService = inject(ConvocatoriasService);
  private readonly academiaContext = inject(AcademiaContextService);
  private readonly branding = inject(AcademiaBrandingService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly exportService = inject(ConvocatoriaExportService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  convocatoria: ConvocatoriaConPlantilla | null = null;
  academyName = this.branding.defaultNombre;
  academyDireccion: string | null = null;
  academyLogoDataUrl: string | null = null;
  academySelloDataUrl: string | null = null;
  firmaDataUrl: string | null = null;
  loadingLogo = false;
  loadingSello = false;
  loadingFirma = false;
  loading = true;
  savingFirma = false;
  exporting = false;

  constructor() {
    addIcons({ cloudDownloadOutline, imageOutline, printOutline });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.convocatoriasService.getWithPlantilla(id).subscribe({
      next: async (convocatoria) => {
        this.convocatoria = convocatoria;

        const academia = this.academiaContext.academiaActual();
        if (academia) {
          this.academyName = academia.nombre;
          this.academyDireccion = academia.direccion;
        }

        this.loading = false;
        this.cdr.markForCheck();

        void this.loadAssets(academia, convocatoria);
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get canSign(): boolean {
    const profile = this.authService.currentProfile;
    const conv = this.convocatoria;
    if (!profile || !conv) return false;
    return (
      this.authService.isAdmin() || conv.creado_por === profile.id
    );
  }

  get exportFilename(): string {
    if (!this.convocatoria) return 'convocatoria';
    return this.exportService.buildFilename(this.convocatoria);
  }

  formatFecha(fecha: string): string {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  imprimir(): void {
    this.exportService.printWithFilename(this.exportFilename);
  }

  async descargarPdf(): Promise<void> {
    const element = this.printDocumentRef?.nativeElement;
    if (!element) return;

    this.exporting = true;
    try {
      await this.exportService.downloadPdf(element, this.exportFilename);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'No se pudo generar el PDF',
        'danger'
      );
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  async descargarImagen(): Promise<void> {
    const element = this.printDocumentRef?.nativeElement;
    if (!element) return;

    this.exporting = true;
    try {
      await this.exportService.downloadImage(element, this.exportFilename);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'No se pudo generar la imagen',
        'danger'
      );
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  async guardarFirma(): Promise<void> {
    const pad = this.signaturePad;
    const conv = this.convocatoria;
    if (!pad || !conv) return;

    if (pad.isEmpty()) {
      await this.showToast('Dibuja tu firma antes de guardar.', 'danger');
      return;
    }

    this.savingFirma = true;
    this.cdr.markForCheck();

    try {
      const blob = await pad.toBlob();
      const path = await this.supabaseService.uploadConvocatoriaFirma(
        conv.id,
        blob,
        conv.firma_entrenador_url
      );
      const updated = await firstValueFrom(
        this.convocatoriasService.saveFirma(conv.id, path)
      );
      this.convocatoria = { ...conv, ...updated };
      this.firmaDataUrl = await this.blobToDataUrl(blob);
      await this.showToast('Firma guardada correctamente', 'success');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'No se pudo guardar la firma',
        'danger'
      );
    } finally {
      this.savingFirma = false;
      this.cdr.markForCheck();
    }
  }

  private async loadAssets(
    config: Academia | null,
    convocatoria: ConvocatoriaConPlantilla
  ): Promise<void> {
    if (config?.logo_url) {
      this.loadingLogo = true;
      this.cdr.markForCheck();
      try {
        this.academyLogoDataUrl =
          await this.supabaseService.resolveFileAsDataUrl(config.logo_url);
      } catch {
        this.academyLogoDataUrl = null;
      } finally {
        this.loadingLogo = false;
        this.cdr.markForCheck();
      }
    }

    if (config?.sello_url) {
      this.loadingSello = true;
      this.cdr.markForCheck();
      try {
        this.academySelloDataUrl =
          await this.supabaseService.resolveFileAsDataUrl(config.sello_url);
      } catch {
        this.academySelloDataUrl = null;
      } finally {
        this.loadingSello = false;
        this.cdr.markForCheck();
      }
    }

    if (convocatoria.firma_entrenador_url) {
      this.loadingFirma = true;
      this.cdr.markForCheck();
      try {
        this.firmaDataUrl = await this.supabaseService.resolveFileAsDataUrl(
          convocatoria.firma_entrenador_url
        );
      } catch {
        this.firmaDataUrl = null;
      } finally {
        this.loadingFirma = false;
        this.cdr.markForCheck();
      }
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la firma'));
      reader.readAsDataURL(blob);
    });
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
