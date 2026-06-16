import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, TitleCasePipe } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonContent,
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
  peopleOutline,
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
    TitleCasePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonButton,
    IonContent,
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

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refrescar($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading) {
        <div class="loading-center">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (usuarios.length === 0) {
        <div class="empty-state ion-padding">
          <ion-icon name="people-outline" class="empty-icon" color="medium"></ion-icon>
          <h3 class="empty-title">No hay usuarios registrados</h3>
          <p class="empty-subtitle">Crea el primer usuario para comenzar.</p>
          <ion-button (click)="nuevoUsuario()">
            <ion-icon name="person-add-outline" slot="start"></ion-icon>
            Crear usuario
          </ion-button>
        </div>
      } @else {
        <ion-list class="page-list modern-list" lines="none">
          @for (usuario of usuarios; track usuario.id) {
            <ion-item button detail (click)="editarUsuario(usuario)" class="usuario-item">
              <div class="usuario-avatar" slot="start">
                <div class="avatar-placeholder">{{ getInitials(usuario.nombre) }}</div>
              </div>
              <ion-label>
                <h2>{{ usuario.nombre | titlecase }}</h2>
                <p class="usuario-correo">{{ usuario.correo }}</p>
                <div class="usuario-meta">
                  <ion-chip
                    [color]="usuario.rol === 'admin' ? 'primary' : 'medium'"
                    class="meta-chip"
                  >
                    {{ usuario.rol === 'admin' ? 'Admin' : 'Coach' }}
                  </ion-chip>
                  @if (getAcademiaNombre(usuario.academia_id); as nombreAcademia) {
                    <ion-chip color="tertiary" class="meta-chip">{{ nombreAcademia }}</ion-chip>
                  }
                  @if (!usuario.academia_id) {
                    <ion-chip color="warning" class="meta-chip">Sin academia</ion-chip>
                  }
                </div>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [
    `
      .modern-list {
        margin: 0;
      }

      .usuario-item {
        --padding-start: 16px;
        --padding-end: 12px;
        --padding-top: 10px;
        --padding-bottom: 10px;

        h2 {
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 2px;
        }

        .usuario-correo {
          font-size: 0.85rem;
          color: var(--ion-color-medium);
          margin-bottom: 6px;
        }

        .usuario-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
      }

      .usuario-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
      }

      .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(
          145deg,
          var(--ion-color-primary) 0%,
          var(--ion-color-primary-tint) 100%
        );
        color: #fff;
        font-weight: 700;
        font-size: 0.9rem;
        letter-spacing: 0.02em;
      }

      .meta-chip {
        margin: 0;
        height: 24px;
        font-size: 0.7rem;
        --padding-start: 8px;
        --padding-end: 8px;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 24px;
        text-align: center;
      }

      .empty-icon {
        font-size: 3rem;
        margin-bottom: 16px;
      }

      .empty-title {
        margin: 0 0 8px;
        font-size: 1.1rem;
        font-weight: 600;
      }

      .empty-subtitle {
        margin: 0 0 24px;
        font-size: 0.9rem;
        color: var(--ion-color-medium);
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
    addIcons({ add, personAddOutline, peopleOutline });
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

  getInitials(nombre: string): string {
    const parts = nombre.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return nombre.charAt(0).toUpperCase();
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
