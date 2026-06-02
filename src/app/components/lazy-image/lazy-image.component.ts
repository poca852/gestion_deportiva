import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { imageOutline } from 'ionicons/icons';

@Component({
  selector: 'app-lazy-image',
  standalone: true,
  imports: [IonSpinner, IonIcon],
  templateUrl: './lazy-image.component.html',
  styleUrl: './lazy-image.component.scss',
})
export class LazyImageComponent implements OnChanges {
  @Input() src: string | null | undefined = null;
  @Input() alt = '';
  @Input() loading = false;
  @Input() objectFit: 'cover' | 'contain' = 'cover';
  /** Fondo claro para PNG/JPG con transparencia sobre contenedores oscuros. */
  @Input() lightBackground = false;
  /**
   * Indica que el componente tiene contenido personalizado proyectado
   * vía <ng-content>. Debe ser true cuando el consumidor provee
   * contenido entre las etiquetas <app-lazy-image>...</app-lazy-image>.
   */
  @Input() hasCustomFallback = false;
  /** Emitido cuando la imagen falla al cargar. */
  @Output() imgErrorEvent = new EventEmitter<void>();

  imgLoaded = false;
  imgError = false;

  get showSkeleton(): boolean {
    return this.loading || (!!this.src && !this.imgLoaded && !this.imgError);
  }

  get showFallback(): boolean {
    return !this.loading && (!this.src || this.imgError);
  }

  constructor() {
    addIcons({ imageOutline });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src']) {
      this.imgLoaded = false;
      this.imgError = false;
    }
  }

  onImgLoad(): void {
    this.imgLoaded = true;
  }

  onImgError(): void {
    this.imgError = true;
    this.imgErrorEvent.emit();
  }
}
