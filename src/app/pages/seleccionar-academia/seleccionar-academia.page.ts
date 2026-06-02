import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AcademiaContextService } from '../../services/academia-context.service';
import { AuthService } from '../../services/auth.service';
import { Academia } from '../../interfaces/academia.interface';

@Component({
  selector: 'app-seleccionar-academia',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-content class="ion-padding">
      <div class="selection-container">
        <div class="header">
          <ion-icon name="business-outline" class="header-icon"></ion-icon>
          <h1>Seleccionar Academia</h1>
          <p>Elige la academia en la que deseas trabajar</p>
        </div>

        @if (loading()) {
          <div class="ion-text-center ion-padding">
            <ion-spinner></ion-spinner>
          </div>
        } @else if (academias().length > 0) {
          <ion-list>
            @for (academia of academias(); track academia.id) {
              <ion-item button detail (click)="seleccionar(academia)">
                <ion-label>
                  <h2>{{ academia.nombre }}</h2>
                  <p>{{ academia.direccion }}</p>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        } @else {
          <ion-card>
            <ion-card-content class="ion-text-center ion-padding">
              <ion-icon name="business-outline" size="large" color="medium"></ion-icon>
              <p class="ion-margin-top">No tienes academias asignadas.</p>
              <p>Contacta a un administrador para que te asigne a una academia.</p>
            </ion-card-content>
          </ion-card>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .selection-container {
        max-width: 500px;
        margin: 0 auto;
        padding-top: 3rem;
      }
      .header {
        text-align: center;
        margin-bottom: 2rem;
      }
      .header-icon {
        font-size: 48px;
        color: var(--ion-color-primary);
      }
      .header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 8px 0 4px;
      }
      .header p {
        color: var(--ion-color-medium);
        margin: 0;
      }
    `,
  ],
})
export class SeleccionarAcademiaPage implements OnInit {
  private readonly academiaContext = inject(AcademiaContextService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly academias = this.academiaContext.academiasDisponibles;
  readonly loading = this.academiaContext.loading;

  ngOnInit(): void {
    // Super-admin no debería estar aquí, redirigir si llegó por error
    if (this.authService.isSuperAdmin()) {
      this.router.navigate(['/admin/academias'], { replaceUrl: true });
    }
  }

  async seleccionar(academia: Academia): Promise<void> {
    const success = await this.academiaContext.setAcademiaActiva(academia.id);
    if (success) {
      this.router.navigate(['/app/dashboard'], { replaceUrl: true });
    }
  }
}
