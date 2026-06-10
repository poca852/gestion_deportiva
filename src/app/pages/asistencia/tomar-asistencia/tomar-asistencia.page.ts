import { TitleCasePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  lockClosedOutline,
  personOutline,
  qrCodeOutline,
  searchOutline,
  timeOutline,
} from 'ionicons/icons';
import {
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  Subject,
  Subscription,
  switchMap,
} from 'rxjs';
import { Alumno } from '../../../interfaces/alumno.interface';
import {
  AsistenciaConAlumno,
  RegistroAsistenciaResult,
} from '../../../interfaces/asistencia.interface';
import { SesionConStats } from '../../../interfaces/sesion-entrenamiento.interface';
import { AlumnosService } from '../../../services/alumnos.service';
import { AsistenciasService } from '../../../services/asistencias.service';
import { AuthService } from '../../../services/auth.service';
import { QrScannerService } from '../../../services/qr-scanner.service';
import { extractPublicTokenFromQr } from '../../../utils/qr-token.util';

type ModoAsistencia = 'escanear' | 'manual';

@Component({
  selector: 'app-tomar-asistencia',
  templateUrl: './tomar-asistencia.page.html',
  styleUrls: ['./tomar-asistencia.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonChip,
    IonBadge,
    IonSpinner,
    TitleCasePipe,
  ],
})
export class TomarAsistenciaPage implements OnInit, OnDestroy {
  private readonly asistenciasService = inject(AsistenciasService);
  private readonly alumnosService = inject(AlumnosService);
  private readonly authService = inject(AuthService);
  private readonly qrScanner = inject(QrScannerService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  modo: ModoAsistencia = 'escanear';
  fechaHoy = '';
  fechaDisplay = '';
  asistencias: AsistenciaConAlumno[] = [];
  sesiones: SesionConStats[] = [];
  resultadosBusqueda: Pick<
    Alumno,
    'id' | 'nombres' | 'apellidos' | 'categoria'
  >[] = [];

  loading = true;
  escaneando = false;
  registrandoId: string | null = null;
  cerrandoSesionId: string | null = null;
  buscando = false;
  searchTerm = '';
  escaneoDisponible = true;
  avisoEscaneo = '';

  private readonly searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  private loadSub?: Subscription;

  constructor() {
    addIcons({
      qrCodeOutline,
      searchOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      lockClosedOutline,
      personOutline,
      timeOutline,
    });
  }

  ngOnInit(): void {
    this.fechaHoy = this.asistenciasService.localDateString();
    this.fechaDisplay = this.asistenciasService.formatFechaDisplay(this.fechaHoy);
    this.refreshScannerAvailability();
    this.setupSearch();
    this.loadDatos();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.loadSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    const hoy = this.asistenciasService.localDateString();
    if (hoy !== this.fechaHoy) {
      this.fechaHoy = hoy;
      this.fechaDisplay = this.asistenciasService.formatFechaDisplay(hoy);
    }
    this.loadDatos();
  }

  get sesionesAbiertas(): SesionConStats[] {
    return this.sesiones.filter((s) => s.estado === 'abierta');
  }

  onModoChange(event: CustomEvent): void {
    this.modo = event.detail.value as ModoAsistencia;
  }

  handleRefresh(event: CustomEvent): void {
    this.loadDatos(() => {
      (event.target as HTMLIonRefresherElement).complete();
    });
  }

  onSearchInput(event: CustomEvent): void {
    const value = (event.detail.value as string | null) ?? '';
    this.searchTerm = value;
    this.searchSubject.next(value);
  }

  async escanearQr(): Promise<void> {
    if (this.escaneando) return;

    const profile = this.authService.currentProfile;
    if (!profile) return;

    this.escaneando = true;
    const outcome = await this.qrScanner.scan();
    this.escaneando = false;

    if (outcome.status === 'cancelled') {
      return;
    }

    if (outcome.status === 'error') {
      await this.showToast(outcome.message, 'warning', 4500);
      return;
    }

    const token = extractPublicTokenFromQr(outcome.content);
    if (!token) {
      await this.showToast(
        'El código QR no corresponde a un carnet de alumno',
        'warning'
      );
      return;
    }

    this.registrarPorToken(token, profile.id);
  }

  registrarManual(
    alumno: Pick<Alumno, 'id' | 'nombres' | 'apellidos' | 'categoria'>
  ): void {
    const profile = this.authService.currentProfile;
    if (!profile || this.registrandoId) return;

    this.registrandoId = alumno.id;
    this.asistenciasService
      .registrar(alumno.id, 'manual', profile.id, this.fechaHoy)
      .subscribe({
        next: (result) => {
          this.registrandoId = null;
          void this.handleRegistro(result);
        },
        error: (err: Error) => {
          this.registrandoId = null;
          void this.showToast(
            err.message || 'No se pudo registrar la asistencia',
            'danger'
          );
        },
      });
  }

  async confirmarCerrarSesion(sesion: SesionConStats): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar sesión',
      message: `¿Cerrar la sesión de ${sesion.categoria}? Se calcularán las faltas de los alumnos que no registraron asistencia (${sesion.presentes} presentes hasta ahora).`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar sesión',
          role: 'confirm',
        },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    this.cerrarSesion(sesion.id);
  }

  nombreCompleto(
    alumno: Pick<Alumno, 'nombres' | 'apellidos'>
  ): string {
    return `${alumno.nombres} ${alumno.apellidos}`;
  }

  iniciales(
    alumno: Pick<Alumno, 'nombres' | 'apellidos'>
  ): string {
    const n = alumno.nombres.charAt(0) || '';
    const a = alumno.apellidos.charAt(0) || '';
    return `${n}${a}`.toUpperCase();
  }

  horaRegistro(asistencia: AsistenciaConAlumno): string {
    return this.asistenciasService.formatHora(asistencia.created_at);
  }

  metodoLabel(metodo: string): string {
    return metodo === 'qr' ? 'QR' : 'Manual';
  }

  irAManual(): void {
    this.modo = 'manual';
  }

  private cerrarSesion(sesionId: string): void {
    const profile = this.authService.currentProfile;
    if (!profile || this.cerrandoSesionId) return;

    this.cerrandoSesionId = sesionId;
    this.asistenciasService.cerrarSesion(sesionId, profile.id).subscribe({
      next: (result) => {
        this.cerrandoSesionId = null;
        void this.showToast(
          `Sesión ${result.sesion.categoria} cerrada: ${result.presentes} presentes, ${result.faltas} faltas`,
          'success',
          4000
        );
        this.loadDatos();
      },
      error: (err: Error) => {
        this.cerrandoSesionId = null;
        void this.showToast(
          err.message || 'No se pudo cerrar la sesión',
          'danger'
        );
      },
    });
  }

  private refreshScannerAvailability(): void {
    const availability = this.qrScanner.getAvailability();
    this.escaneoDisponible = availability.available;

    if (!availability.available) {
      this.avisoEscaneo = availability.message ?? '';
      return;
    }

    this.avisoEscaneo = this.qrScanner.isWebPlatform()
      ? this.qrScanner.getWebScanHint()
      : '';
  }

  private setupSearch(): void {
    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.trim().length < 2) {
            this.buscando = false;
            return this.alumnosService.searchByNombre('');
          }
          this.buscando = true;
          return this.alumnosService.searchByNombre(term);
        })
      )
      .subscribe({
        next: (results) => {
          this.resultadosBusqueda = results;
          this.buscando = false;
        },
        error: () => {
          this.resultadosBusqueda = [];
          this.buscando = false;
        },
      });
  }

  private registrarPorToken(token: string, registradoPor: string): void {
    this.asistenciasService
      .registrarPorPublicToken(token, registradoPor, this.fechaHoy)
      .subscribe({
        next: (result) => void this.handleRegistro(result),
        error: (err: Error) =>
          void this.showToast(
            err.message || 'No se pudo registrar la asistencia',
            'danger'
          ),
      });
  }

  private async handleRegistro(result: RegistroAsistenciaResult): Promise<void> {
    switch (result.status) {
      case 'ok':
        if (result.asistencia) {
          this.prependAsistencia(result.asistencia);
        }
        this.refreshSesiones();
        await this.feedbackSuccess();
        await this.showToast(
          `Asistencia registrada: ${result.asistencia ? this.nombreCompleto(result.asistencia.alumno) : 'Alumno'}`,
          'success'
        );
        if (this.modo === 'escanear') {
          setTimeout(() => void this.escanearQr(), 600);
        }
        break;

      case 'duplicate':
        await this.feedbackWarning();
        await this.showToast(
          result.message ??
            `${result.alumno ? this.nombreCompleto(result.alumno) : 'Alumno'} ya tiene asistencia registrada` +
              (result.horaRegistro ? ` (${result.horaRegistro})` : ''),
          'warning'
        );
        if (this.modo === 'escanear') {
          setTimeout(() => void this.escanearQr(), 800);
        }
        break;

      case 'session_closed':
        await this.feedbackWarning();
        await this.showToast(
          result.message ?? 'La sesión de esta categoría ya fue cerrada',
          'warning',
          4500
        );
        break;

      case 'not_found':
        await this.showToast(
          result.message ?? 'No se encontró el alumno',
          'warning'
        );
        break;

      default:
        await this.showToast(
          result.message ?? 'No se pudo registrar la asistencia',
          'danger'
        );
    }
  }

  private prependAsistencia(asistencia: AsistenciaConAlumno): void {
    this.asistencias = [
      asistencia,
      ...this.asistencias.filter((a) => a.id !== asistencia.id),
    ];
  }

  private refreshSesiones(): void {
    this.asistenciasService.getSesionesHoy(this.fechaHoy).subscribe({
      next: (data) => {
        this.sesiones = data;
      },
    });
  }

  private loadDatos(onComplete?: () => void): void {
    this.loadSub?.unsubscribe();
    this.loading = true;

    this.loadSub = forkJoin({
      asistencias: this.asistenciasService.getHoy(this.fechaHoy),
      sesiones: this.asistenciasService.getSesionesHoy(this.fechaHoy),
    }).subscribe({
      next: ({ asistencias, sesiones }) => {
        this.asistencias = asistencias;
        this.sesiones = sesiones;
        this.loading = false;
        onComplete?.();
      },
      error: () => {
        this.asistencias = [];
        this.sesiones = [];
        this.loading = false;
        onComplete?.();
      },
    });
  }

  private async feedbackSuccess(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Ignorar si haptics no está disponible
    }
  }

  private async feedbackWarning(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      // Ignorar si haptics no está disponible
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger',
    duration?: number
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: duration ?? (color === 'success' ? 2200 : 3200),
      color,
      position: 'top',
    });
    await toast.present();
  }
}
