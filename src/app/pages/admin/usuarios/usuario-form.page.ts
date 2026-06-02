import { Component, OnInit, inject } from '@angular/core';
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
  IonSelect,
  IonSelectOption,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { saveOutline, keyOutline, sendOutline } from 'ionicons/icons';
import { EntrenadoresService } from '../../../services/entrenadores.service';
import { AcademiaService } from '../../../services/academia.service';
import { SupabaseService } from '../../../services/supabase.service';
import {
  Entrenador,
  RolEntrenador,
} from '../../../interfaces/entrenador.interface';
import { Academia } from '../../../interfaces/academia.interface';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-usuario-form',
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
    IonSelect,
    IonSelectOption,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/admin/usuarios"></ion-back-button>
        </ion-buttons>
        <ion-title>{{
          esEdicion ? 'Editar' : 'Nuevo'
        }} Usuario</ion-title>
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
            <ion-label position="stacked" color="primary"
              >Nombre completo *</ion-label
            >
            <ion-input
              [(ngModel)]="form.nombre"
              placeholder="Nombre del usuario"
              required
            ></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked" color="primary"
              >Correo electrónico</ion-label
            >
            <ion-input
              [(ngModel)]="form.correo"
              type="email"
              placeholder="correo@ejemplo.com"
              [disabled]="esEdicion"
            ></ion-input>
          </ion-item>

          @if (!esEdicion) {
            <ion-item>
              <ion-label position="stacked" color="primary"
                >Contraseña *</ion-label
              >
              <ion-input
                [(ngModel)]="form.password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                required
              ></ion-input>
            </ion-item>
          }

          <ion-item>
            <ion-label position="stacked" color="primary">Rol</ion-label>
            <ion-select
              [(ngModel)]="form.rol"
              placeholder="Seleccionar rol"
              interface="action-sheet"
            >
              <ion-select-option value="admin"
                >Administrador</ion-select-option
              >
              <ion-select-option value="coach"
                >Entrenador</ion-select-option
              >
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-label position="stacked" color="primary"
              >Academia asignada</ion-label
            >
            <ion-select
              [(ngModel)]="form.academia_id"
              placeholder="Seleccionar academia"
              interface="action-sheet"
            >
              <ion-select-option [value]="null"
                >Sin academia</ion-select-option
              >
              @for (academia of academias; track academia.id) {
                <ion-select-option [value]="academia.id">
                  {{ academia.nombre }}
                </ion-select-option>
              }
            </ion-select>
          </ion-item>
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
            {{ esEdicion ? 'Guardar Cambios' : 'Crear Usuario' }}
          </ion-button>

          @if (esEdicion && form.correo) {
            <ion-button
              expand="block"
              fill="outline"
              color="warning"
              class="ion-margin-top"
              (click)="restablecerPassword()"
              [disabled]="reseteandoPassword"
            >
              <ion-icon name="send-outline" slot="start"></ion-icon>
              {{ reseteandoPassword ? 'Enviando...' : 'Enviar enlace de restablecimiento' }}
            </ion-button>
          }
        </div>
      }
    </ion-content>
  `,
})
export class UsuarioFormPage implements OnInit {
  private readonly entrenadoresService = inject(EntrenadoresService);
  private readonly academiaService = inject(AcademiaService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastCtrl = inject(ToastController);

  esEdicion = false;
  usuarioId: string | null = null;
  academias: Academia[] = [];
  /** ID de academia original (para detectar cambios y sincronizar admin_id) */
  private academiaIdOriginal: string | null = null;

  form: {
    nombre: string;
    correo: string;
    password: string;
    rol: RolEntrenador;
    academia_id: string | null;
  } = {
    nombre: '',
    correo: '',
    password: '',
    rol: 'coach',
    academia_id: null,
  };

  guardando = false;
  cargandoDatos = false;
  reseteandoPassword = false;
  error = '';

  constructor() {
    addIcons({ saveOutline, keyOutline, sendOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.cargarAcademias();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.usuarioId = id;
      await this.cargarUsuario(id);
    }
  }

  private async cargarAcademias(): Promise<void> {
    try {
      this.academias = await firstValueFrom(this.academiaService.getAll());
    } catch {
      this.academias = [];
    }
  }

  private async cargarUsuario(id: string): Promise<void> {
    this.cargandoDatos = true;
    try {
      const usuarios = await firstValueFrom(
        this.entrenadoresService.getAll()
      );
      const usuario = usuarios.find((u) => u.id === id);
      if (usuario) {
        this.form = {
          nombre: usuario.nombre,
          correo: usuario.correo,
          password: '',
          rol: usuario.rol,
          academia_id: usuario.academia_id,
        };
        this.academiaIdOriginal = usuario.academia_id;
      } else {
        await this.router.navigate(['/admin/usuarios']);
      }
    } catch {
      await this.router.navigate(['/admin/usuarios']);
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
      if (this.esEdicion && this.usuarioId) {
        const nuevaAcademiaId = this.form.academia_id;

        await firstValueFrom(
          this.entrenadoresService.update(this.usuarioId, {
            nombre: this.form.nombre,
            rol: this.form.rol,
            academia_id: nuevaAcademiaId,
          })
        );

        // Sincronizar admin_id en academias
        if (nuevaAcademiaId !== this.academiaIdOriginal) {
          // Quitar admin_id de la academia anterior
          if (this.academiaIdOriginal) {
            await firstValueFrom(
              this.academiaService.update(this.academiaIdOriginal, {
                admin_id: null,
              })
            );
          }
          // Asignar admin_id en la nueva academia (solo si es admin)
          if (nuevaAcademiaId && this.form.rol === 'admin') {
            await firstValueFrom(
              this.academiaService.update(nuevaAcademiaId, {
                admin_id: this.usuarioId,
              })
            );
          }
        }

        const toast = await this.toastCtrl.create({
          message: 'Usuario actualizado correctamente',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      } else {
        if (!this.form.password || this.form.password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres');
        }
        if (!this.form.correo.trim()) {
          throw new Error('El correo es obligatorio');
        }

        const nuevoUsuario = await firstValueFrom(
          this.entrenadoresService.create({
            nombre: this.form.nombre,
            correo: this.form.correo,
            password: this.form.password,
            rol: this.form.rol,
            academia_id: this.form.academia_id,
            categorias_asignadas: [],
          })
        );

        // Si se asignó una academia y el rol es admin, actualizar admin_id
        if (this.form.academia_id && this.form.rol === 'admin') {
          await firstValueFrom(
            this.academiaService.update(this.form.academia_id, {
              admin_id: nuevoUsuario.id,
            })
          );
        }

        const toast = await this.toastCtrl.create({
          message: 'Usuario creado correctamente',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      }

      await this.router.navigate(['/admin/usuarios']);
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : 'Error al guardar el usuario';
    } finally {
      this.guardando = false;
    }
  }

  async restablecerPassword(): Promise<void> {
    if (!this.form.correo) return;

    this.reseteandoPassword = true;
    try {
      const { error } =
        await this.supabaseService.supabase.auth.resetPasswordForEmail(
          this.form.correo
        );
      if (error) throw error;

      const toast = await this.toastCtrl.create({
        message: 'Enlace de restablecimiento enviado al correo',
        duration: 3000,
        color: 'success',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: err instanceof Error ? err.message : 'Error al enviar enlace',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.reseteandoPassword = false;
    }
  }
}
