import { Capacitor } from '@capacitor/core';
import {
  Component,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { IonIcon, IonSpinner, IonButton, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  downloadOutline,
  removeOutline,
  addOutline,
} from 'ionicons/icons';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [IonIcon, IonSpinner, IonButton],
  template: `
    <div class="pdf-viewer">
      @if (loading) {
        <div class="pdf-viewer__loading">
          <ion-spinner name="crescent"></ion-spinner>
          <span>Cargando documento...</span>
        </div>
      }

      @if (errorMessage) {
        <div class="pdf-viewer__error">
          <p>{{ errorMessage }}</p>
        </div>
      }

      @if (!loading && !errorMessage && pdfLoaded) {
        <div class="pdf-viewer__toolbar">
          <button
            class="pdf-btn"
            (click)="prevPage()"
            [disabled]="currentPage <= 1"
            aria-label="Página anterior"
          >
            <ion-icon name="chevron-back-outline"></ion-icon>
          </button>

          <span class="pdf-page-info">
            Pág. {{ currentPage }} de {{ totalPages }}
          </span>

          <button
            class="pdf-btn"
            (click)="nextPage()"
            [disabled]="currentPage >= totalPages"
            aria-label="Página siguiente"
          >
            <ion-icon name="chevron-forward-outline"></ion-icon>
          </button>

          <div class="pdf-zoom-group">
            <button class="pdf-btn" (click)="zoomOut()" aria-label="Alejar">
              <ion-icon name="remove-outline"></ion-icon>
            </button>
            <span class="pdf-zoom-level">{{ zoomPercent }}%</span>
            <button class="pdf-btn" (click)="zoomIn()" aria-label="Acercar">
              <ion-icon name="add-outline"></ion-icon>
            </button>
          </div>
        </div>

        <div class="pdf-viewer__canvas-wrapper" #canvasWrapper>
          <canvas #pdfCanvas class="pdf-viewer__canvas"></canvas>
        </div>

        <div class="pdf-viewer__actions">
          <ion-button expand="block" color="primary" (click)="downloadPdf()" [disabled]="descargando">
            @if (descargando) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <ion-icon name="download-outline" slot="start"></ion-icon>
              Descargar PDF
            }
          </ion-button>
        </div>
      }
    </div>
  `,
  styles: [
    `
    .pdf-viewer {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pdf-viewer__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 16px;
      color: var(--ion-color-medium);
      font-size: 0.9rem;
    }

    .pdf-viewer__error {
      padding: 24px 16px;
      text-align: center;
      color: var(--ion-color-danger);
      font-size: 0.9rem;
      background: rgba(var(--ion-color-danger-rgb), 0.06);
      border-radius: 8px;
    }

    .pdf-viewer__toolbar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px;
      background: var(--ion-color-light);
      border-radius: 8px;
      flex-wrap: wrap;
    }

    .pdf-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: 1px solid var(--ion-color-light-shade);
      border-radius: 8px;
      background: var(--ion-background-color);
      color: var(--ion-color-step-700);
      cursor: pointer;
      transition: all 0.12s;
      padding: 0;

      &:hover:not(:disabled) {
        background: rgba(var(--ion-color-primary-rgb), 0.08);
        border-color: var(--ion-color-primary);
        color: var(--ion-color-primary);
      }

      &:disabled {
        opacity: 0.35;
        cursor: default;
      }

      &:active:not(:disabled) {
        transform: scale(0.95);
      }

      ion-icon {
        font-size: 1.2rem;
      }
    }

    .pdf-page-info {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--ion-color-step-700);
      min-width: 90px;
      text-align: center;
    }

    .pdf-zoom-group {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: 4px;
      padding-left: 8px;
      border-left: 1px solid var(--ion-color-light-shade);
    }

    .pdf-zoom-level {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--ion-color-step-600);
      min-width: 42px;
      text-align: center;
    }

    .pdf-viewer__canvas-wrapper {
      display: flex;
      justify-content: flex-start;
      background: var(--ion-color-light-tint);
      border-radius: 8px;
      border: 1px solid var(--ion-color-light-shade);
      overflow: auto;
      min-height: 300px;
      max-height: 75vh;
    }

    .pdf-viewer__canvas {
      display: block;
      flex-shrink: 0;
    }

    .pdf-viewer__actions {
      margin-top: 4px;
    }
    `,
  ],
})
export class PdfViewerComponent implements OnInit, OnChanges, OnDestroy {
  private readonly toastCtrl = inject(ToastController);

