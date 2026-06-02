import { TitleCasePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
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
  basketballOutline,
  businessOutline,
  calendarOutline,
  homeOutline,
  logOutOutline,
  peopleOutline,
  personOutline,
  settingsOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AcademiaBrandingService } from '../services/academia-branding.service';
import { AcademiaContextService } from '../services/academia-context.service';
import { LazyImageComponent } from '../components/lazy-image/lazy-image.component';

interface MenuItem {
  title: string;
  url: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    IonSplitPane,
    IonMenu,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle,
    IonRouterOutlet,
    IonHeader,
    IonToolbar,
    IonTitle,
    LazyImageComponent,
    TitleCasePipe,
  ],
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly branding = inject(AcademiaBrandingService);
  readonly academiaContext = inject(AcademiaContextService);
  private readonly menuCtrl = inject(MenuController);
  private profileSub?: Subscription;

  menuItems: MenuItem[] = [
    { title: 'Dashboard', url: '/app/dashboard', icon: 'home-outline' },
    {
      title: 'Entrenadores',
      url: '/app/entrenadores',
      icon: 'people-outline',
      adminOnly: true,
    },
    {
      title: 'Academia',
      url: '/app/academia',
      icon: 'business-outline',
      adminOnly: true,
    },
    { title: 'Alumnos', url: '/app/alumnos', icon: 'person-outline' },
    {
      title: 'Convocatorias',
      url: '/app/convocatorias',
      icon: 'calendar-outline',
    },
  ];

  ngOnInit(): void {
    this.profileSub = this.authService.profile$
      .pipe(
        distinctUntilChanged(
          (prev, curr) => prev?.id === curr?.id && prev?.rol === curr?.rol
        )
      )
      .subscribe((profile) => {
        if (profile) {
          this.branding.load();
        }
      });
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  constructor() {
    addIcons({
      basketballOutline,
      businessOutline,
      homeOutline,
      peopleOutline,
      personOutline,
      calendarOutline,
      logOutOutline,
      settingsOutline,
      shieldCheckmarkOutline,
    });
  }

  visibleMenuItems(): MenuItem[] {
    return this.menuItems.filter((item) => {
      if (item.adminOnly) {
        return this.authService.isAdminOrSuperAdmin();
      }
      return true;
    });
  }

  /** El super_admin no ve el layout normal de app, solo el panel admin */
  get isSuperAdminLayout(): boolean {
    return this.authService.isSuperAdmin();
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  async closeMenu(): Promise<void> {
    await this.menuCtrl.close();
  }
}
