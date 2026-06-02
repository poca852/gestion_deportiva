import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  CanMatchFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { catchError, from, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
import { AcademiaContextService } from '../services/academia-context.service';

export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const supabaseService = inject(SupabaseService);
  const academiaContext = inject(AcademiaContextService);
  const router = inject(Router);

  return from(supabaseService.supabase.auth.getSession()).pipe(
    switchMap(({ data }) => {
      if (!data.session) {
        return of(router.createUrlTree(['/login']));
      }

      if (authService.currentProfile?.id === data.session.user.id) {
        // Perfil ya cargado
        if (authService.isSuperAdmin()) {
          // Super-admin solo accede a rutas /admin
          if (!state.url.startsWith('/admin')) {
            return of(router.createUrlTree(['/admin/academias']));
          }
          return of(true);
        }

        // Admin/coach necesita academia seleccionada
        if (!academiaContext.hasAcademia()) {
          return from(academiaContext.autoSelectAcademia()).pipe(
            map((selected) => {
              if (!selected && academiaContext.academiasDisponibles().length > 0) {
                return router.createUrlTree(['/seleccionar-academia']);
              }
              return true as const;
            })
          );
        }
        return of(true);
      }

      // Perfil no cargado aún: cargar
      return authService.loadProfile(data.session.user).pipe(
        switchMap((profile) => {
          if (profile.rol === 'super_admin') {
            // Super-admin solo accede a /admin
            if (!state.url.startsWith('/admin')) {
              return of(router.createUrlTree(['/admin/academias']));
            }
            return of(true);
          }

          // Admin/coach: auto-seleccionar academia si tiene una sola
          return from(academiaContext.autoSelectAcademia()).pipe(
            map(() => true as const)
          );
        }),
        catchError(() => {
          // Si falla la carga del perfil, cerrar sesión e ir a login
          supabaseService.supabase.auth.signOut();
          return of(router.createUrlTree(['/login']));
        })
      );
    })
  );
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  return from(supabaseService.supabase.auth.getSession()).pipe(
    switchMap(({ data }) => {
      if (!data.session) {
        return of(router.createUrlTree(['/login']));
      }

      const profile = authService.currentProfile;
      if (profile?.id === data.session.user.id) {
        return of(
          profile.rol === 'admin' || profile.rol === 'super_admin'
            ? true
            : router.createUrlTree(['/app/dashboard'])
        );
      }

      return authService.loadProfile(data.session.user).pipe(
        map((loadedProfile) =>
          loadedProfile.rol === 'admin' || loadedProfile.rol === 'super_admin'
            ? true
            : router.createUrlTree(['/app/dashboard'])
        ),
        catchError(() => of(router.createUrlTree(['/app/dashboard'])))
      );
    })
  );
};

export const superAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  return from(supabaseService.supabase.auth.getSession()).pipe(
    switchMap(({ data }) => {
      if (!data.session) {
        return of(router.createUrlTree(['/login']));
      }

      const profile = authService.currentProfile;
      if (profile?.id === data.session.user.id) {
        return of(
          profile.rol === 'super_admin'
            ? true
            : router.createUrlTree(['/app/dashboard'])
        );
      }

      return authService.loadProfile(data.session.user).pipe(
        map((loadedProfile) =>
          loadedProfile.rol === 'super_admin'
            ? true
            : router.createUrlTree(['/app/dashboard'])
        ),
        catchError(() => of(router.createUrlTree(['/app/dashboard'])))
      );
    })
  );
};

export const adminMatchGuard: CanMatchFn = () => {
  const authService = inject(AuthService);

  return authService.isAdminOrSuperAdmin();
};

export const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  return from(supabaseService.supabase.auth.getSession()).pipe(
    switchMap(({ data }) => {
      if (!data.session) {
        return of(true);
      }

      if (authService.currentProfile?.id === data.session.user.id) {
        const target = authService.isSuperAdmin()
          ? router.createUrlTree(['/admin/academias'])
          : router.createUrlTree(['/app/dashboard']);
        return of(target);
      }

      return authService.loadProfile(data.session.user).pipe(
        map((profile) => {
          const target =
            profile.rol === 'super_admin'
              ? router.createUrlTree(['/admin/academias'])
              : router.createUrlTree(['/app/dashboard']);
          return target;
        }),
        catchError(() => of(true))
      );
    })
  );
};
