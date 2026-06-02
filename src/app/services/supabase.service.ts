import { Injectable, Injector, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { resizeImage } from '../utils/resize-image.util';
import { AcademiaContextService } from './academia-context.service';

const EXPEDIENTES_BUCKET = 'expedientes-academia';
const SIGNED_URL_TTL_SEC = 60 * 60;

export type ExpedienteFolder =
  | 'fotos-estudiante'
  | 'documentos'
  | 'documentos-padre'
  | 'logos-academia'
  | 'sellos-academia'
  | 'firmas-convocatoria';

/** Número máximo de reintentos para uploads */
const MAX_UPLOAD_RETRIES = 3;
/** Espera inicial para backoff exponencial (ms) */
const INITIAL_RETRY_DELAY = 500;

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly injector = inject(Injector);

  /** Prefijo para claves en sessionStorage */
  private static readonly CACHE_KEY = 'supabase_url_cache';

  /** Cache en memoria de URLs resueltas (path -> { url, expiresAt }) */
  private urlCache = new Map<
    string,
    { url: string; expiresAt: number }
  >();

  /** Último academiaId registrado para invalidar caché al cambiar */
  private lastAcademiaId: string | null = null;

  /** Referencia lazy a AcademiaContextService para evitar dependencia circular */
  private _academiaContext: AcademiaContextService | null = null;
  private get academiaContext(): AcademiaContextService {
    if (!this._academiaContext) {
      this._academiaContext = this.injector.get(AcademiaContextService);
    }
    return this._academiaContext;
  }

  constructor() {
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
    this.restoreCache();
  }

  /**
   * Limpia toda la caché de URLs. Debe llamarse al cambiar de academia
   * para evitar servir URLs de la academia anterior.
   */
  clearCache(): void {
    this.urlCache.clear();
    this.lastAcademiaId = null;
    try {
      sessionStorage.removeItem(SupabaseService.CACHE_KEY);
    } catch {
      // sessionStorage no disponible
    }
  }

  /**
   * Verifica si la academia activa cambió y limpia la caché en ese caso.
   */
  private checkAcademiaChanged(): void {
    const currentId = this.academiaContext.academiaId();
    if (currentId !== this.lastAcademiaId) {
      this.clearCache();
      this.lastAcademiaId = currentId;
    }
  }

  /**
   * Prefijo de storage basado en la academia activa.
   * Ejemplo: "uuid-de-academia/"
   */
  private get storagePrefix(): string {
    const academiaId = this.academiaContext.academiaId();
    if (!academiaId) {
      return '';
    }
    return `${academiaId}/`;
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = MAX_UPLOAD_RETRIES
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        const isTransient = this.isTransientError(err);
        if (!isTransient || attempt >= maxRetries) {
          throw err;
        }
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  private isTransientError(err: unknown): boolean {
    const msg = String(err);
    if (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('Timeout') ||
      msg.includes('abort') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ERR_CONNECTION') ||
      msg.includes('The resource')  // Error genérico de storage (puede ser temporal)
    ) {
      return true;
    }
    if (msg.includes('5') && (msg.includes('0') || msg.includes('00'))) {
      return true;
    }
    if (msg.includes('storage') && (msg.includes('upload') || msg.includes('download') || msg.includes('sign'))) {
      return true;
    }
    return false;
  }

  private restoreCache(): void {
    try {
      const raw = sessionStorage.getItem(SupabaseService.CACHE_KEY);
      if (raw) {
        const entries = JSON.parse(raw) as [string, { url: string; expiresAt: number }][];
        for (const [key, value] of entries) {
          if (Date.now() < value.expiresAt) {
            this.urlCache.set(key, value);
          }
        }
      }
    } catch {
      // sessionStorage no disponible o datos corruptos
    }
  }

  private persistCache(): void {
    try {
      const entries = [...this.urlCache.entries()];
      sessionStorage.setItem(SupabaseService.CACHE_KEY, JSON.stringify(entries));
    } catch {
      // sessionStorage lleno o no disponible
    }
  }

  get supabase(): SupabaseClient {
    return this.client;
  }

  async uploadExpediente(
    file: File,
    folder: ExpedienteFolder
  ): Promise<string> {
    return this.uploadFile(file, folder);
  }

  async uploadFile(file: File, folder: ExpedienteFolder): Promise<string> {
    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `${this.storagePrefix}${folder}/${crypto.randomUUID()}.${extension}`;

    const { error } = await this.client.storage
      .from(EXPEDIENTES_BUCKET)
      .upload(path, file, { upsert: false });

    if (error) {
      throw error;
    }

    return path;
  }

  async uploadAlumnoExpediente(
    file: File,
    folder: 'fotos-estudiante' | 'documentos' | 'documentos-padre',
    alumnoId: string,
    previousStored: string | null | undefined
  ): Promise<string> {
    const extension =
      folder === 'documentos' || folder === 'documentos-padre'
        ? this.documentoExtension(file)
        : 'jpg';

    let uploadFile: File | Blob = file;
    if (folder === 'fotos-estudiante') {
      try {
        const resized = await resizeImage(file, 640, 0.8);
        uploadFile = resized;
      } catch {
        uploadFile = file;
      }
    }

    const path = `${this.storagePrefix}${folder}/${alumnoId}.${extension}`;
    const previousPath = previousStored
      ? this.extractStoragePath(previousStored)
      : null;

    if (previousPath && previousPath !== path) {
      await this.removeExpedientePaths([previousPath]);
    }

    const contentType =
      file.type ||
      (extension === 'pdf' ? 'application/pdf' : `image/${extension}`);

    await this.withRetry(async () => {
      const { error } = await this.client.storage
        .from(EXPEDIENTES_BUCKET)
        .upload(path, uploadFile, { upsert: true, contentType });

      if (error) {
        throw error;
      }
    });

    this.urlCache.delete(path);
    this.persistCache();

    return path;
  }

  async removeExpedientesByStored(
    ...stored: (string | null | undefined)[]
  ): Promise<void> {
    const paths = stored
      .map((value) => (value ? this.extractStoragePath(value) : null))
      .filter((path): path is string => !!path);

    await this.removeExpedientePaths(paths);
  }

  async uploadAcademiaLogo(
    file: File,
    previousStored: string | null | undefined
  ): Promise<string> {
    const extension = this.imageExtension(file);
    const path = `${this.storagePrefix}logos-academia/academia-logo.${extension}`;
    const previousPath = previousStored
      ? this.extractStoragePath(previousStored)
      : null;

    if (previousPath && previousPath !== path) {
      await this.client.storage.from(EXPEDIENTES_BUCKET).remove([previousPath]);
    }

    await this.withRetry(async () => {
      const { error } = await this.client.storage
        .from(EXPEDIENTES_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || `image/${extension}`,
        });

      if (error) {
        throw error;
      }
    });

    return path;
  }

  async uploadAcademiaSello(
    file: File,
    previousStored: string | null | undefined
  ): Promise<string> {
    if (file.type !== 'image/png') {
      throw new Error('El sello debe ser un archivo PNG.');
    }

    const path = `${this.storagePrefix}sellos-academia/academia-sello.png`;
    const previousPath = previousStored
      ? this.extractStoragePath(previousStored)
      : null;

    if (previousPath && previousPath !== path) {
      await this.client.storage.from(EXPEDIENTES_BUCKET).remove([previousPath]);
    }

    await this.withRetry(async () => {
      const { error } = await this.client.storage
        .from(EXPEDIENTES_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: 'image/png',
        });

      if (error) {
        throw error;
      }
    });

    return path;
  }

  async uploadAlumnoFirma(
    alumnoId: string,
    blob: Blob,
    previousStored: string | null | undefined
  ): Promise<string> {
    const path = `${this.storagePrefix}firmas-alumno/${alumnoId}.png`;
    const previousPath = previousStored
      ? this.extractStoragePath(previousStored)
      : null;

    if (previousPath && previousPath !== path) {
      await this.client.storage.from(EXPEDIENTES_BUCKET).remove([previousPath]);
    }

    const { error } = await this.client.storage
      .from(EXPEDIENTES_BUCKET)
      .upload(path, blob, {
        upsert: true,
        contentType: 'image/png',
      });

    if (error) {
      throw error;
    }

    return path;
  }

  async uploadConvocatoriaFirma(
    convocatoriaId: string,
    blob: Blob,
    previousStored: string | null | undefined
  ): Promise<string> {
    const path = `${this.storagePrefix}firmas-convocatoria/${convocatoriaId}.png`;
    const previousPath = previousStored
      ? this.extractStoragePath(previousStored)
      : null;

    if (previousPath && previousPath !== path) {
      await this.client.storage.from(EXPEDIENTES_BUCKET).remove([previousPath]);
    }

    const { error } = await this.client.storage
      .from(EXPEDIENTES_BUCKET)
      .upload(path, blob, {
        upsert: true,
        contentType: 'image/png',
      });

    if (error) {
      throw error;
    }

    return path;
  }

  async resolveFileUrl(
    stored: string | null | undefined,
    cacheBust = false
  ): Promise<string | null> {
    if (!stored) {
      return null;
    }

    const path = this.extractStoragePath(stored);
    if (!path) {
      return stored.startsWith('http') ? stored : null;
    }

    // Invalidar caché si cambió la academia activa
    this.checkAcademiaChanged();

    if (!cacheBust) {
      const cached = this.urlCache.get(path);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.url;
      }
    }

    const signedUrlResult = await this.withRetry(async () => {
      const result = await this.client.storage
        .from(EXPEDIENTES_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC);
      if (result.error) throw result.error;
      return result.data as { signedUrl: string } | null;
    });

    if (signedUrlResult?.signedUrl) {
      let signedUrl = signedUrlResult.signedUrl;

      if (cacheBust) {
        const separator = signedUrl.includes('?') ? '&' : '?';
        signedUrl = `${signedUrl}${separator}v=${Date.now()}`;
      } else {
        this.urlCache.set(path, {
          url: signedUrl,
          expiresAt: Date.now() + (SIGNED_URL_TTL_SEC - 5 * 60) * 1000,
        });
        this.persistCache();
      }

      return signedUrl;
    }

    // Fallback: descargar como blob y crear objectURL con reintentos
    const { data: blob } = await this.withRetry(async () => {
      const result = await this.client.storage
        .from(EXPEDIENTES_BUCKET)
        .download(path);
      if (result.error) throw result.error;
      return result;
    });

    if (!blob) {
      return null;
    }

    return URL.createObjectURL(blob);
  }

  async resolveFileAsDataUrl(
    stored: string | null | undefined
  ): Promise<string | null> {
    const path = stored ? this.extractStoragePath(stored) : null;
    if (!path) {
      return null;
    }

    const { data } = await this.withRetry(async () => {
      const result = await this.client.storage
        .from(EXPEDIENTES_BUCKET)
        .download(path);
      if (result.error) throw result.error;
      return result;
    });

    if (!data) {
      return null;
    }

    return this.blobToDataUrl(data);
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(blob);
    });
  }

  async removeExpedientePaths(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }

    const { error } = await this.client.storage
      .from(EXPEDIENTES_BUCKET)
      .remove(paths);

    if (error) {
      throw error;
    }
  }

  private documentoExtension(file: File): string {
    const fromName = file.name.split('.').pop()?.toLowerCase();
    if (fromName === 'pdf') {
      return 'pdf';
    }
    if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
      return fromName === 'jpeg' ? 'jpg' : fromName;
    }
    if (file.type === 'application/pdf') {
      return 'pdf';
    }
    return this.imageExtension(file);
  }

  private imageExtension(file: File): string {
    const fromName = file.name.split('.').pop()?.toLowerCase();
    if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
      return fromName === 'jpeg' ? 'jpg' : fromName;
    }
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/gif') return 'gif';
    return 'jpg';
  }

  isPdfStored(stored: string | null | undefined): boolean {
    const path = stored ? this.extractStoragePath(stored) : null;
    const value = (path ?? stored ?? '').toLowerCase();
    return value.endsWith('.pdf');
  }

  async downloadExpediente(
    stored: string | null | undefined,
    downloadName?: string
  ): Promise<void> {
    const path = stored ? this.extractStoragePath(stored) : null;
    if (!path) {
      throw new Error('No hay archivo para descargar');
    }

    const { data, error } = await this.client.storage
      .from(EXPEDIENTES_BUCKET)
      .download(path);

    if (error || !data) {
      throw error ?? new Error('No se pudo descargar el archivo');
    }

    const filename =
      downloadName?.trim() || path.split('/').pop() || 'documento';
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  extractStoragePath(stored: string): string | null {
    const value = stored.trim();
    if (!value) {
      return null;
    }

    if (value.startsWith('http')) {
      const publicMarker = '/object/public/expedientes-academia/';
      const publicIdx = value.indexOf(publicMarker);
      if (publicIdx >= 0) {
        return value.slice(publicIdx + publicMarker.length).split('?')[0];
      }

      const signedMarker = '/object/sign/expedientes-academia/';
      const signedIdx = value.indexOf(signedMarker);
      if (signedIdx >= 0) {
        return value.slice(signedIdx + signedMarker.length).split('?')[0];
      }

      const bucketMarker = '/expedientes-academia/';
      const bucketIdx = value.indexOf(bucketMarker);
      if (bucketIdx >= 0) {
        return value.slice(bucketIdx + bucketMarker.length).split('?')[0];
      }

      return null;
    }

    const bucketPrefix = `${EXPEDIENTES_BUCKET}/`;
    if (value.startsWith(bucketPrefix)) {
      return value.slice(bucketPrefix.length).split('?')[0];
    }

    return value.split('?')[0];
  }
}
