import { Routes } from '@angular/router';
import {
  authGuard,
  adminGuard,
  adminMatchGuard,
  superAdminGuard,
  loginGuard,
} from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
    canActivate: [loginGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.page').then(
        (m) => m.ResetPasswordPage
      ),
  },
  {
    path: 'perfil/:token',
    loadComponent: () =>
      import('./pages/alumno-publico/alumno-publico.page').then(
        (m) => m.AlumnoPublicoPage
      ),
  },
  {
    path: 'seleccionar-academia',
    loadComponent: () =>
      import('./pages/seleccionar-academia/seleccionar-academia.page').then(
        (m) => m.SeleccionarAcademiaPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then(
            (m) => m.DashboardPage
          ),
      },
      {
        path: 'entrenadores',
        loadComponent: () =>
          import('./pages/entrenadores/entrenadores.page').then(
            (m) => m.EntrenadoresPage
          ),
        canActivate: [adminGuard],
        canMatch: [adminMatchGuard],
      },
      {
        path: 'academia',
        loadComponent: () =>
          import('./pages/academia/academia.page').then((m) => m.AcademiaPage),
        canActivate: [adminGuard],
        canMatch: [adminMatchGuard],
      },
      {
        path: 'alumnos',
        loadComponent: () =>
          import('./pages/alumnos/alumnos.page').then((m) => m.AlumnosPage),
      },
      {
        path: 'alumnos/nuevo',
        loadComponent: () =>
          import('./pages/alumnos/alumno-form/alumno-form.page').then(
            (m) => m.AlumnoFormPage
          ),
      },
      {
        path: 'alumnos/editar/:id',
        loadComponent: () =>
          import('./pages/alumnos/alumno-form/alumno-form.page').then(
            (m) => m.AlumnoFormPage
          ),
      },
      {
        path: 'alumnos/detalle/:id',
        loadComponent: () =>
          import('./pages/alumnos/alumno-detalle/alumno-detalle.page').then(
            (m) => m.AlumnoDetallePage
          ),
      },
      {
        path: 'alumnos/listado-print',
        loadComponent: () =>
          import('./pages/alumnos/alumnos-listado-print/alumnos-listado-print.page').then(
            (m) => m.AlumnosListadoPrintPage
          ),
      },
      {
        path: 'alumnos/carnet/:id',
        loadComponent: () =>
          import('./pages/alumnos/carnet/carnet.page').then(
            (m) => m.CarnetPage
          ),
      },
      {
        path: 'carnets',
        loadComponent: () =>
          import('./pages/carnets/carnets.page').then((m) => m.CarnetsPage),
      },
      {
        path: 'convocatorias',
        loadComponent: () =>
          import('./pages/convocatorias/convocatorias.page').then(
            (m) => m.ConvocatoriasPage
          ),
      },
      {
        path: 'convocatorias/nueva',
        loadComponent: () =>
          import('./pages/convocatorias/convocatoria-form/convocatoria-form.page').then(
            (m) => m.ConvocatoriaFormPage
          ),
      },
      {
        path: 'convocatorias/editar/:id',
        loadComponent: () =>
          import('./pages/convocatorias/convocatoria-form/convocatoria-form.page').then(
            (m) => m.ConvocatoriaFormPage
          ),
      },
      {
        path: 'convocatorias/:id/imprimir',
        loadComponent: () =>
          import('./pages/convocatorias/convocatoria-print/convocatoria-print.page').then(
            (m) => m.ConvocatoriaPrintPage
          ),
      },
      {
        path: 'asistencia',
        loadComponent: () =>
          import('./pages/asistencia/tomar-asistencia/tomar-asistencia.page').then(
            (m) => m.TomarAsistenciaPage
          ),
      },
    ],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent
      ),
    canActivate: [authGuard, superAdminGuard],
    children: [
      { path: '', redirectTo: 'academias', pathMatch: 'full' },
      {
        path: 'academias',
        loadComponent: () =>
          import('./pages/admin/academias/academias.page').then(
            (m) => m.AcademiasPage
          ),
      },
      {
        path: 'academias/nueva',
        loadComponent: () =>
          import('./pages/admin/academias/academia-form.page').then(
            (m) => m.AcademiaFormPage
          ),
      },
      {
        path: 'academias/editar/:id',
        loadComponent: () =>
          import('./pages/admin/academias/academia-form.page').then(
            (m) => m.AcademiaFormPage
          ),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/admin/usuarios/usuarios.page').then(
            (m) => m.UsuariosPage
          ),
      },
      {
        path: 'usuarios/nuevo',
        loadComponent: () =>
          import('./pages/admin/usuarios/usuario-form.page').then(
            (m) => m.UsuarioFormPage
          ),
      },
      {
        path: 'usuarios/editar/:id',
        loadComponent: () =>
          import('./pages/admin/usuarios/usuario-form.page').then(
            (m) => m.UsuarioFormPage
          ),
      },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
