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
  IonChip,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  personAddOutline,
  createOutline,
  trashOutline,
  peopleOutline,
  personOutline,
  businessOutline,
} from 'ionicons/icons';
import { EntrenadoresService } from '../../../services/entrenadores.service';
import { AcademiaService } from '../../../services/academia.service';
import { Entrenador } from '../../../interfaces/entrenador.interface';
import { Academia } from '../../../interfaces/academia.interface';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-usuarios',
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
    IonItem,
    IonLabel,
    IonChip,
    IonRefresher,
    IonRefresherContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Usuarios</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="nuevoUsuario()">
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
      } @else if (usuarios.length === 0) {
        <ion-card>
          <ion-card-content class="ion-text-center ion-padding">
            <ion-icon name="people-outline" size="large" color="medium"></ion-icon>
            <h3 class="ion-margin-top">No hay usuarios registrados</h3>
            <p class="ion-margin-bottom">Crea el primer usuario para comenzar.</p>
            <ion-button expand="block" (click)="nuevoUsuario()">
              <ion-icon name="person-add-outline" slot="start"></ion-icon>
              Crear usuario
            </ion-button>
          </ion-card-content>
        </ion-card>
      } @else {
        <ion-list>
          @for (usuario of usuarios; track usuario.id) {
            <ion-item button detail (click)="editarUsuario(usuario)">
              <ion-label>
                <h2>{{ usuario.nombre }}</h2>
                <p>{{ usuario.correo }}</p>
              </ion-label>
              <div slot="end" class="usuario-tags">
                <ion-chip [color]="usuario.rol === 'admin' ? 'primary' : 'medium'" size="small">
                  <ion-icon name="person-outline"></ion-icon>
                  {{ usuario.rol === 'admin' ? 'Admin' : 'Coach' }}
                </ion-chip>
                @if (getAcademiaNombre(usuario.academia_id); as nombreAcademia) {
                  <ion-chip color="tertiary" size="small">
                    <ion-icon name="business-outline"></ion-icon>
                    {{ nombreAcademia }}
                  </ion-chip>
                }
                @if (!usuario.academia_id) {
                  <ion-chip color="warning" size="small">Sin academia</ion-chip>
                }
              </div>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [
    `
      .usuario-tags {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    `,
  ],
})
export class UsuariosPage {
  private readonly entrenadoresService = inject(EntrenadoresService);
  private readonly academiaService = inject(AcademiaService);
  private readonly router = inject(Router);

  usuarios: Entrenador[] = [];
  academiaPorId: Record<string, Academia> = {};
  loading = true;

  constructor() {
    addIcons({ add, personAddOutline, createOutline, trashOutline, peopleOutline, personOutline, businessOutline });
  }

  ionViewWillEnter(): void {
    this.cargarDatos();
  }

  private async cargarDatos(): Promise<void> {
    this.loading = true;
    try {
      const [usuarios, academias] = await Promise.all([
        firstValueFrom(this.entrenadoresService.getAll()),
        firstValueFrom(this.academiaService.getAll()),
      ]);
      this.usuarios = usuarios;
      for (const acad of academias) {
        this.academiaPorId[acad.id] = acad;
      }
    } catch {
      this.usuarios = [];
    } finally {
      this.loading = false;
    }
  }

  getAcademiaNombre(academiaId: string | null): string | null {
    if (!academiaId) return null;
    const acad = this.academiaPorId[academiaId];
    return acad?.nombre ?? null;
  }

  nuevoUsuario(): void {
    this.router.navigate(['/admin/usuarios/nuevo']);
  }

  editarUsuario(usuario: Entrenador): void {
    this.router.navigate(['/admin/usuarios/editar', usuario.id]);
  }

  async refrescar(event: RefresherCustomEvent): Promise<void> {
    await this.cargarDatos();
    event.target.complete();
  }
}
