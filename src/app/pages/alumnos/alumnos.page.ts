import { TitleCasePipe } from '@angular/common';
import { Component, NgZone, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  documentTextOutline,
  eyeOutline,
  idCardOutline,
  peopleOutline,
  trashOutline,
} from 'ionicons/icons';
import { distinctUntilChanged, firstValueFrom, Subscription } from 'rxjs';
import {
  IonInfiniteScroll,
  IonInfiniteScrollContent,
} from '@ionic/angular/standalone';
import { LazyImageComponent } from '../../components/lazy-image/lazy-image.component';
import { Alumno } from '../../interfaces/alumno.interface';
import { AlumnosService } from '../../services/alumnos.service';
import { AuthService } from '../../services/auth.service';
import { CATEGORIAS } from '../../services/categoria.service';
import { CategoriaFilter } from '../../utils/categoria-filter.util';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-alumnos',
  templateUrl: './alumnos.page.html',
  styleUrls: ['./alumnos.page.scss'],
  standalone: true,
  imports: [
    TitleCasePipe,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonAvatar,
    IonChip,
    IonButton,
    IonIcon,
    IonFab,
    IonFabButton,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    LazyImageComponent,
  ],
})
export class AlumnosPage implements OnInit, OnDestroy {
  private readonly alumnosService = inject(AlumnosService);
  private readonly supabaseService = inject(SupabaseService);
  readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly ngZone = inject(NgZone);

  /** Cantidad de alumnos por página (paginación server-side) */
  private readonly PAGE_SIZE = 20;

  alumnos: Alumno[] = [];
  totalCount = 0;
  fotoUrls = new Map<string, string>();
  fotoResolving = new Set<string>();
  /** Alumnos que ya intentaron recargar su foto (evita reintentos infinitos) */
  private fotoRetried = new Set<string>();
  loading = true;
  loadingMore = false;
  searchTerm = '';
  categoriaFiltro = '';
  categorias: string[] = [...CATEGORIAS];
  /** Página actual (0-based) */
  currentPage = 0;
  /** True si ya se cargaron todos los alumnos disponibles */
  allLoaded = false;
  private profileSub?: Subscription;
  private listLoadId = 0;

  constructor() {
    addIcons({
      addOutline,
      createOutline,
      eyeOutline,
      trashOutline,
      documentTextOutline,
      idCardOutline,
      peopleOutline,
    });
  }

  ngOnInit(): void {
    this.profileSub = this.authService.profile$
      .pipe(
        distinctUntilChanged(
          (prev, curr) =>
            prev?.id === curr?.id &&
            prev?.rol === curr?.rol &&
            JSON.stringify(prev?.categorias_asignadas ?? []) ===
              JSON.stringify(curr?.categorias_asignadas ?? [])
        )
      )
      .subscribe((profile) => {
        if (!profile) {
          this.listLoadId += 1;
          this.clearList();
          return;
        }
        if (profile.rol === 'admin') {
          this.categoriaFiltro = '';
        } else {
          const cats = profile.categorias_asignadas ?? [];
          this.categoriaFiltro = cats.length === 1 ? cats[0] : '';
        }
        this.loadAlumnos();
      });
  }

