import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [IonButton],
  templateUrl: './signature-pad.component.html',
  styleUrl: './signature-pad.component.scss',
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private hasStroke = false;

  ngAfterViewInit(): void {
    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const data = this.hasStroke ? this.toDataUrl() : null;
    this.resizeCanvas();
    if (data) {
      this.loadFromDataUrl(data);
    }
  };

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(rect.width, 320);
    canvas.height = Math.max(rect.height, 160);

    this.ctx = canvas.getContext('2d')!;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#111';
  }

  startDraw(event: PointerEvent): void {
    event.preventDefault();
    this.drawing = true;
    this.hasStroke = true;
    const { x, y } = this.pointerPosition(event);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  draw(event: PointerEvent): void {
    if (!this.drawing) return;
    event.preventDefault();
    const { x, y } = this.pointerPosition(event);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  endDraw(): void {
    this.drawing = false;
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasStroke = false;
  }

  isEmpty(): boolean {
    return !this.hasStroke;
  }

  toDataUrl(): string {
    return this.canvasRef.nativeElement.toDataURL('image/png');
  }

  toBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvasRef.nativeElement.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('No se pudo generar la firma'));
        }
      }, 'image/png');
    });
  }

  loadFromDataUrl(dataUrl: string): void {
    const image = new Image();
    image.onload = () => {
      const canvas = this.canvasRef.nativeElement;
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      this.hasStroke = true;
    };
    image.src = dataUrl;
  }

  private pointerPosition(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
}
