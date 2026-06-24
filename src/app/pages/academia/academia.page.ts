import {
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  checkmarkOutline,
  cloudUploadOutline,
  colorPaletteOutline,
  imageOutline,
  ribbonOutline,
} from 'ionicons/icons';
import { Subscription, switchMap } from 'rxjs';
import { CarnetCardComponent } from '../../components/carnet-card/carnet-card.component';
import { LazyImageComponent } from '../../components/lazy-image/lazy-image.component';
import { DEFAULT_CARNET_THEME } from '../../interfaces/carnet-theme.interface';
import { AuthService } from '../../services/auth.service';
import { AcademiaService } from '../../services/academia.service';
import { AcademiaContextService } from '../../services/academia-context.service';
import { CarnetRenderAssets } from '../../services/carnet-compositor.service';
import { CarnetData, CarnetService } from '../../services/carnet.service';
import { SupabaseService } from '../../services/supabase.service';
import { getStandardCarnetLayout } from '../../utils/carnet-layout.util';
import {
  isValidHexColor,
  normalizeHexColor,
  themeFromAcademia,
} from '../../utils/carnet-theme.util';
import { CARNET_HEIGHT, CARNET_WIDTH } from '../../constants/carnet.constants';

@Component({
  selector: 'app-academia',
  templateUrl: './academia.page.html',
  styleUrls: ['./academia.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner,
    IonIcon,
    LazyImageComponent,
    CarnetCardComponent,
  ],
})
export class AcademiaPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly academiaService = inject(AcademiaService);
  private readonly academiaContext = inject(AcademiaContextService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly carnetService = inject(CarnetService);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  private formSub?: Subscription;

  loading = true;
  loadingLogo = false;
  loadingSello = false;
  saving = false;
  uploadingLogo = false;
  uploadingSello = false;
  logoPreview: string | null = null;
  selloPreview: string | null = null;
  carnetPreviewSample: CarnetData | null = null;
  carnetPreviewAssets: CarnetRenderAssets | null = null;
  carnetPreviewScale = 0.42;
  readonly carnetWidth = CARNET_WIDTH;
  readonly carnetHeight = CARNET_HEIGHT;

  private localObjectUrl: string | null = null;
  private localSelloObjectUrl: string | null = null;

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    direccion: ['', Validators.required],
    logo_url: [''],
    sello_url: [''],
    carnet_color_franja_inicio: [
      DEFAULT_CARNET_THEME.franjaInicio,
      Validators.required,
    ],
    carnet_color_franja_fin: [DEFAULT_CARNET_THEME.franjaFin, Validators.required],
    carnet_color_marco_foto: [DEFAULT_CARNET_THEME.marcoFoto, Validators.required],
  });

  constructor() {
    addIcons({
      businessOutline,
      checkmarkOutline,
      cloudUploadOutline,
      imageOutline,
      ribbonOutline,
      colorPaletteOutline,
    });
  }

  ngOnInit(): void {
    this.formSub = this.form.valueChanges.subscribe(() => {
      void this.refreshCarnetPreviewAssets();
    });
    this.enforceAdminAccess();
  }

  ionViewWillEnter(): void {
    this.enforceAdminAccess();
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
    this.revokeLocalPreview();
    this.revokeLocalSelloPreview();
  }

  private enforceAdminAccess(): void {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/app/dashboard'], { replaceUrl: true });
      this.showToast('Solo un administrador puede acceder a Academia.', 'danger');
      return;
    }
    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    const academia = this.academiaContext.academiaActual();

    if (!academia) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.form.patchValue({
      nombre: academia.nombre,
      direccion: academia.direccion,
      logo_url: academia.logo_url ?? '',
      sello_url: academia.sello_url ?? '',
      carnet_color_franja_inicio: normalizeHexColor(
        academia.carnet_color_franja_inicio,
        DEFAULT_CARNET_THEME.franjaInicio
      ),
      carnet_color_franja_fin: normalizeHexColor(
        academia.carnet_color_franja_fin,
        DEFAULT_CARNET_THEME.franjaFin
      ),
      carnet_color_marco_foto: normalizeHexColor(
        academia.carnet_color_marco_foto,
        DEFAULT_CARNET_THEME.marcoFoto
      ),
    });
    this.loading = false;
    this.cdr.markForCheck();

    await this.refreshLogoPreview(academia.logo_url);
    await this.refreshSelloPreview(academia.sello_url);
    await this.initCarnetPreview();
  }

  private async initCarnetPreview(): Promise<void> {
    const sample = this.carnetService.buildPreviewSampleData(
      this.form.controls.nombre.value
    );
    try {
      sample.qrDataUrl = await this.carnetService.generateQrDataUrl(sample.alumno);
    } catch {
      sample.qrDataUrl = '';
    }
    this.carnetPreviewSample = sample;
    await this.refreshCarnetPreviewAssets();
    this.cdr.markForCheck();
  }

  private async refreshCarnetPreviewAssets(): Promise<void> {
    const raw = this.form.getRawValue();
    const theme = themeFromAcademia({
      carnet_color_franja_inicio: raw.carnet_color_franja_inicio,
      carnet_color_franja_fin: raw.carnet_color_franja_fin,
      carnet_color_marco_foto: raw.carnet_color_marco_foto,
    });

    let logoDataUrl: string | null = this.logoPreview;
    if (raw.logo_url) {
      const storedLogo = await this.carnetService.loadImageAsDataUrl(raw.logo_url);
      if (storedLogo) {
        logoDataUrl = storedLogo;
      }
    }

    this.carnetPreviewAssets = {
      nombreAcademia: raw.nombre,
      logoDataUrl,
      theme,
      layout: getStandardCarnetLayout(),
      canvasWidth: CARNET_WIDTH,
      canvasHeight: CARNET_HEIGHT,
    };

    if (this.carnetPreviewSample) {
      this.carnetPreviewSample = {
        ...this.carnetPreviewSample,
        nombreAcademia: raw.nombre,
      };
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      void this.showToast('Selecciona un archivo de imagen válido.', 'danger');
      input.value = '';
      return;
    }

    this.revokeLocalPreview();
    this.localObjectUrl = URL.createObjectURL(file);
    this.logoPreview = this.localObjectUrl;
    void this.refreshCarnetPreviewAssets();
    this.uploadingLogo = true;
    this.cdr.markForCheck();

    const previousPath = this.form.controls.logo_url.value || null;
    const academiaId = this.academiaContext.academiaId();

    if (!academiaId) {
      this.uploadingLogo = false;
      this.cdr.markForCheck();
      void this.showToast('No hay academia activa.', 'danger');
      return;
    }

    this.academiaService
      .uploadLogo(file, previousPath)
      .pipe(
        switchMap((path) =>
          this.academiaService.update(academiaId, this.buildAcademiaPayload(path))
        )
      )
      .subscribe({
        next: async (config) => {
          this.form.patchValue({ logo_url: config.logo_url ?? '' });
          this.revokeLocalPreview();
          await this.refreshLogoPreview(config.logo_url);
          this.academiaContext.academiaActual.set(config);
          void this.refreshCarnetPreviewAssets();
          this.uploadingLogo = false;
          input.value = '';
          this.cdr.markForCheck();
          await this.showToast('Logo actualizado correctamente', 'success');
        },
        error: async (err: Error) => {
          this.uploadingLogo = false;
          input.value = '';
          this.cdr.markForCheck();
          await this.showToast(err.message, 'danger');
        },
      });
  }

  onSelloSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!file) return;

    if (file.type !== 'image/png') {
      void this.showToast('El sello debe ser un archivo PNG.', 'danger');
      input.value = '';
      return;
    }

    this.revokeLocalSelloPreview();
    this.localSelloObjectUrl = URL.createObjectURL(file);
    this.selloPreview = this.localSelloObjectUrl;
    this.uploadingSello = true;
    this.cdr.markForCheck();

    const previousPath = this.form.controls.sello_url.value || null;
    const academiaId = this.academiaContext.academiaId();

    if (!academiaId) {
      this.uploadingSello = false;
      this.cdr.markForCheck();
      void this.showToast('No hay academia activa.', 'danger');
      return;
    }

    this.academiaService
      .uploadSello(file, previousPath)
      .pipe(
        switchMap((path) =>
          this.academiaService.update(academiaId, {
            ...this.buildAcademiaPayload(),
            sello_url: path,
          })
        )
      )
      .subscribe({
        next: async (config) => {
          this.form.patchValue({ sello_url: config.sello_url ?? '' });
          this.revokeLocalSelloPreview();
          await this.refreshSelloPreview(config.sello_url);
          this.academiaContext.academiaActual.set(config);
          this.uploadingSello = false;
          input.value = '';
          this.cdr.markForCheck();
          await this.showToast('Sello actualizado correctamente', 'success');
        },
        error: async (err: Error) => {
          this.uploadingSello = false;
          input.value = '';
          this.cdr.markForCheck();
          await this.showToast(err.message, 'danger');
        },
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.areCarnetColorsValid()) {
      void this.showToast('Revisa los colores del carnet (formato #RRGGBB).', 'danger');
      return;
    }

    const academiaId = this.academiaContext.academiaId();
    if (!academiaId) {
      void this.showToast('No hay academia activa.', 'danger');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.academiaService.update(academiaId, this.buildAcademiaPayload()).subscribe({
      next: async (config) => {
        await this.refreshLogoPreview(config.logo_url);
        this.academiaContext.academiaActual.set(config);
        this.saving = false;
        this.cdr.markForCheck();
        await this.showToast('Información de la academia guardada', 'success');
      },
      error: async (err: Error) => {
        this.saving = false;
        this.cdr.markForCheck();
        await this.showToast(err.message, 'danger');
      },
    });
  }

  private buildAcademiaPayload(logoUrl?: string | null) {
    const {
      nombre,
      direccion,
      logo_url,
      sello_url,
      carnet_color_franja_inicio,
      carnet_color_franja_fin,
      carnet_color_marco_foto,
    } = this.form.getRawValue();

    return {
      nombre,
      direccion,
      logo_url: (logoUrl ?? logo_url) || null,
      sello_url: sello_url || null,
      carnet_color_franja_inicio: normalizeHexColor(
        carnet_color_franja_inicio,
        DEFAULT_CARNET_THEME.franjaInicio
      ),
      carnet_color_franja_fin: normalizeHexColor(
        carnet_color_franja_fin,
        DEFAULT_CARNET_THEME.franjaFin
      ),
      carnet_color_marco_foto: normalizeHexColor(
        carnet_color_marco_foto,
        DEFAULT_CARNET_THEME.marcoFoto
      ),
    };
  }

  private areCarnetColorsValid(): boolean {
    const {
      carnet_color_franja_inicio,
      carnet_color_franja_fin,
      carnet_color_marco_foto,
    } = this.form.getRawValue();

    return (
      isValidHexColor(carnet_color_franja_inicio) &&
      isValidHexColor(carnet_color_franja_fin) &&
      isValidHexColor(carnet_color_marco_foto)
    );
  }

  private async refreshLogoPreview(
    stored: string | null | undefined
  ): Promise<void> {
    if (!stored) {
      this.logoPreview = null;
      this.loadingLogo = false;
      void this.refreshCarnetPreviewAssets();
      return;
    }

    this.loadingLogo = true;
    this.cdr.markForCheck();

    try {
      this.logoPreview = await this.supabaseService.resolveFileUrl(stored, true);
    } catch {
      this.logoPreview = null;
    } finally {
      this.loadingLogo = false;
      void this.refreshCarnetPreviewAssets();
      this.cdr.markForCheck();
    }
  }

  private async refreshSelloPreview(
    stored: string | null | undefined
  ): Promise<void> {
    if (!stored) {
      this.selloPreview = null;
      this.loadingSello = false;
      return;
    }

    this.loadingSello = true;
    this.cdr.markForCheck();

    try {
      this.selloPreview = await this.supabaseService.resolveFileUrl(stored, true);
    } catch {
      this.selloPreview = null;
    } finally {
      this.loadingSello = false;
      this.cdr.markForCheck();
    }
  }

  private revokeLocalPreview(): void {
    if (this.localObjectUrl) {
      URL.revokeObjectURL(this.localObjectUrl);
      this.localObjectUrl = null;
    }
  }

  private revokeLocalSelloPreview(): void {
    if (this.localSelloObjectUrl) {
      URL.revokeObjectURL(this.localSelloObjectUrl);
      this.localSelloObjectUrl = null;
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
