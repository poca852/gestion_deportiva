import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AlumnoPublicProfile,
  AlumnoPublicProfileResponse,
} from '../interfaces/alumno-publico.interface';

@Injectable({
  providedIn: 'root',
})
export class PublicAlumnoService {
  getProfileByToken(token: string): Observable<AlumnoPublicProfile> {
    return from(this.fetchProfile(token));
  }

  buildPublicProfileUrl(publicToken: string): string {
    const base = environment.siteUrl.replace(/\/$/, '');
    return `${base}/perfil/${publicToken}`;
  }

  private async fetchProfile(token: string): Promise<AlumnoPublicProfile> {
    const url = new URL(
      `${environment.supabaseUrl}/functions/v1/get-public-alumno-profile`
    );
    url.searchParams.set('token', token);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        apikey: environment.supabaseAnonKey,
        Authorization: `Bearer ${environment.supabaseAnonKey}`,
      },
    });

    const body = (await response.json()) as
      | AlumnoPublicProfileResponse
      | { error?: string };

    if (!response.ok) {
      const message =
        'error' in body && body.error
          ? body.error
          : 'No se pudo cargar el perfil';
      throw new Error(message);
    }

    if (!('data' in body) || !body.data) {
      throw new Error('Respuesta inválida del servidor');
    }

    return body.data;
  }
}