  ionViewWillEnter(): void {
    if (this.authService.currentProfile) {
      this.loadAlumnos();
    }
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  /** Carga la primera página y reinicia la lista. */
  loadAlumnos(): void {
    this.currentPage = 0;
    this.allLoaded = false;
    this.alumnos = [];
    this.fotoUrls.clear();
    this.fotoResolving.clear();
    this.fotoRetried.clear();
    this.totalCount = 0;

    this.loadPage(0).then(() => {
      this.loading = false;
    });
  }

  /** Carga una página específica y la añade a la lista. */
  private async loadPage(page: number): Promise<void> {
    const categoria = this.resolveCategoriaFilter();
    if (categoria === undefined) {
      return;
    }

    const loadId = this.listLoadId;
    const epoch = this.authService.getDataEpoch();

    const searchValue = this.searchTerm.trim().toLowerCase();

    return new Promise((resolve) => {
      this.alumnosService.getAllPaginated({
        categoria,
        search: searchValue || undefined,
        page,
        perPage: this.PAGE_SIZE,
      }).subscribe({
        next: (result) => {
          if (loadId !== this.listLoadId) {
            resolve();
            return;
          }

          this.totalCount = result.count;

          if (page === 0) {
            this.alumnos = result.data;
          } else {
            // Evitar duplicados por si las páginas se solapan
            const nuevos = result.data.filter(
              (a) => !this.alumnos.some((exist) => exist.id === a.id)
            );
            this.alumnos = [...this.alumnos, ...nuevos];
          }

          this.allLoaded = this.alumnos.length >= this.totalCount;
          resolve();

          // Resolver fotos de los nuevos alumnos
          void this.resolveFotoUrls(result.data, epoch);
        },
        error: () => {
          resolve();
        },
      });
    });
  }

  /** Carga más datos cuando se activa el infinite scroll. */
  async loadMore(event: CustomEvent): Promise<void> {
    if (this.allLoaded || this.loadingMore) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }

    this.loadingMore = true;
    this.currentPage++;
    await this.loadPage(this.currentPage);
    this.loadingMore = false;

    (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  handleRefresh(event: CustomEvent): void {
    this.loadAlumnos();
    (event.target as HTMLIonRefresherElement).complete();
  }

  onSearch(event: CustomEvent): void {
    this.searchTerm = (event.detail as { value: string }).value ?? '';
    this.loadAlumnos();
  }

  onCategoriaChange(event: CustomEvent): void {
    this.categoriaFiltro = (event.detail as { value: string }).value ?? '';
    this.loadAlumnos();
  }

  categoriasFiltroOpciones(): string[] {
    if (this.authService.isAdmin()) {
      return [...this.categorias];
    }
    return this.authService.categoriasAsignadas();
  }

  /**
   * Resuelve el filtro de categoría combinando:
   * - La restricción del perfil (coach solo ve sus categorías asignadas)
   * - La selección manual del usuario en el filtro (categoriaFiltro)
   *
   * Retorna undefined si el perfil no está listo (no consultar).
   */
  private resolveCategoriaFilter(): CategoriaFilter {
    const profile = this.authService.currentProfile;
    if (!profile) return undefined;

    if (profile.rol === 'admin') {
      // Admin: usa el filtro manual directamente
      return this.categoriaFiltro || null;
    }

    // Coach: restringido a sus categorías asignadas
    const assignedCats = profile.categorias_asignadas ?? [];
    if (assignedCats.length === 0) {
      return []; // Sin acceso a ninguna categoría
    }

    // Si hay un filtro manual y está dentro de las categorías asignadas, úsalo
    if (this.categoriaFiltro && assignedCats.includes(this.categoriaFiltro)) {
      return this.categoriaFiltro;
    }

    // Sin filtro manual: devuelve todas las categorías asignadas
    if (assignedCats.length === 1) {
      return assignedCats[0];
    }
    return assignedCats;
  }

  getFotoUrl(alumnoId: string): string | undefined {
    return this.fotoUrls.get(alumnoId);
  }

  isFotoResolving(alumnoId: string): boolean {
    return this.fotoResolving.has(alumnoId);
  }

  hasFoto(alumno: Alumno): boolean {
    return !!alumno.foto_estudiante_url;
  }

  private async resolveFotoUrls(
    alumnos: Alumno[],
    epoch: number
  ): Promise<void> {
    const alumnosConFoto = alumnos.filter((a) => !!a.foto_estudiante_url);

    // Procesar en lotes de 5 para no saturar la API
    const batchSize = 5;
    for (let i = 0; i < alumnosConFoto.length; i += batchSize) {
      const batch = alumnosConFoto.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (alumno) => {
          if (epoch !== this.authService.getDataEpoch()) {
            return;
          }

          this.fotoResolving.add(alumno.id);

          try {
            const url = await this.supabaseService.resolveFileUrl(
              alumno.foto_estudiante_url
            );
            if (url && epoch === this.authService.getDataEpoch()) {
              this.fotoUrls.set(alumno.id, url);
            }
          } catch {
            // Sin foto visible si falla, se muestra el fallback con iniciales
          } finally {
            if (epoch === this.authService.getDataEpoch()) {
              this.fotoResolving.delete(alumno.id);
            }
          }
        })
      );
    }
  }

  /** Reintenta resolver la URL de una foto específica (útil si la URL firmada expiró). */
  async retryFoto(alumnoId: string): Promise<void> {
    if (this.fotoRetried.has(alumnoId)) {
      return; // Ya se intentó una vez, no reintentar para evitar loop
    }
    const alumno = this.alumnos.find((a) => a.id === alumnoId);
    if (!alumno?.foto_estudiante_url || this.fotoResolving.has(alumnoId)) {
      return;
    }

    this.fotoRetried.add(alumnoId);
    this.fotoResolving.add(alumnoId);
    this.fotoUrls.delete(alumnoId);

    try {
      // cacheBust=true para forzar nueva URL firmada (no la de caché)
      const url = await this.supabaseService.resolveFileUrl(
        alumno.foto_estudiante_url,
        true
      );
      if (url) {
        this.fotoUrls.set(alumno.id, url);
      }
    } catch {
      // Si falla de nuevo, se queda sin foto (fallback con iniciales)
    } finally {
      this.fotoResolving.delete(alumnoId);
    }
  }

  async confirmDelete(alumno: Alumno): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar alumno',
      message: `¿Estás seguro de eliminar a "${alumno.nombres} ${alumno.apellidos}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.deleteAlumno(alumno),
        },
      ],
    });
    await alert.present();
  }

  private async deleteAlumno(alumno: Alumno): Promise<void> {
    try {
      await firstValueFrom(this.alumnosService.delete(alumno.id));
      this.ngZone.run(() => {
        this.alumnos = this.alumnos.filter((a) => a.id !== alumno.id);
        this.totalCount = Math.max(0, this.totalCount - 1);
        this.fotoUrls.delete(alumno.id);
      });
      const toast = await this.toastCtrl.create({
        message: 'Alumno eliminado correctamente',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: `Error al eliminar: ${(err as Error).message}`,
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  private clearList(): void {
    this.alumnos = [];
    this.totalCount = 0;
    this.fotoUrls.clear();
    this.fotoResolving.clear();
    this.fotoRetried.clear();
    this.loading = false;
    this.loadingMore = false;
    this.allLoaded = false;
    this.currentPage = 0;
  }
}
