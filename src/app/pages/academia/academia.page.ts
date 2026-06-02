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
  imageOutline,
  ribbonOutline,
} from 'ionicons/icons';
import { switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AcademiaService } from '../../services/academia.service';
import { AcademiaContextService } from '../../services/academia-context.service';
import { AcademiaBrandingService } from '../../services/academia-branding.service';
import { SupabaseService } from '../../services/supabase.service';
import { LazyImageComponent } from '../../components/lazy-image/lazy-image.component';

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
  ],
})
export class AcademiaPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly academiaService = inject(AcademiaService);
  private readonly academiaContext = inject(AcademiaContextService);
  private readonly branding = inject(AcademiaBrandingService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  loadingLogo = false;
  loadingSello = false;
  saving = false;
  uploadingLogo = false;
  uploadingSello = false;
  logoPreview: string | null = null;
  selloPreview: string | null = null;
  private localObjectUrl: string | null = null;
  private localSelloObjectUrl: string | null = null;

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    direccion: ['', Validators.required],
    logo_url: [''],
    sello_url: [''],
  });

  constructor() {
    addIcons({
      businessOutline,
      checkmarkOutline,
      cloudUploadOutline,
      imageOutline,
      ribbonOutline,
    });
  }

  ngOnInit(): void {
    this.enforceAdminAccess();
  }

  ionViewWillEnter(): void {
    this.enforceAdminAccess();
  }

  ngOnDestroy(): void {
    this.revokeLocalPreview();
    this.revokeLocalSelloPreview();
  }

  private enforceAdminAccess(): void {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/app/dashboard'], { replaceUrl: true });
      this.showToast('Solo un administrador puede acceder a Academia.', 'danger');
      return;
    }
    this.loadConfig();
  }

  loadConfig(): void {
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
    });
    this.loading = false;
    this.cdr.markForCheck();

    void this.refreshLogoPreview(academia.logo_url);
    void this.refreshSelloPreview(academia.sello_url);
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
          this.academiaService.update(academiaId, {
            nombre: this.form.controls.nombre.value,
            direccion: this.form.controls.direccion.value,
            logo_url: path,
            sello_url: this.form.controls.sello_url.value || null,
          })
        )
      )
      .subscribe({
        next: async (config) => {
          this.form.patchValue({ logo_url: config.logo_url ?? '' });
          this.revokeLocalPreview();
          await this.refreshLogoPreview(config.logo_url);
          // Actualizar el contexto con los nuevos datos
          this.academiaContext.academiaActual.set(config);
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
            nombre: this.form.controls.nombre.value,
            direccion: this.form.controls.direccion.value,
            logo_url: this.form.controls.logo_url.value || null,
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

    const { nombre, direccion, logo_url, sello_url } = this.form.getRawValue();
    const academiaId = this.academiaContext.academiaId();

    if (!academiaId) {
      void this.showToast('No hay academia activa.', 'danger');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.academiaService
      .update(academiaId, {
        nombre,
        direccion,
        logo_url: logo_url || null,
        sello_url: sello_url || null,
      })
      .subscribe({
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

  private async refreshLogoPreview(
    stored: string | null | undefined
  ): Promise<void> {
    if (!stored) {
      this.logoPreview = null;
      this.loadingLogo = false;
      return;
    }

    this.loadingLogo = true;
    this.cdr.markForCheck();

    try {
      this.logoPreview = await this.supabaseService.resolveFileUrl(
        stored,
        true
      );
    } catch {
      this.logoPreview = null;
    } finally {
      this.loadingLogo = false;
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
      this.selloPreview = await this.supabaseService.resolveFileUrl(
        stored,
        true
      );
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
