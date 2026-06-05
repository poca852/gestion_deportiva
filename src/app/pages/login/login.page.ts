import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, mailOutline, shieldCheckmarkOutline, trophyOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { emailValidator } from '../../utils/email-validation.util';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon,
  ],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  loading = false;
  errorMessage = '';

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, emailValidator()]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    addIcons({ lockClosedOutline, mailOutline, shieldCheckmarkOutline, trophyOutline });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const { email, password } = this.form.getRawValue();

    this.authService.login(email, password).subscribe({
      next: (profile) => {
        this.loading = false;
        if (profile.rol === 'super_admin') {
          this.router.navigate(['/admin/academias'], { replaceUrl: true });
        } else if (profile.academia_id) {
          this.router.navigate(['/app/dashboard'], { replaceUrl: true });
        } else {
          this.router.navigate(['/seleccionar-academia'], { replaceUrl: true });
        }
      },
      error: async (err: Error) => {
        this.loading = false;
        this.errorMessage = err.message ?? 'Error al iniciar sesión';
        const toast = await this.toastCtrl.create({
          message: this.errorMessage,
          duration: 3000,
          color: 'danger',
        });
        await toast.present();
      },
    });
  }
}
