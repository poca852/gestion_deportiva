import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  cloudDownloadOutline,
  shareOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { CarnetCardComponent } from '../../../components/carnet-card/carnet-card.component';
import { CARNET_HEIGHT, CARNET_WIDTH } from '../../../constants/carnet.constants';
import { CarnetRenderAssets } from '../../../services/carnet-compositor.service';
import { AlumnosService } from '../../../services/alumnos.service';
import { CarnetExportService } from '../../../services/carnet-export.service';
import { CarnetData, CarnetService } from '../../../services/carnet.service';

@Component({
  selector: 'app-carnet',
  templateUrl: './carnet.page.html',
  styleUrls: ['./carnet.page.scss'],
  standalone: true,
  imports: [
    RouterLink,
    CarnetCardComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonSpinner,
  ],
})
export class CarnetPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('previewViewport') previewViewport?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly alumnosService = inject(AlumnosService);
  private readonly carnetService = inject(CarnetService);
  private readonly exportService = inject(CarnetExportService);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  private resizeObserver?: ResizeObserver;
  private readonly onWindowResize = () => this.actualizarEscalaVista();

  loading = true;
  downloading = false;
  sharing = false;
  mensajeExportacion = '';
  carnetData: CarnetData | null = null;
  renderAssets: CarnetRenderAssets | null = null;
  error = false;

  previewScale = 1;
  previewBoxWidth = CARNET_WIDTH;
  previewBoxHeight = CARNET_HEIGHT;
  readonly carnetWidth = CARNET_WIDTH;
  readonly carnetHeight = CARNET_HEIGHT;

  get exportando(): boolean {
    return this.downloading || this.sharing;
  }

  constructor() {
    addIcons({ cloudDownloadOutline, shareOutline, arrowBackOutline });
  }

  ngOnInit(): void {
    void this.cargarCarnet();
  }

  ngAfterViewInit(): void {
    window.addEventListener('resize', this.onWindowResize);
    this.iniciarObservadorVista();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onWindowResize);
    this.resizeObserver?.disconnect();
  }

  private async cargarCarnet(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = true;
      this.loading = false;
      return;
    }

    try {
      const [alumno, assets] = await Promise.all([
        firstValueFrom(this.alumnosService.getById(id)),
        this.carnetService.getRenderAssets(),
      ]);
      this.renderAssets = assets;
      this.carnetData = await this.carnetService.getCarnetDataForAlumno(
        alumno,
        assets.nombreAcademia
      );
      requestAnimationFrame(() => this.actualizarEscalaVista());
    } catch {
      this.error = true;
      await this.mostrarToast('No se pudo cargar la información del alumno', 'danger');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
      if (this.carnetData) {
        requestAnimationFrame(() => {
          this.iniciarObservadorVista();
          this.actualizarEscalaVista();
        });
      }
    }
  }

  private iniciarObservadorVista(): void {
    const el = this.previewViewport?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.actualizarEscalaVista());
    this.resizeObserver.observe(el);
  }

  private actualizarEscalaVista(): void {
    const viewport = this.previewViewport?.nativeElement;
    if (!viewport) return;

    const cardWidth = this.renderAssets?.canvasWidth ?? CARNET_WIDTH;
    const cardHeight = this.renderAssets?.canvasHeight ?? CARNET_HEIGHT;
    const availableWidth = viewport.clientWidth;
    const isMobile = window.innerWidth < 768;

    const scale = isMobile
      ? availableWidth / cardWidth
      : Math.min(availableWidth / cardWidth, 1);

    this.previewScale = scale;
    this.previewBoxWidth = Math.round(cardWidth * scale);
    this.previewBoxHeight = Math.round(cardHeight * scale);
    this.cdr.markForCheck();
  }

  async descargarCarnet(): Promise<void> {
    if (!this.carnetData || this.exportando) return;

    await this.iniciarExportacion('descargando', 'Generando carnet para descargar...');

    try {
      const canvas = await this.carnetService.renderCarnetCanvas(
        this.carnetData,
        this.renderAssets ?? undefined
      );
      this.mensajeExportacion = 'Guardando imagen...';
      this.cdr.detectChanges();
      await this.exportService.yieldToUi();

      const filename = this.exportService.buildCarnetFilename(this.carnetData);
      const result = await this.exportService.downloadCanvas(canvas, filename);
      await this.mostrarToast(
        this.exportService.downloadResultMessage(result),
        'success',
        result.method === 'native' ? 4000 : 2500
      );
    } catch {
      await this.mostrarToast('No se pudo descargar el carnet', 'danger');
    } finally {
      this.finalizarExportacion();
    }
  }

  async compartirCarnet(): Promise<void> {
    if (!this.carnetData || this.exportando) return;

    await this.iniciarExportacion('compartiendo', 'Preparando carnet para compartir...');

    try {
      const canvas = await this.carnetService.renderCarnetCanvas(
        this.carnetData,
        this.renderAssets ?? undefined
      );
      this.mensajeExportacion = 'Abriendo opciones para compartir...';
      this.cdr.detectChanges();
      await this.exportService.yieldToUi();

      const filename = this.exportService.buildCarnetFilename(this.carnetData);
      const result = await this.exportService.shareCanvas(
        canvas,
        filename,
        `Carnet de ${this.carnetData.nombreCompleto}`
      );

      if (result === false) {
        await this.mostrarToast(
          'No se pudo compartir el carnet en este dispositivo',
          'warning'
        );
        return;
      }

      if (result === 'downloaded') {
        await this.mostrarToast(
          'Tu navegador no permite compartir archivos; se descargó el carnet',
          'success'
        );
        return;
      }

      await this.mostrarToast('Carnet listo para compartir', 'success');
    } catch {
      await this.mostrarToast('No se pudo compartir el carnet', 'danger');
    } finally {
      this.finalizarExportacion();
    }
  }

  private async iniciarExportacion(
    accion: 'descargando' | 'compartiendo',
    mensaje: string
  ): Promise<void> {
    this.mensajeExportacion = mensaje;
    if (accion === 'descargando') {
      this.downloading = true;
    } else {
      this.sharing = true;
    }
    this.cdr.detectChanges();
    await this.exportService.yieldToUi();
  }

  private finalizarExportacion(): void {
    this.downloading = false;
    this.sharing = false;
    this.mensajeExportacion = '';
    this.cdr.detectChanges();
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
    duration = color === 'success' ? 2000 : 3000
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      color,
    });
    await toast.present();
  }
}
