import { UpperCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline,
  documentTextOutline,
  filterOutline,
  imageOutline,
  listOutline,
  printOutline,
  searchOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { LazyImageComponent } from '../../../components/lazy-image/lazy-image.component';
import { SignaturePadComponent } from '../../../components/signature-pad/signature-pad.component';
import { Academia } from '../../../interfaces/academia.interface';
import { Alumno, GeneroAlumno } from '../../../interfaces/alumno.interface';
import { AcademiaBrandingService } from '../../../services/academia-branding.service';
import { AcademiaContextService } from '../../../services/academia-context.service';
import { AlumnosService } from '../../../services/alumnos.service';
import { AuthService } from '../../../services/auth.service';
import { CategoriaService } from '../../../services/categoria.service';
import { ConvocatoriaExportService } from '../../../services/convocatoria-export.service';
import { SupabaseService } from '../../../services/supabase.service';
import { CategoriaFilter } from '../../../utils/categoria-filter.util';

@Component({
  selector: 'app-alumnos-listado-print',
  templateUrl: './alumnos-listado-print.page.html',
  styleUrls: ['./alumnos-listado-print.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    UpperCasePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonSpinner,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonIcon,
    LazyImageComponent,
    SignaturePadComponent,
  ],
})
export class AlumnosListadoPrintPage implements OnInit {
  @ViewChild('printDocument') printDocumentRef?: ElementRef<HTMLElement>;
  @ViewChild('signaturePad') signaturePad?: SignaturePadComponent;

  private readonly fb = inject(FormBuilder);
  private readonly alumnosService = inject(AlumnosService);
  private readonly academiaContext = inject(AcademiaContextService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly exportService = inject(ConvocatoriaExportService);
  private readonly branding = inject(AcademiaBrandingService);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  academyName = this.branding.defaultNombre;
  academyDireccion: string | null = null;
  academyLogoDataUrl: string | null = null;
  academySelloDataUrl: string | null = null;
  firmaDataUrl: string | null = null;
  loadingLogo = false;
  loadingSello = false;
  loadingFirma = false;
  loading = false;
  alumnos: Alumno[] = [];
  exporting = false;
  savingFirma = false;

  categoriasOptions: string[] = [];

  form = this.fb.nonNullable.group({
    categorias: [[] as string[]],
    titulo: ['Listado de jugadores'],
    mostrarTelefono: [false],
    mostrarTalla: [true],
    mostrarFechaNac: [false],
    mostrarGenero: [false],
    mostrarFechaIngreso: [false],
  });

  get categoriasSeleccionadas(): string[] {
    return this.form.controls.categorias.value ?? [];
  }

  get todayDate(): string {
    return new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  constructor() {
    addIcons({
      cloudDownloadOutline,
      documentTextOutline,
      filterOutline,
      imageOutline,
      searchOutline,
      listOutline,
      printOutline,
    });
  }

  ngOnInit(): void {
    if (this.authService.isAdmin()) {
      this.categoriasOptions = [...this.categoriaService.getAll()];
    } else {
      const asignadas = this.authService.categoriasAsignadas();
      this.categoriasOptions =
        asignadas.length > 0 ? [...asignadas] : [...this.categoriaService.getAll()];
    }

    const academia = this.academiaContext.academiaActual();
    if (academia) {
      this.academyName = academia.nombre;
      this.academyDireccion = academia.direccion;
      void this.cargarAssets(academia);
    }
    this.cdr.markForCheck();
  }

  private async cargarAssets(config: Academia | null): Promise<void> {
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
  }

  get tituloListado(): string {
    const titulo = this.form.controls.titulo.value?.trim() || 'Listado de jugadores';
    const cats = this.categoriasSeleccionadas;
    if (cats.length > 0) {
      return `${titulo} - ${cats.join(', ')}`;
    }
    return titulo;
  }

  get filename(): string {
    const titulo = this.tituloListado
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    return `listado_${titulo}`;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  generoLabel(genero: GeneroAlumno): string {
    const labels: Record<GeneroAlumno, string> = {
      masculino: 'M',
      femenino: 'F',
      otro: '-',
    };
    return labels[genero];
  }

  async cargarAlumnos(): Promise<void> {
    this.loading = true;
    this.alumnos = [];
    this.cdr.markForCheck();

    try {
      const selectedCats = this.categoriasSeleccionadas;
      const baseFilter = this.authService.getListCategoriaFilter();

      if (baseFilter === undefined) {
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }

      let categoriaFilter: CategoriaFilter;
      if (baseFilter === null) {
        categoriaFilter = selectedCats.length > 0 ? selectedCats : undefined;
      } else {
        if (selectedCats.length > 0) {
          categoriaFilter = selectedCats.filter((c) => baseFilter.includes(c));
        } else {
          categoriaFilter = baseFilter;
        }
      }

      const data = await firstValueFrom(
        this.alumnosService.getAll(categoriaFilter)
      );
      this.alumnos = data.sort((a, b) =>
        `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`)
      );
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: (err as Error).message,
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async descargarPdf(): Promise<void> {
    if (this.alumnos.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'No hay alumnos en el reporte. Primero genera los datos.',
        duration: 3000,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const element = this.printDocumentRef?.nativeElement;
    if (!element) return;

    this.exporting = true;
    try {
      await this.exportService.downloadPdf(element, this.filename);
      const toast = await this.toastCtrl.create({
        message: 'PDF descargado correctamente',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: err instanceof Error ? err.message : 'No se pudo generar el PDF',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  async descargarImagen(): Promise<void> {
    if (this.alumnos.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'No hay alumnos en el reporte. Primero genera los datos.',
        duration: 3000,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const element = this.printDocumentRef?.nativeElement;
    if (!element) return;

    this.exporting = true;
    try {
      await this.exportService.downloadImage(element, this.filename);
      const toast = await this.toastCtrl.create({
        message: 'Imagen descargada correctamente',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: err instanceof Error ? err.message : 'No se pudo generar la imagen',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  async imprimirReporte(): Promise<void> {
    if (this.alumnos.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'No hay datos para imprimir. Primero genera el reporte.',
        duration: 3000,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.exportService.printWithFilename(this.filename);
  }

  get canSign(): boolean {
    return !!this.authService.currentProfile;
  }

  async guardarFirma(): Promise<void> {
    const pad = this.signaturePad;
    if (!pad) return;

    if (pad.isEmpty()) {
      const toast = await this.toastCtrl.create({
        message: 'Dibuja tu firma antes de guardar.',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    this.savingFirma = true;
    this.cdr.markForCheck();

    try {
      const blob = await pad.toBlob();
      this.firmaDataUrl = await this.blobToDataUrl(blob);
      const toast = await this.toastCtrl.create({
        message: 'Firma agregada correctamente',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: 'No se pudo procesar la firma',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.savingFirma = false;
      this.cdr.markForCheck();
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
}