  /** URL del PDF (signed URL de Supabase o cualquier URL accesible) */
  @Input() src: string | null | undefined = null;
  /** Nombre sugerido para la descarga */
  @Input() downloadName = 'documento';

  @ViewChild('pdfCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasWrapper', { static: false }) wrapperRef!: ElementRef<HTMLElement>;

  loading = false;
  errorMessage: string | null = null;
  pdfLoaded = false;
  descargando = false;

  currentPage = 1;
  totalPages = 0;
  zoom = 1.0;
  readonly MIN_ZOOM = 0.5;
  readonly MAX_ZOOM = 4.0;
  readonly ZOOM_STEP = 0.25;

  get zoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  private pdfDoc: PDFDocumentProxy | null = null;
  private abortController = new AbortController();

  private readonly isNative = Capacitor.isNativePlatform();

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      downloadOutline,
      removeOutline,
      addOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.src) {
      await this.loadPdf();
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['src'] && !changes['src'].firstChange) {
      this.destroyPdf();
      if (this.src) {
        await this.loadPdf();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyPdf();
    this.abortController.abort();
  }

  // ──────────────────────────────────────
  //  Navegación y zoom
  // ──────────────────────────────────────

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderPage();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.renderPage();
    }
  }

  zoomIn(): void {
    this.zoom = Math.min(this.zoom + this.ZOOM_STEP, this.MAX_ZOOM);
    this.renderPage();
  }

  zoomOut(): void {
    this.zoom = Math.max(this.zoom - this.ZOOM_STEP, this.MIN_ZOOM);
    this.renderPage();
  }

  // ──────────────────────────────────────
  //  Descarga
  // ──────────────────────────────────────

  async downloadPdf(): Promise<void> {
    if (!this.src || this.descargando) return;

    this.descargando = true;
    try {
      if (this.isNative) {
        await this.downloadNative();
      } else {
        await this.downloadWeb();
      }
    } catch (err: unknown) {
      const toast = await this.toastCtrl.create({
        message: `Error al descargar: ${(err as Error).message}`,
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.descargando = false;
    }
  }

  /**
   * Descarga en web: crea un anchor y hace click.
   */
  private async downloadWeb(): Promise<void> {
    const response = await fetch(this.src!);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.downloadName.endsWith('.pdf')
      ? this.downloadName
      : `${this.downloadName}.pdf`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Descarga en móvil: guarda en Documents (accesible desde gestor de archivos).
   * Si falla, abre en navegador como respaldo.
   */
  private async downloadNative(): Promise<void> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    const response = await fetch(this.src!);
    const blob = await response.blob();

    const base64 = await this.blobToBase64(blob);

    const fileName = this.downloadName.endsWith('.pdf')
      ? this.downloadName
      : `${this.downloadName}.pdf`;

    try {
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
      });

      const toast = await this.toastCtrl.create({
        message: `PDF guardado en Descargas: ${fileName}`,
        duration: 4000,
        color: 'success',
      });
      await toast.present();
    } catch {
      // Fallback: abrir en navegador para que el sistema maneje la descarga
      window.open(this.src!, '_blank');
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extraer solo el base64 (sin el prefijo "data:...;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(blob);
    });
  }

  // ──────────────────────────────────────
  //  Carga y renderizado
  // ──────────────────────────────────────

  private async loadPdf(): Promise<void> {
    if (!this.src) return;

    this.loading = true;
    this.errorMessage = null;
    this.pdfLoaded = false;

    try {
      const pdfjsLib = await this.loadPdfJs();
      const loadingTask = pdfjsLib.getDocument({
        url: this.src,
        useSystemFonts: true,
      });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;
      this.pdfLoaded = true;
      this.loading = false;

      // Esperar al siguiente ciclo para que los viewChild estén listos
      setTimeout(() => {
        this.renderPage();
      }, 50);
    } catch (err: unknown) {
      this.loading = false;
      this.errorMessage = 'No se pudo cargar el documento PDF.';
      console.error('Error loading PDF:', err);
    }
  }

  private async renderPage(): Promise<void> {
    if (!this.pdfDoc || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    if (!canvas) return;

    try {
      const page: PDFPageProxy = await this.pdfDoc.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: this.zoom });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    }
  }

  private async loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    return pdfjsLib;
  }

  private destroyPdf(): void {
    if (this.pdfDoc) {
      try {
        this.pdfDoc.destroy();
      } catch {
        // ignore
      }
      this.pdfDoc = null;
    }
    this.pdfLoaded = false;
    this.totalPages = 0;
    this.currentPage = 1;
    this.zoom = 1.0;
  }
}
