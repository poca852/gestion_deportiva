import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);

  async ngOnInit(): Promise<void> {
    // Solo agregar listeners de ciclo de vida en plataforma nativa
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app');

      // Al reabrir la app, refrescar la sesión
      await App.addListener('resume', () => {
        this.authService.refreshSession();
      });
    }
  }

  ngOnDestroy(): void {
    // Los listeners se limpian automáticamente cuando se destruye el componente
  }
}
