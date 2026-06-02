import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  basketballOutline,
  calendarOutline,
  createOutline,
  printOutline,
  trashOutline,
} from 'ionicons/icons';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ConvocatoriasService } from '../../services/convocatorias.service';
import { Convocatoria } from '../../interfaces/convocatoria.interface';

@Component({
  selector: 'app-convocatorias',
  templateUrl: './convocatorias.page.html',
  styleUrls: ['./convocatorias.page.scss'],
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
    IonSpinner,
  ],
})
export class ConvocatoriasPage implements OnInit, OnDestroy {
  private readonly convocatoriasService = inject(ConvocatoriasService);
  private readonly authService = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  convocatorias: Convocatoria[] = [];
  loading = true;
  deletingId: string | null = null;
  private profileSub?: Subscription;
  private listLoadId = 0;

  constructor() {
    addIcons({ addOutline, createOutline, printOutline, trashOutline, basketballOutline, calendarOutline });
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
        this.loadConvocatorias();
      });
  }

  ionViewWillEnter(): void {
    if (this.authService.currentProfile) {
      this.loadConvocatorias();
    }
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  loadConvocatorias(): void {
    const categoria = this.authService.getListCategoriaFilter();
    if (categoria === undefined) {
      this.clearList();
      this.loading = true;
      return;
    }

    const loadId = ++this.listLoadId;
    this.loading = true;
    this.convocatorias = [];

    this.convocatoriasService.getAll(categoria).subscribe({
      next: (data) => {
        if (loadId !== this.listLoadId) {
          return;
        }
        this.convocatorias = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (loadId === this.listLoadId) {
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
    });
  }

  handleRefresh(event: CustomEvent): void {
    this.loadConvocatorias();
    (event.target as HTMLIonRefresherElement).complete();
  }

  private clearList(): void {
    this.convocatorias = [];
    this.loading = false;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  async confirmDelete(conv: Convocatoria): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar convocatoria',
      message: `¿Eliminar la convocatoria "${conv.nombre_evento}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.deleteConvocatoria(conv);
          },
        },
      ],
    });
    await alert.present();
  }

  private deleteConvocatoria(conv: Convocatoria): void {
    if (this.deletingId) {
      return;
    }

    this.deletingId = conv.id;
    this.cdr.markForCheck();

    this.convocatoriasService.delete(conv.id, conv.firma_entrenador_url).subscribe({
      next: async () => {
        this.convocatorias = this.convocatorias.filter((c) => c.id !== conv.id);
        this.deletingId = null;
        this.cdr.markForCheck();
        await this.showToast(
          `Convocatoria "${conv.nombre_evento}" eliminada`,
          'success'
        );
      },
      error: async (err: Error) => {
        this.deletingId = null;
        this.cdr.markForCheck();
        await this.showToast(err.message, 'danger');
      },
    });
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
