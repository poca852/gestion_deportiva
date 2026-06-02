import { TitleCasePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonMenuButton,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  checkmarkOutline,
  createOutline,
  keyOutline,
  peopleOutline,
  personAddOutline,
  personOutline,
  settingsOutline,
  trashOutline,
} from 'ionicons/icons';
import { EntrenadoresService } from '../../services/entrenadores.service';
import { Entrenador } from '../../interfaces/entrenador.interface';
import { CATEGORIAS } from '../../services/categoria.service';

@Component({
  selector: 'app-entrenadores',
  templateUrl: './entrenadores.page.html',
  styleUrls: ['./entrenadores.page.scss'],
  standalone: true,
  imports: [
    TitleCasePipe,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonChip,
    IonButton,
    IonIcon,
    IonFab,
    IonFabButton,
    IonModal,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
  ],
})
export class EntrenadoresPage implements OnInit {
  private readonly entrenadoresService = inject(EntrenadoresService);
  private readonly fb = inject(FormBuilder);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  entrenadores: Entrenador[] = [];
  loading = true;
  modalOpen = false;
  saving = false;
  editingId: string | null = null;
  categorias: string[] = [...CATEGORIAS];

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    categorias_asignadas: [[] as string[]],
    rol: ['coach' as 'admin' | 'coach', Validators.required],
    password: [''],
  });

  constructor() {
    addIcons({
      addOutline,
      createOutline,
      keyOutline,
      trashOutline,
      peopleOutline,
      personOutline,
      personAddOutline,
      checkmarkOutline,
      settingsOutline,
    });
  }

  ngOnInit(): void {
    this.loadEntrenadores();
  }

  getInitials(nombre: string): string {
    const parts = nombre.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return nombre.charAt(0).toUpperCase();
  }

  loadEntrenadores(): void {
    this.loading = true;
    this.entrenadoresService.getAll().subscribe({
      next: (data) => {
        this.entrenadores = data;
        this.loading = false;
      },
      error: async (err: Error) => {
        this.loading = false;
        await this.showToast(err.message, 'danger');
      },
    });
  }

  handleRefresh(event: CustomEvent): void {
    this.loadEntrenadores();
    (event.target as HTMLIonRefresherElement).complete();
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({ rol: 'coach', categorias_asignadas: [] });
    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(6),
    ]);
    this.form.controls.password.updateValueAndValidity();
    this.modalOpen = true;
  }

  openEdit(entrenador: Entrenador): void {
    this.editingId = entrenador.id;
    this.form.patchValue({
      nombre: entrenador.nombre,
      correo: entrenador.correo,
      categorias_asignadas: [...(entrenador.categorias_asignadas ?? [])],
      rol: entrenador.rol,
      password: '',
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const raw = this.form.getRawValue();
    const payload = {
      nombre: raw.nombre,
      correo: raw.correo,
      categorias_asignadas: this.normalizeCategorias(raw.categorias_asignadas),
      rol: raw.rol,
      password: raw.password || undefined,
    };

    const request$ = this.editingId
      ? this.entrenadoresService.update(this.editingId, payload)
      : this.entrenadoresService.create(payload);

    request$.subscribe({
      next: async () => {
        this.saving = false;
        this.modalOpen = false;
        this.loadEntrenadores();
        await this.showToast('Entrenador guardado correctamente', 'success');
      },
      error: async (err: Error) => {
        this.saving = false;
        await this.showToast(err.message, 'danger');
      },
    });
  }

  async confirmDelete(entrenador: Entrenador): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar entrenador',
      message: `¿Estás seguro de eliminar a <strong>${entrenador.nombre}</strong>? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.entrenadoresService.delete(entrenador.id).subscribe({
              next: () => {
                this.loadEntrenadores();
                this.showToast('Entrenador eliminado', 'success');
              },
              error: (err: Error) => this.showToast(err.message, 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async changePassword(entrenador: Entrenador): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar contraseña',
      subHeader: entrenador.nombre,
      message: 'Ingresa la nueva contraseña para este entrenador.',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Nueva contraseña (mín. 6 caracteres)',
          attributes: {
            minlength: 6,
          },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cambiar',
          handler: (data) => {
            const password: string = data?.password?.trim();
            if (!password || password.length < 6) {
              this.showToast(
                'La contraseña debe tener al menos 6 caracteres',
                'danger'
              );
              return false;
            }
            this.entrenadoresService.updatePassword(entrenador.id, password).subscribe({
              next: () => {
                this.showToast('Contraseña actualizada correctamente', 'success');
              },
              error: (err: Error) => this.showToast(err.message, 'danger'),
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private normalizeCategorias(value: string | string[] | null | undefined): string[] {
    if (Array.isArray(value)) {
      return [...new Set(value.map((c) => c.trim()).filter(Boolean))];
    }
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    return [];
  }

  get selectedCategorias(): string[] {
    return this.form.controls.categorias_asignadas.value ?? [];
  }

  hasError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
