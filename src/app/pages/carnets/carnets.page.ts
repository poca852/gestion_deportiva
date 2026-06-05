import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonProgressBar,
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
  filterOutline,
  idCardOutline,
  peopleOutline,
  shareOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { CarnetCardComponent } from '../../components/carnet-card/carnet-card.component';
import { Alumno } from '../../interfaces/alumno.interface';
import { AlumnosService } from '../../services/alumnos.service';
import { AuthService } from '../../services/auth.service';
import { CATEGORIAS } from '../../services/categoria.service';
import {
  CarnetBatchProgress,
  CarnetExportService,
} from '../../services/carnet-export.service';
import { CarnetData, CarnetService } from '../../services/carnet.service';
import { CategoriaFilter } from '../../utils/categoria-filter.util';

@Component({
  selector: 'app-carnets',
  templateUrl: './carnets.page.html',
  styleUrls: ['./carnets.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CarnetCardComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonSelect,
    IonSelectOption,
    IonProgressBar,
  ],
})
export class CarnetsPage implements OnInit {
  @ViewChild('renderCard') renderCard?: CarnetCardComponent;

  private readonly fb = inject(FormBuilder);
  private readonly alumnosService = inject(AlumnosService);
  private readonly carnetService = inject(CarnetService);
  private readonly exportService = inject(CarnetExportService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  categoriasOptions: string[] = [...CATEGORIAS];
  alumnos: Alumno[] = [];
  renderData: CarnetData | null = null;

  loadingAlumnos = false;
  generando = false;
  mensajeProgreso = '';
  progresoActual = 0;
  progresoTotal = 0;

  form = this.fb.nonNullable.group({
    categorias: [[] as string[]],
  });

  get categoriasSeleccionadas(): string[] {
    return this.form.controls.categorias.value;
  }

  get progresoValor(): number {
    if (this.progresoTotal <= 0) return 0;
    return this.progresoActual / this.progresoTotal;
  }

  constructor() {
    addIcons({
      filterOutline,
      peopleOutline,
      idCardOutline,
      cloudDownloadOutline,
      shareOutline,
    });
  }

  ngOnInit(): void {
    void this.cargarAlumnos();
  }

  async cargarAlumnos(): Promise<void> {
    this.loadingAlumnos = true;
    this.alumnos = [];
    this.cdr.detectChanges();

    try {
      const categoriaFilter = this.resolveCategoriaFilter();
      if (categoriaFilter === undefined) {
        return;
      }

      const data = await firstValueFrom(
        this.alumnosService.getAll(categoriaFilter)
      );
      this.alumnos = data.sort((a, b) =>
        `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`)
      );
    } catch (err) {
      await this.mostrarToast((err as Error).message, 'danger');
    } finally {
      this.loadingAlumnos = false;
      this.cdr.detectChanges();
    }
  }

  async descargarZip(): Promise<void> {
    const zipBlob = await this.generarZip();
    if (!zipBlob) return;

    const filename = this.exportService.buildZipFilename(this.categoriasSeleccionadas);
    await this.exportService.downloadBlobFile(zipBlob, filename);

    await this.mostrarToast(
      `${this.alumnos.length} carnets descargados en ZIP`,
      'success'
    );
  }

  async compartirZip(): Promise<void> {
    const zipBlob = await this.generarZip();
    if (!zipBlob) return;

    const filename = this.exportService.buildZipFilename(this.categoriasSeleccionadas);
    const result = await this.exportService.shareBlob(
      zipBlob,
      filename,
      'Carnets',
      `${this.alumnos.length} carnets de la academia`
    );

    if (result === false) {
      await this.mostrarToast('No se pudo compartir el ZIP', 'warning');
      return;
    }

    if (result === 'downloaded') {
      await this.mostrarToast(
        'Tu navegador no permite compartir ZIP; se descargó el archivo',
        'success'
      );
      return;
    }

    await this.mostrarToast('ZIP listo para compartir', 'success');
  }

  private async generarZip(): Promise<Blob | null> {
    if (this.alumnos.length === 0) {
      await this.mostrarToast('No hay alumnos para generar carnets', 'warning');
      return null;
    }

    if (this.generando) return null;

    this.generando = true;
    this.progresoActual = 0;
    this.progresoTotal = this.alumnos.length;
    this.actualizarProgreso({
      phase: 'preparing',
      current: 0,
      total: this.alumnos.length,
      label: 'Preparando datos...',
    });
    this.cdr.detectChanges();
    await this.exportService.yieldToUi();

    try {
      const carnetDataList = await this.carnetService.prepareBatchData(
        this.alumnos,
        (current, total) => {
          this.actualizarProgreso({
            phase: 'preparing',
            current,
            total,
            label: `Cargando datos ${current} de ${total}...`,
          });
          this.cdr.detectChanges();
        }
      );

      const archivos: { path: string; blob: Blob }[] = [];

      for (let i = 0; i < carnetDataList.length; i++) {
        const data = carnetDataList[i];
        this.renderData = data;
        this.actualizarProgreso({
          phase: 'generating',
          current: i + 1,
          total: carnetDataList.length,
          label: `Generando carnet ${i + 1} de ${carnetDataList.length}...`,
        });
        this.cdr.detectChanges();
        await this.exportService.yieldToUi();
        await this.exportService.yieldToUi();

        const element = this.renderCard?.getCaptureElement();
        if (!element) {
          throw new Error('No se pudo renderizar el carnet');
        }

        const canvas = await this.exportService.captureElement(element);
        const blob = await this.exportService.canvasToBlob(canvas);
        archivos.push({
          path: this.exportService.buildCarnetFilename(data),
          blob,
        });

        canvas.width = 0;
        canvas.height = 0;
      }

      this.actualizarProgreso({
        phase: 'packaging',
        current: carnetDataList.length,
        total: carnetDataList.length,
        label: 'Empaquetando ZIP...',
      });
      this.cdr.detectChanges();
      await this.exportService.yieldToUi();

      return await this.exportService.buildZip(archivos, (percent) => {
        this.mensajeProgreso = `Empaquetando ZIP... ${Math.round(percent)}%`;
        this.cdr.detectChanges();
      });
    } catch {
      await this.mostrarToast('No se pudieron generar los carnets', 'danger');
      return null;
    } finally {
      this.renderData = null;
      this.generando = false;
      this.progresoActual = 0;
      this.progresoTotal = 0;
      this.mensajeProgreso = '';
      this.cdr.detectChanges();
    }
  }

  private actualizarProgreso(progress: CarnetBatchProgress): void {
    this.progresoActual = progress.current;
    this.progresoTotal = progress.total;
    this.mensajeProgreso = progress.label ?? '';
  }

  private resolveCategoriaFilter(): CategoriaFilter | undefined {
    const selectedCats = this.categoriasSeleccionadas;
    const baseFilter = this.authService.getListCategoriaFilter();

    if (baseFilter === undefined) {
      return undefined;
    }

    if (baseFilter === null) {
      return selectedCats.length > 0 ? selectedCats : undefined;
    }

    if (selectedCats.length > 0) {
      return selectedCats.filter((c) => baseFilter.includes(c));
    }

    return baseFilter;
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: color === 'success' ? 2500 : 3500,
      color,
    });
    await toast.present();
  }
}
