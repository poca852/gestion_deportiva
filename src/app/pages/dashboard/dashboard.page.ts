import { TitleCasePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  analyticsOutline,
  calendarOutline,
  chevronForwardOutline,
  documentTextOutline,
  idCardOutline,
  peopleOutline,
  personOutline,
  personAddOutline,
} from 'ionicons/icons';
import { forkJoin, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AlumnosService } from '../../services/alumnos.service';
import { ConvocatoriasService } from '../../services/convocatorias.service';
import { EntrenadoresService } from '../../services/entrenadores.service';
import { CategoriaFilter } from '../../utils/categoria-filter.util';

interface StatCard {
  title: string;
  value: number;
  icon: string;
  color: string;
}

interface CategoriaResumen {
  categoria: string;
  total: number;
}

interface QuickAction {
  title: string;
  subtitle: string;
  icon: string;
  url: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
    IonSpinner,
    TitleCasePipe,
  ],
})
export class DashboardPage implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly alumnosService = inject(AlumnosService);
  private readonly convocatoriasService = inject(ConvocatoriasService);
  private readonly entrenadoresService = inject(EntrenadoresService);

  stats: StatCard[] = [];
  categoriasResumen: CategoriaResumen[] = [];
  quickActions: QuickAction[] = [];
  loading = true;
  isAdmin = false;
  subtitulo = '';
  private profileSub?: Subscription;
  private statsLoadId = 0;

  constructor() {
    addIcons({
      analyticsOutline,
      personOutline,
      calendarOutline,
      peopleOutline,
      personAddOutline,
      documentTextOutline,
      idCardOutline,
      addOutline,
      chevronForwardOutline,
    });
  }

  private buildQuickActions(): void {
    this.quickActions = [
      {
        title: 'Nuevo alumno',
        subtitle: 'Registrar un nuevo jugador',
        icon: 'person-add-outline',
        url: '/app/alumnos/nuevo',
        color: 'primary',
      },
      {
        title: 'Nueva convocatoria',
        subtitle: 'Crear una convocatoria',
        icon: 'add-outline',
        url: '/app/convocatorias/nueva',
        color: 'secondary',
      },
      {
        title: 'Generar reporte',
        subtitle: 'Listado de jugadores en PDF',
        icon: 'document-text-outline',
        url: '/app/alumnos/listado-print',
        color: 'tertiary',
      },
      {
        title: 'Carnets en masa',
        subtitle: 'Generar carnets por categoría',
        icon: 'id-card-outline',
        url: '/app/carnets',
        color: 'success',
      },
      ...(this.isAdmin
        ? [
            {
              title: 'Gestionar academia',
              subtitle: 'Logo, sello y configuración',
              icon: 'analytics-outline',
              url: '/app/academia',
              color: 'warning',
            } as QuickAction,
          ]
        : []),
    ];
  }

  ngOnInit(): void {
    this.profileSub = this.authService.profile$.subscribe((profile) => {
      if (!profile) {
        this.statsLoadId += 1;
        this.stats = [];
        this.categoriasResumen = [];
        this.quickActions = [];
        this.loading = false;
        return;
      }
      this.refreshDashboard();
    });
  }

  ionViewWillEnter(): void {
    if (!this.authService.currentProfile) {
      return;
    }
    if (this.loading && this.stats.length === 0) {
      this.refreshDashboard();
    }
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  handleRefresh(event: CustomEvent): void {
    this.refreshDashboard();
    (event.target as HTMLIonRefresherElement).complete();
  }

  private refreshDashboard(): void {
    this.isAdmin = this.authService.isAdmin();
    this.buildQuickActions();
    const categoria = this.authService.getListCategoriaFilter();
    if (categoria === undefined) {
      return;
    }

    this.subtitulo = this.isAdmin
      ? 'Estadísticas globales de la academia'
      : Array.isArray(categoria) && categoria.length > 0
        ? `Datos de tus categorías: ${categoria.join(', ')}`
        : 'Sin categorías asignadas';

    this.loadStats(categoria);
  }

  private loadStats(categoria: CategoriaFilter): void {
    const loadId = ++this.statsLoadId;
    this.loading = true;
    this.stats = [];
    this.categoriasResumen = [];

    const complete = (apply: () => void): void => {
      if (loadId !== this.statsLoadId) {
        return;
      }
      apply();
      this.loading = false;
    };

    if (this.isAdmin) {
      forkJoin({
        alumnos: this.alumnosService.getStats(categoria),
        convocatorias: this.convocatoriasService.count(categoria),
        entrenadores: this.entrenadoresService.count(),
      }).subscribe({
        next: (data) => {
          complete(() => {
            this.stats = [
              {
                title: 'Entrenadores',
                value: data.entrenadores,
                icon: 'people-outline',
                color: 'tertiary',
              },
              {
                title: 'Alumnos',
                value: data.alumnos.total,
                icon: 'person-outline',
                color: 'primary',
              },
              {
                title: 'Convocatorias',
                value: data.convocatorias,
                icon: 'calendar-outline',
                color: 'secondary',
              },
            ];
            this.categoriasResumen = data.alumnos.porCategoria.filter(
              (c) => c.total > 0
            );
          });
        },
        error: () => complete(() => undefined),
      });
    } else {
      forkJoin({
        alumnos: this.alumnosService.getStats(categoria),
        convocatorias: this.convocatoriasService.count(categoria),
      }).subscribe({
        next: (data) => {
          complete(() => {
            this.stats = [
              {
                title: 'Alumnos',
                value: data.alumnos.total,
                icon: 'person-outline',
                color: 'primary',
              },
              {
                title: 'Convocatorias',
                value: data.convocatorias,
                icon: 'calendar-outline',
                color: 'secondary',
              },
            ];
            const cats = Array.isArray(categoria) ? categoria : [];
            this.categoriasResumen =
              cats.length > 1
                ? data.alumnos.porCategoria.filter((c) => c.total > 0)
                : [];
          });
        },
        error: () => complete(() => undefined),
      });
    }
  }
}
