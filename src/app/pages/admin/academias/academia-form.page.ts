import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { saveOutline, personCircleOutline } from 'ionicons/icons';
import { AcademiaService } from '../../../services/academia.service';
import { EntrenadoresService } from '../../../services/entrenadores.service';
import { Academia, AcademiaForm } from '../../../interfaces/academia.interface';
import { Entrenador } from '../../../interfaces/entrenador.interface';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-academia-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/admin/academias"></ion-back-button>
        </ion-buttons>
        <ion-title>
          {{ esEdicion ? 'Editar' : 'Nueva' }} Academia
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (cargandoDatos) {
        <div class="ion-text-center ion-padding">
          <ion-spinner></ion-spinner>
        </div>
      } @else {
        <ion-list>
          <ion-item>
            <ion-label position="stacked" color="primary">Nombre de la academia *</ion-label>
            <ion-input
              [(ngModel)]="form.nombre"
              placeholder="Ej: Academia Real Libertad"
              required
            ></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked" color="primary">Dirección</ion-label>
            <ion-input
              [(ngModel)]="form.direccion"
              placeholder="Dirección de la academia"
            ></ion-input>
          </ion-item>

          @if (esEdicion) {
            <ion-item>
              <ion-label>
                <p>Administrador</p>
                @if (adminAsignado) {
                  <small>
                    <ion-icon name="person-circle-outline" style="vertical-align: middle;"></ion-icon>
                    {{ adminAsignado.nombre }} ({{ adminAsignado.correo }})
                  </small>
                } @else {
                  <small class="sin-admin">Sin administrador asignado</small>
                }
              </ion-label>
            </ion-item>
          }
        </ion-list>

        <div class="ion-padding">
          @if (error) {
            <ion-text color="danger">
              <p>{{ error }}</p>
            </ion-text>
          }

          <ion-button
            expand="block"
            (click)="guardar()"
            [disabled]="guardando || !form.nombre.trim()"
          >
            @if (guardando) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
            } @else {
              <ion-icon name="save-outline" slot="start"></ion-icon>
            }
            {{ esEdicion ? 'Guardar Cambios' : 'Crear Academia' }}
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .sin-admin {
        color: var(--ion-color-warning);
      }
    `,
  ],
})
export class AcademiaFormPage {
  private loadedAcademiaId: string | null = null;
  private readonly academiaService = inject(AcademiaService);
  private readonly entrenadoresService = inject(EntrenadoresService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastCtrl = inject(ToastController);

  esEdicion = false;
  academiaId: string | null = null;
  form: AcademiaForm = {
    nombre: '',
    direccion: '',
    logo_url: null,
    sello_url: null,
  };
  adminAsignado: Entrenador | null = null;
  guardando = false;
  cargandoDatos = false;
  error = '';

  constructor() {
    addIcons({ saveOutline, personCircleOutline });
  }

  ionViewWillEnter(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.resetForNewAcademia();
      this.loadedAcademiaId = null;
      return;
    }

    if (id !== this.loadedAcademiaId) {
      this.esEdicion = true;
      this.academiaId = id;
      void this.cargarAcademia(id);
      this.loadedAcademiaId = id;
    }
  }

  private resetForNewAcademia(): void {
    this.esEdicion = false;
    this.academiaId = null;
    this.guardando = false;
    this.cargandoDatos = false;
    this.error = '';
    this.adminAsignado = null;
    this.form = {
      nombre: '',
      direccion: '',
      logo_url: null,
      sello_url: null,
    };
  }

  private async cargarAcademia(id: string): Promise<void> {
    this.cargandoDatos = true;
    try {
      const [academia, todos] = await Promise.all([
        firstValueFrom(this.academiaService.getById(id)),
        firstValueFrom(this.entrenadoresService.getAll()),
      ]);

      if (academia) {
        this.form = {
          nombre: academia.nombre,
          direccion: academia.direccion,
          logo_url: academia.logo_url,
          sello_url: academia.sello_url,
        };
        this.adminAsignado = academia.admin_id
          ? todos.find((e) => e.id === academia.admin_id) ?? null
          : null;
      } else {
        await this.router.navigate(['/admin/academias']);
      }
    } catch {
      await this.router.navigate(['/admin/academias']);
    } finally {
      this.cargandoDatos = false;
    }
  }

  async guardar(): Promise<void> {
    if (this.guardando || !this.form.nombre.trim()) {
      return;
    }

    this.guardando = true;
    this.error = '';

    try {
      if (this.esEdicion && this.academiaId) {
        await firstValueFrom(
          this.academiaService.update(this.academiaId, {
            nombre: this.form.nombre,
            direccion: this.form.direccion,
          })
        );

        const toast = await this.toastCtrl.create({
          message: 'Academia actualizada correctamente',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      } else {
        await firstValueFrom(
          this.academiaService.create({
            nombre: this.form.nombre,
            direccion: this.form.direccion,
          })
        );

        const toast = await this.toastCtrl.create({
          message: 'Academia creada correctamente',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      }

      if (!this.esEdicion) {
        this.resetForNewAcademia();
        this.loadedAcademiaId = null;
      }

      await this.router.navigate(['/admin/academias']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar la academia';
    } finally {
      this.guardando = false;
    }
  }
}
