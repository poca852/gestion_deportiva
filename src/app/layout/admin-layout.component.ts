import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSplitPane,
  IonTitle,
  IonToolbar,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  logOutOutline,
  peopleOutline,
  settingsOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonSplitPane,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle,
    IonRouterOutlet,
  ],
  template: `
    <ion-split-pane contentId="admin-content" when="md">
      <ion-menu contentId="admin-content" type="overlay" menuId="admin-menu">
        <ion-header>
          <ion-toolbar color="primary">
            <ion-title>
              <div class="admin-brand">
                <ion-icon name="shield-checkmark-outline"></ion-icon>
                <span>Panel de Control</span>
              </div>
            </ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <div class="admin-user-info">
            <p class="admin-user-name">{{ authService.currentProfile?.nombre }}</p>
            <p class="admin-user-role">Super Administrador</p>
          </div>

          <ion-list lines="none">
            <ion-menu-toggle auto-hide="false">
              <ion-item
                routerLink="/admin/academias"
                routerDirection="root"
                routerLinkActive="selected"
                button
                detail="false"
              >
                <ion-icon name="business-outline" slot="start"></ion-icon>
                <ion-label>Academias</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-menu-toggle auto-hide="false">
              <ion-item
                routerLink="/admin/usuarios"
                routerDirection="root"
                routerLinkActive="selected"
                button
                detail="false"
              >
                <ion-icon name="people-outline" slot="start"></ion-icon>
                <ion-label>Usuarios</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-item button detail="false" (click)="logout()" class="logout-item">
              <ion-icon name="log-out-outline" slot="start"></ion-icon>
              <ion-label>Cerrar sesión</ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-menu>

      <ion-router-outlet id="admin-content"></ion-router-outlet>
    </ion-split-pane>
  `,
  styles: [
    `
      .admin-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem;
      }
      .admin-user-info {
        padding: 16px;
        text-align: center;
        border-bottom: 1px solid var(--ion-color-light);
      }
      .admin-user-name {
        font-weight: 600;
        margin: 0;
        color: var(--ion-color-dark);
      }
      .admin-user-role {
        font-size: 0.85rem;
        color: var(--ion-color-primary);
        margin: 4px 0 0 0;
        font-weight: 500;
      }
    `,
  ],
})
export class AdminLayoutComponent {
  readonly authService = inject(AuthService);
  private readonly menuCtrl = inject(MenuController);

  constructor() {
    addIcons({ businessOutline, peopleOutline, logOutOutline, settingsOutline, shieldCheckmarkOutline });
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}
