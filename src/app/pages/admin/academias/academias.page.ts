import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  AlertController,
  ToastController,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  businessOutline,
  createOutline,
  personCircleOutline,
  trashOutline,
  refreshOutline,
} from 'ionicons/icons';
import { AcademiaService } from '../../../services/academia.service';
import { EntrenadoresService } from '../../../services/entrenadores.service';
import { AuthService } from '../../../services/auth.service';
import { Academia } from '../../../interfaces/academia.interface';
import { Entrenador } from '../../../interfaces/entrenador.interface';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-academias',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonButton,
    IonContent,
    IonCard,
    IonCardContent,
    IonIcon,
    IonSpinner,
    IonList,
    IonRefresher,
    IonRefresherContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Academias</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="nuevaAcademia()">
            <ion-icon name="add" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refrescar($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="ion-text-center ion-padding">
          <ion-spinner></ion-spinner>
        </div>
      } @else if (academias.length === 0) {
        <ion-card>
          <ion-card-content class="ion-text-center ion-padding">
            <ion-icon name="business-outline" size="large" color="medium"></ion-icon>
            <h3 class="ion-margin-top">No hay academias registradas</h3>
            <ion-button expand="block" class="ion-margin-top" (click)="nuevaAcademia()">
              <ion-icon name="add" slot="start"></ion-icon>
              Crear primera academia
            </ion-button>
          </ion-card-content>
        </ion-card>
      } @else {
        <ion-list>
          @for (academia of academias; track academia.id) {
            <ion-card class="academia-card">
              <ion-card-content>
                <div class="academia-header">
                  <div class="academia-info">
                    <h2>{{ academia.nombre }}</h2>
                    <p class="academia-direccion">{{ academia.direccion }}</p>
                  </div>
                  <div class="academia-actions">
                    <ion-button fill="clear" color="primary" (click)="editarAcademia(academia)">
                      <ion-icon name="create-outline" slot="icon-only"></ion-icon>
                    </ion-button>
                    <ion-button fill="clear" color="danger" (click)="confirmarEliminar(academia)">
                      <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
                    </ion-button>
                  </div>
                </div>

                <div class="academia-admin-section">
                  @if (academia.admin_id && adminPorId[academia.admin_id]; as admin) {
                    <p class="admin-label">Administrador asignado:</p>
                    <div class="admin-badge">
                      <ion-icon name="person-circle-outline"></ion-icon>
                      <span>{{ admin.nombre }}</span>
                      <small>({{ admin.correo }})</small>
                    </div>
                  } @else {
                    <p class="admin-label warn">Sin administrador asignado</p>
                  }
                </div>
              </ion-card-content>
            </ion-card>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [
    `
      .academia-card { margin-bottom: 12px; }
      .academia-header { display: flex; justify-content: space-between; align-items: flex-start; }
      .academia-info h2 { margin: 0 0 4px 0; font-size: 1.1rem; font-weight: 600; }
      .academia-direccion { margin: 0; color: var(--ion-color-medium); font-size: 0.9rem; }
      .academia-actions { display: flex; gap: 0; }
      .academia-admin-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--ion-color-light); }
      .admin-label { margin: 0 0 4px 0; font-size: 0.8rem; color: var(--ion-color-medium); }
      .admin-label.warn { color: var(--ion-color-warning); }
      .admin-badge { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--ion-color-success); }
      .admin-badge small { color: var(--ion-color-medium); }
    `,
  ],
})
export class AcademiasPage {
  private readonly academiaService = inject(AcademiaService);
  private readonly entrenadoresService = inject(EntrenadoresService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);

  academias: Academia[] = [];
  adminPorId: Record<string, Entrenador> = {};
  loading = true;

  constructor() {
    addIcons({ add, businessOutline, createOutline, trashOutline, personCircleOutline, refreshOutline });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  ionViewWillEnter(): void {
    // Recargar al volver a la página (después de crear/editar)
    this.cargarDatos();
  }

  async refrescar(event: RefresherCustomEvent): Promise<void> {
    await this.cargarDatos();
    event.target.complete();
  }

  private async cargarDatos(): Promise<void> {
    this.loading = true;
    try {
      const [academias, entrenadores] = await Promise.all([
        firstValueFrom(this.academiaService.getAll()),
        firstValueFrom(this.entrenadoresService.getAll()),
      ]);
      this.academias = academias;
      for (const e of entrenadores) {
        this.adminPorId[e.id] = e;
      }
    } catch {
      this.academias = [];
    } finally {
      this.loading = false;
    }
  }

  nuevaAcademia(): void {
    this.router.navigate(['/admin/academias/nueva']);
  }

  editarAcademia(academia: Academia): void {
    this.router.navigate(['/admin/academias/editar', academia.id]);
  }

  async confirmarEliminar(academia: Academia): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar academia',
      message: `¿Estás seguro de eliminar "${academia.nombre}"?<br><br>
        <strong>Esta acción no se puede deshacer.</strong> Los datos asociados perderán la referencia.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', cssClass: 'danger', handler: () => this.eliminarAcademia(academia.id) },
      ],
    });
    await alert.present();
  }

  private async eliminarAcademia(id: string): Promise<void> {
    try {
      await firstValueFrom(this.academiaService.delete(id));
      this.academias = this.academias.filter((a) => a.id !== id);
      delete this.adminPorId[id];
      const toast = await this.toastCtrl.create({
        message: 'Academia eliminada',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: err instanceof Error ? err.message : 'Error al eliminar',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
