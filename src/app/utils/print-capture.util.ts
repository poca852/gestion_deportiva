import html2canvas from 'html2canvas';
import {
  PRINT_CAPTURE_SCALE,
  PRINT_DOCUMENT_CAPTURE_WIDTH_PX,
} from '../constants/print.constants';

const EXPORT_CLASS = 'print-document--export';

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

function applyExportLayout(element: HTMLElement, captureWidthPx: number): void {
  element.classList.add(EXPORT_CLASS);
  element.style.boxSizing = 'border-box';
  element.style.width = `${captureWidthPx}px`;
  element.style.minWidth = `${captureWidthPx}px`;
  element.style.maxWidth = `${captureWidthPx}px`;
  element.style.containerType = 'normal';
  element.style.margin = '0';
}

/**
 * Captura un documento de impresión con ancho fijo (A4) aunque el viewport sea móvil.
 * Clona el nodo fuera de ion-content para que html2canvas no herede restricciones de ancho.
 */
export async function capturePrintDocument(
  element: HTMLElement,
  yieldToUi: () => Promise<void> = async () => undefined
): Promise<HTMLCanvasElement> {
  const captureWidthPx = PRINT_DOCUMENT_CAPTURE_WIDTH_PX;

  await yieldToUi();

  const stagingRoot = document.createElement('div');
  stagingRoot.setAttribute('aria-hidden', 'true');
  stagingRoot.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    'width: 0',
    'height: 0',
    'overflow: hidden',
    'pointer-events: none',
    'opacity: 0',
    'z-index: -1',
  ].join(';');

  const stagingSurface = document.createElement('div');
  stagingSurface.style.cssText = [
    `width: ${captureWidthPx}px`,
    'background: #ffffff',
    'overflow: visible',
  ].join(';');

  const staged = element.cloneNode(true) as HTMLElement;
  applyExportLayout(staged, captureWidthPx);

  stagingSurface.appendChild(staged);
  stagingRoot.appendChild(stagingSurface);
  document.body.appendChild(stagingRoot);

  await waitForImages(staged);
  await yieldToUi();

  const captureHeightPx = Math.ceil(staged.scrollHeight);

  try {
    return await html2canvas(staged, {
      scale: PRINT_CAPTURE_SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: captureWidthPx,
      height: captureHeightPx,
      windowWidth: captureWidthPx,
      windowHeight: captureHeightPx,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });
  } finally {
    document.body.removeChild(stagingRoot);
  }
}
