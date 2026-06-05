import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  from,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { StorageService } from './storage.service';
import { UserProfile } from '../interfaces/user-profile.interface';
import { Entrenador } from '../interfaces/entrenador.interface';
import { AcademiaContextService } from './academia-context.service';

const PROFILE_CACHE_KEY = 'auth_profile_cache';
/** Prefijo usado por Supabase para claves de sesión en el storage personalizado */
const SB_STORAGE_PREFIX = 'sb-';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly academiaContext = inject(AcademiaContextService);
  private readonly storageService = inject(StorageService);

  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(
    null
  );
  private readonly profileSignal = signal<UserProfile | null>(null);
  /** Incrementa al cambiar o limpiar sesión; invalida peticiones de listas en curso. */
  private dataEpoch = 0;
  /** Flag para evitar que onAuthStateChange sobreescriba una carga de perfil en curso */
  private isLoadingProfile = false;

  readonly profile$ = this.profileSubject.asObservable();
  readonly isAuthenticated = signal(false);
  readonly isAdmin = computed(() => {
    const rol = this.profileSignal()?.rol;
    return rol === 'admin';
  });
  readonly isSuperAdmin = computed(
    () => this.profileSignal()?.rol === 'super_admin'
  );
  readonly isAdminOrSuperAdmin = computed(() => {
    const rol = this.profileSignal()?.rol;
    return rol === 'admin' || rol === 'super_admin';
  });
  readonly categoriasAsignadas = computed(
    () => this.profileSignal()?.categorias_asignadas ?? []
  );
  readonly academiaId = computed(
    () => this.profileSignal()?.academia_id ?? null
  );

  readonly categoriasLabel = computed(() => {
    const cats = this.categoriasAsignadas();
    return cats.length > 0 ? cats.join(', ') : null;
  });

  constructor() {
    this.initSession();
  }

  get currentProfile(): UserProfile | null {
    return this.profileSignal();
  }

  getDataEpoch(): number {
    return this.dataEpoch;
  }

  /**
   * Filtro de categoría para listados.
   * - `null` → admin (sin filtro)
   * - `string[]` → coach (sus categorías; vacío = sin acceso)
   * - `undefined` → perfil no listo (no consultar aún)
   */
  getListCategoriaFilter(): string[] | null | undefined {
    const profile = this.currentProfile;
    if (!profile) {
      return undefined;
    }
    if (profile.rol === 'admin' || profile.rol === 'super_admin') {
      return null;
    }
    return profile.categorias_asignadas ?? [];
  }

  private initSession(): void {
    // Obtener sesión inicial
    this.supabaseService.supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        this.handleSession(data.session);
      }
    });

    // Suscribirse a cambios de auth
    this.supabaseService.supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          // Solo manejar si no hay una carga de perfil en curso
          if (!this.isLoadingProfile) {
            this.handleSession(session);
          }
        } else {
          this.clearProfile();
        }
      }
    );
  }

  private handleSession(session: Session): void {
    const current = this.profileSubject.value;
    if (current?.id === session.user.id) {
      return;
    }

    // Si el usuario cambió (diferente al actual), limpiar todo primero
    if (current) {
      this.clearProfile();
    }

    // Intentar restaurar perfil desde caché antes de consultar BD
    this.restoreProfileFromCache(session.user.id).then((cached) => {
      if (cached) {
        this.applyProfile(cached);
        return;
      }
      this.isLoadingProfile = true;
      this.loadProfile(session.user).subscribe({
        complete: () => {
          this.isLoadingProfile = false;
        },
        error: () => {
          this.isLoadingProfile = false;
        },
      });
    });
  }

  login(email: string, password: string): Observable<UserProfile> {
    this.isLoadingProfile = true;
    return from(
      this.supabaseService.supabase.auth.signInWithPassword({ email, password })
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data.user) throw new Error('No se pudo iniciar sesión');
        return this.loadProfile(data.user);
      }),
      tap({
        complete: () => {
          this.isLoadingProfile = false;
        },
        error: () => {
          this.isLoadingProfile = false;
        },
      })
    );
  }

  logout(): Observable<void> {
    return from(this.supabaseService.supabase.auth.signOut()).pipe(
      tap(async () => {
        this.clearProfile();
        // Limpiar todas las claves de sesión de Supabase del storage
        await this.clearSupabaseSessionStorage();
        // Navegar con replaceUrl para que no se pueda volver atrás
        await this.router.navigate(['/login'], { replaceUrl: true });
      }),
      map(() => undefined)
    );
  }

  /**
   * Refresca la sesión actual. Se llama al reabrir la app (app resume).
   * Si el token expiró, redirige al login.
   */
  async refreshSession(): Promise<void> {
    try {
      const { data, error } =
        await this.supabaseService.supabase.auth.refreshSession();
      if (error || !data.session) {
        await this.handleSessionExpired();
        return;
      }
      // Verificar que el perfil corresponde a la sesión
      const profileId = this.profileSubject.value?.id;
      if (profileId !== data.session.user.id) {
        // El usuario cambió mientras la app estaba en background
        this.clearProfile();
        this.handleSession(data.session);
      }
    } catch {
      await this.handleSessionExpired();
    }
  }

  private async handleSessionExpired(): Promise<void> {
    await this.clearSupabaseSessionStorage();
    this.clearProfile();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }

  /**
   * Limpia todas las claves de Supabase del storage.
   */
  private async clearSupabaseSessionStorage(): Promise<void> {
    try {
      const allKeys = await this.storageService.keys();
      for (const key of allKeys) {
        if (key.startsWith(SB_STORAGE_PREFIX)) {
          await this.storageService.remove(key);
        }
      }
    } catch {
      // Si falla, continuar
    }
  }

  /**
   * Carga el perfil consultando super_admins y entrenadores EN PARALELO
   * en lugar de secuencialmente, reduciendo el tiempo de login a la mitad.
   */
  loadProfile(user: User): Observable<UserProfile> {
    // Consultar super_admins y entrenadores en paralelo
    return from(
      Promise.all([
        this.supabaseService.supabase
          .from('super_admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle(),
        this.supabaseService.supabase
          .from('entrenadores')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
      ])
    ).pipe(
      switchMap(([{ data: superData }, { data: entData, error: entError }]) => {
        if (superData) {
          // Es super_admin
          const profile: UserProfile = {
            id: user.id,
            email: user.email ?? '',
            nombre: user.email?.split('@')[0] ?? 'Super Admin',
            rol: 'super_admin',
            categorias_asignadas: [],
            academia_id: null,
          };
          return this.finalizeProfile(profile);
        }

        if (!entError && entData) {
          const e = entData as Entrenador;
          return this.finalizeProfile({
            id: e.id,
            email: user.email ?? e.correo,
            nombre: e.nombre,
            rol: e.rol,
            categorias_asignadas: e.categorias_asignadas ?? [],
            academia_id: e.academia_id,
          });
        }

        // Sin perfil: verificar si es el primer usuario del sistema (bootstrap)
        return from(this.bootstrapFirstUser(user));
      })
    );
  }

  private applyProfile(profile: UserProfile): Observable<UserProfile> {
    const previousId = this.profileSubject.value?.id;
    this.profileSignal.set(profile);
    this.isAuthenticated.set(true);
    if (previousId !== profile.id) {
      this.bumpDataEpoch();
    }
    this.profileSubject.next(profile);

    // Cargar academias disponibles
    this.academiaContext.loadAcademias(profile);

    return of(profile);
  }

  private finalizeProfile(profile: UserProfile): Observable<UserProfile> {
    // Persistir perfil en storage para recargas rápidas
    this.persistProfileToCache(profile);

    return this.applyProfile(profile);
  }

  waitForProfile(): Observable<UserProfile | null> {
    if (this.profileSubject.value) {
      return of(this.profileSubject.value);
    }
    return this.profile$.pipe(
      switchMap((profile) => (profile ? of(profile) : of(null)))
    );
  }

  private clearProfile(): void {
    this.profileSignal.set(null);
    this.isAuthenticated.set(false);
    this.bumpDataEpoch();
    this.profileSubject.next(null);
    this.academiaContext.clear();
    this.clearProfileCache();
  }

  private bumpDataEpoch(): void {
    this.dataEpoch += 1;
  }

  private async bootstrapFirstUser(user: User): Promise<UserProfile> {
    // Verificar si es el primer usuario del sistema
    const [superResult, entResult] = await Promise.all([
      this.supabaseService.supabase
        .from('super_admins')
        .select('id', { count: 'exact', head: true }),
      this.supabaseService.supabase
        .from('entrenadores')
        .select('id', { count: 'exact', head: true }),
    ]);

    const total =
      (superResult.count ?? 0) + (entResult.count ?? 0);

    if (total > 0) {
      throw new Error(
        'Perfil de usuario no encontrado. Contacta al administrador.'
      );
    }

    // Primer usuario: crear super_admin
    const { error } = await this.supabaseService.supabase
      .from('super_admins')
      .insert({ id: user.id });

    if (error) {
      throw (
        error ?? new Error('No se pudo crear el super administrador inicial')
      );
    }

    const profile: UserProfile = {
      id: user.id,
      email: user.email ?? '',
      nombre: user.email?.split('@')[0] ?? 'Super Admin',
      rol: 'super_admin',
      categorias_asignadas: [],
      academia_id: null,
    };

    return profile;
  }

  // ---- Caché de perfil en Capacitor Preferences / localStorage ----

  private async persistProfileToCache(profile: UserProfile): Promise<void> {
    try {
      const cache = {
        profile,
        savedAt: Date.now(),
      };
      await this.storageService.set(PROFILE_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Storage no disponible o lleno
    }
  }

  private async restoreProfileFromCache(userId: string): Promise<UserProfile | null> {
    try {
      const raw = await this.storageService.get(PROFILE_CACHE_KEY);
      if (!raw) return null;

      const cache = JSON.parse(raw) as {
        profile: UserProfile;
        savedAt: number;
      };

      // El caché expira después de 1 hora
      if (Date.now() - cache.savedAt > 3600_000) {
        await this.storageService.remove(PROFILE_CACHE_KEY);
        return null;
      }

      if (cache.profile?.id !== userId) {
        return null;
      }

      return cache.profile;
    } catch {
      return null;
    }
  }

  private async clearProfileCache(): Promise<void> {
    try {
      await this.storageService.remove(PROFILE_CACHE_KEY);
    } catch {
      // Storage no disponible
    }
  }
}
