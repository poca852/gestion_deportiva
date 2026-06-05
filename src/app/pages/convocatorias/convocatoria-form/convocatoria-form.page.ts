import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  checkmarkOutline,
  checkboxOutline,
  peopleOutline,
  personOutline,
  squareOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../services/auth.service';
import { AlumnosService } from '../../../services/alumnos.service';
import { ConvocatoriasService } from '../../../services/convocatorias.service';
import { Alumno } from '../../../interfaces/alumno.interface';
import { CategoriaService } from '../../../services/categoria.service';

@Component({
  selector: 'app-convocatoria-form',
  templateUrl: './convocatoria-form.page.html',
  styleUrls: ['./convocatoria-form.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    IonIcon,
  ],
})
export class ConvocatoriaFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly alumnosService = inject(AlumnosService);
  private readonly convocatoriasService = inject(ConvocatoriasService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly toastCtrl = inject(ToastController);

  convocatoriaId: string | null = null;
  categorias: string[] = [];
  alumnos: Alumno[] = [];
  selectedIds = new Set<string>();
  loading = false;
  loadingAlumnos = false;
  saving = false;

  form = this.fb.nonNullable.group({
    nombre_evento: ['', Validators.required],
    fecha: ['', Validators.required],
    categoria: ['', Validators.required],
  });

  constructor() {
    addIcons({
      calendarOutline,
      checkmarkOutline,
      checkboxOutline,
      peopleOutline,
      personOutline,
      squareOutline,
    });
  }

  ngOnInit(): void {
    this.convocatoriaId = this.route.snapshot.paramMap.get('id');

    if (this.authService.isAdmin()) {
      this.categorias = [...this.categoriaService.getAll()];
    } else {
      this.categorias = [...this.authService.categoriasAsignadas()];
      if (this.categorias.length === 1) {
        const cat = this.categorias[0];
        this.form.patchValue({ categoria: cat }, { emitEvent: false });
        this.form.controls.categoria.disable();
        if (!this.convocatoriaId) {
          this.loadAlumnos(cat);
        }
      }
    }

    this.form.controls.categoria.valueChanges.subscribe((cat) => {
      if (cat) {
        this.selectedIds.clear();
        this.loadAlumnos(cat);
      }
    });

    if (this.convocatoriaId) {
      this.loadConvocatoria(this.convocatoriaId);
    }
  }

  private loadConvocatoria(id: string): void {
    this.loading = true;

    this.convocatoriasService.getWithPlantilla(id).subscribe({
      next: (conv) => {
        this.form.patchValue(
          {
            nombre_evento: conv.nombre_evento,
            fecha: conv.fecha,
            categoria: conv.categoria,
          },
          { emitEvent: false }
        );

        this.selectedIds = new Set(conv.alumnos.map((a) => a.id));
        this.loadAlumnos(conv.categoria);
        this.loading = false;
      },
      error: async (err: Error) => {
        this.loading = false;
        const toast = await this.toastCtrl.create({
          message: err.message,
          duration: 3000,
          color: 'danger',
        });
        await toast.present();
        await this.router.navigate(['/app/convocatorias']);
      },
    });
  }

  loadAlumnos(categoria: string): void {
    const filter = this.authService.getListCategoriaFilter();
    if (filter === undefined) {
      this.alumnos = [];
      this.loadingAlumnos = false;
      return;
    }

    const epoch = this.authService.getDataEpoch();
    this.loadingAlumnos = true;
    this.alumnos = [];

    this.alumnosService.getAll(categoria).subscribe({
      next: (data) => {
        if (epoch !== this.authService.getDataEpoch()) {
          return;
        }
        this.alumnos = data;
        this.loadingAlumnos = false;
      },
      error: () => {
        if (epoch !== this.authService.getDataEpoch()) {
          return;
        }
        this.loadingAlumnos = false;
      },
    });
  }

  toggleAlumno(id: string, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  selectAll(): void {
    this.alumnos.forEach((a) => this.selectedIds.add(a.id));
  }

  deselectAll(): void {
    this.selectedIds.clear();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const profile = this.authService.currentProfile;
    if (!profile) return;

    this.saving = true;
    const raw = this.form.getRawValue();

    const payload = {
      nombre_evento: raw.nombre_evento,
      fecha: raw.fecha,
      categoria: raw.categoria,
      alumno_ids: Array.from(this.selectedIds),
    };

    const request$ = this.convocatoriaId
      ? this.convocatoriasService.update(this.convocatoriaId, payload)
      : this.convocatoriasService.create(payload, profile.id);

    request$.subscribe({
      next: async (conv) => {
        this.saving = false;
        const toast = await this.toastCtrl.create({
          message: `Convocatoria ${this.convocatoriaId ? 'actualizada' : 'creada'} correctamente`,
          duration: 2000,
          color: 'success',
        });
        await toast.present();

        if (this.convocatoriaId) {
          await this.router.navigate(['/app/convocatorias']);
        } else {
          await this.router.navigate(['/app/convocatorias', conv.id, 'imprimir']);
        }
      },
      error: async (err: Error) => {
        this.saving = false;
        const toast = await this.toastCtrl.create({
          message: err.message,
          duration: 3000,
          color: 'danger',
        });
        await toast.present();
      },
    });
  }
}
