import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, keyOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';
import { AuthChangeEvent } from '@supabase/supabase-js';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon,
  ],
  template: `
    <ion-content class="reset-content" [fullscreen]="true" scroll-y="false">
      <div class="reset-wrapper">
        <div class="reset-card">

          @switch (estado) {
            @case ('verificando') {
              <div class="brand">
                <ion-icon name="key-outline" class="brand-icon"></ion-icon>
                <h1>Verificando enlace...</h1>
                <div class="ion-padding-top">
                  <ion-spinner name="crescent"></ion-spinner>
                </div>
              </div>
            }

            @case ('expirado') {
              <div class="brand">
                <ion-icon name="lock-closed-outline" class="brand-icon error-icon"></ion-icon>
                <h1>Enlace inválido o expirado</h1>
                <p class="brand-subtitle">Solicita un nuevo enlace de restablecimiento desde tu panel de administración.</p>
                <ion-button expand="block" (click)="irAlLogin()" class="submit-btn">
                  Volver al inicio
                </ion-button>
              </div>
            }

            @case ('formulario') {
              <div class="brand">
                <ion-icon name="key-outline" class="brand-icon"></ion-icon>
                <h1>Restablecer contraseña</h1>
                <p class="brand-subtitle">Ingresa tu nueva contraseña</p>
              </div>

              <div class="form-container">
                <ion-item lines="full" class="input-item">
                  <ion-icon name="lock-closed-outline" slot="start"></ion-icon>
                  <ion-label position="stacked">Nueva contraseña</ion-label>
                  <ion-input
                    [(ngModel)]="nuevaPassword"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    (ionInput)="error = ''"
                  ></ion-input>
                </ion-item>

                <ion-item lines="full" class="input-item">
                  <ion-icon name="lock-closed-outline" slot="start"></ion-icon>
                  <ion-label position="stacked">Confirmar contraseña</ion-label>
                  <ion-input
                    [(ngModel)]="confirmarPassword"
                    type="password"
                    placeholder="Repite la contraseña"
                    (ionInput)="error = ''"
                  ></ion-input>
                </ion-item>

                @if (error) {
                  <ion-text color="danger" class="error-text">
                    <p>{{ error }}</p>
                  </ion-text>
                }

                <ion-button
                  expand="block"
                  (click)="actualizarPassword()"
                  [disabled]="guardando || !nuevaPassword.trim()"
                  class="submit-btn"
                >
                  @if (guardando) {
                    <ion-spinner name="crescent"></ion-spinner>
                  } @else {
                    <ion-icon name="key-outline" slot="start"></ion-icon>
                    Actualizar contraseña
                  }
                </ion-button>
              </div>
            }

            @case ('exito') {
              <div class="brand">
                <ion-icon name="checkmark-circle-outline" class="brand-icon success-icon"></ion-icon>
                <h1>Contraseña actualizada</h1>
                <p class="brand-subtitle">Tu contraseña se ha restablecido correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.</p>
                <ion-button expand="block" (click)="irAlLogin()" class="submit-btn">
                  Ir al inicio de sesión
                </ion-button>
              </div>
            }
          }

        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .reset-content {
        --background: linear-gradient(
          135deg,
          var(--app-brand-gradient-start) 0%,
          var(--app-brand-gradient-mid) 50%,
          var(--app-brand-gradient-end) 100%
        );
        --overflow: hidden;
      }

      .reset-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 24px;
      }

      .reset-card {
        width: 100%;
        max-width: 420px;
        background: #fff;
        border-radius: 16px;
        padding: 32px 24px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      }

      .brand {
        text-align: center;
        margin-bottom: 32px;

        .brand-icon {
          font-size: 64px;
          color: var(--app-brand-accent-light);
        }

        .error-icon {
          color: #dc2626;
        }

        .success-icon {
          color: #16a34a;
        }

        h1 {
          margin: 8px 0 4px;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--ion-color-dark);
        }

        .brand-subtitle {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 0.95rem;
        }
      }

      .form-container {
        margin-top: 8px;
      }

      .input-item {
        --background: #f1f5f9;
        --color: #1e293b;
        --highlight-color-focused: var(--ion-color-primary);
        --highlight-color-valid: var(--ion-color-primary);
        --highlight-color-invalid: #dc2626;
        --border-radius: 8px;
        margin-bottom: 12px;
        border-radius: 8px;

        ion-icon {
          color: var(--ion-color-primary);
        }

        ion-label {
          color: #475569;
        }

        ion-input {
          --color: #0f172a;
          --placeholder-color: #94a3b8;
          --placeholder-opacity: 1;
        }
      }

      .error-text {
        display: block;
        padding: 8px 4px;
        font-size: 0.875rem;
      }

      .submit-btn {
        margin-top: 24px;
        --background: var(--ion-color-secondary);
        --border-radius: 8px;
        font-weight: 600;
        height: 48px;
      }
    `,
  ],
})
export class ResetPasswordPage implements OnInit, OnDestroy {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  estado: 'verificando' | 'expirado' | 'formulario' | 'exito' = 'verificando';
  nuevaPassword = '';
  confirmarPassword = '';
  guardando = false;
  error = '';

  private authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

  constructor() {
    addIcons({ lockClosedOutline, keyOutline, checkmarkCircleOutline });
  }

  ngOnInit(): void {
    // Verificar si el usuario viene de un enlace de recuperación
    this.verificarSesionRecuperacion();
  }

  ngOnDestroy(): void {
    this.authSubscription?.data.subscription.unsubscribe();
  }

  private async verificarSesionRecuperacion(): Promise<void> {
    try {
      // Escuchar el evento PASSWORD_RECOVERY
      this.authSubscription = this.supabaseService.supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            this.estado = 'formulario';
          }
        }
      );

      // Verificar si la sesión ya tiene type recovery
      const { data } = await this.supabaseService.supabase.auth.getSession();
      if (data.session) {
        this.estado = 'formulario';
      } else {
        // Esperar un momento por si el token está siendo procesado
        setTimeout(() => {
          if (this.estado === 'verificando') {
            this.estado = 'expirado';
          }
        }, 5000);
      }
    } catch {
      this.estado = 'expirado';
    }
  }

  async actualizarPassword(): Promise<void> {
    this.error = '';

    if (!this.nuevaPassword.trim() || this.nuevaPassword.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (this.nuevaPassword !== this.confirmarPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }

    this.guardando = true;
    try {
      const { error } = await this.supabaseService.supabase.auth.updateUser({
        password: this.nuevaPassword,
      });

      if (error) throw error;

      this.estado = 'exito';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al actualizar la contraseña';
    } finally {
      this.guardando = false;
    }
  }

  irAlLogin(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
