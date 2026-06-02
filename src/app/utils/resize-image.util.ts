/**
 * Redimensiona una imagen File a un ancho máximo (manteniendo aspect ratio)
 * usando canvas. Devuelve un Blob listo para subir.
 */
export function resizeImage(
  file: File,
  maxWidth: number,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('No es una imagen'));
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Si ya es más pequeña que el máximo, devolver el original
      if (img.width <= maxWidth && img.height <= maxWidth) {
        resolve(file);
        return;
      }

      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      const width = Math.round(img.width * ratio);
      const height = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto canvas'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback: devolver original si canvas.toBlob falla
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = URL.createObjectURL(file);
  });
}
