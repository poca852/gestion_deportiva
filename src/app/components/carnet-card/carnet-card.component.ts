import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline } from 'ionicons/icons';
import { CarnetData } from '../../services/carnet.service';
import { formatFechaCortaCarnet } from '../../utils/carnet-format.util';

@Component({
  selector: 'app-carnet-card',
  templateUrl: './carnet-card.component.html',
  styleUrls: ['./carnet-card.component.scss'],
  standalone: true,
  imports: [IonIcon],
})
export class CarnetCardComponent {
  @Input({ required: true }) carnetData!: CarnetData;
  /** Sin sombra — útil para captura en lote. */
  @Input() flat = false;
  @ViewChild('carnetRoot') carnetRoot?: ElementRef<HTMLElement>;

  constructor() {
    addIcons({ personOutline });
  }

  formatFecha(fecha: string): string {
    return formatFechaCortaCarnet(fecha);
  }

  getCaptureElement(): HTMLElement | null {
    return this.carnetRoot?.nativeElement ?? null;
  }
}
