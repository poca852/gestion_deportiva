import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bulbOutline,
  cameraOutline,
  checkmarkOutline,
  cloudUploadOutline,
  documentOutline,
  documentTextOutline,
  openOutline,
  peopleOutline,
  personAddOutline,
  personOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { LazyImageComponent } from '../../../components/lazy-image/lazy-image.component';
import { GeneroAlumno, NivelAlumno } from '../../../interfaces/alumno.interface';
import { AlumnosService } from '../../../services/alumnos.service';
import { AuthService } from '../../../services/auth.service';
import { CategoriaService, CATEGORIAS } from '../../../services/categoria.service';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-alumno-form',
  templateUrl: './alumno-form.page.html',
  styleUrls: ['./alumno-form.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    IonNote,
    IonIcon,
    LazyImageComponent,
  ],
})
export class AlumnoFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alumnosService = inject(AlumnosService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  alumnoId: string | null = null;
  /** Guarda el updated_at original para optimistic locking */
  private alumnoUpdatedAt: string | null = null;
  saving = false;
  loadingAlumno = false;
  loadingFotoEstudiante = false;
  loadingFotoDocumento = false;
  loadingFotoDocumentoPadre = false;
  categorias: string[] = [...CATEGORIAS];
  categoriaRecomendada = '';
  tallasCamiseta = ['6', '8', '10', '12', '14', '16', 'S', 'M', 'L'];
  fotoEstudianteFile: File | null = null;
  fotoDocumentoFile: File | null = null;
  fotoDocumentoPadreFile: File | null = null;
  fotoEstudiantePreview: string | null = null;
  fotoDocumentoPreview: string | null = null;
  fotoDocumentoPadrePreview: string | null = null;
  documentoEsPdf = false;
  documentoPadreEsPdf = false;

  form = this.fb.nonNullable.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    fecha_nacimiento: ['', Validators.required],
    genero: ['masculino' as GeneroAlumno, Validators.required],
    nombre_tutor: ['', Validators.required],
    telefono_tutor: ['', Validators.required],
    categoria: ['', Validators.required],
    nivel: ['' as NivelAlumno | ''],
    talla_camiseta: [''],
    fecha_ingreso: [''],
    foto_estudiante_url: [''],
    foto_documento_url: [''],
    foto_documento_padre_url: [''],
  });

  constructor() {
    addIcons({
      bulbOutline,
      cameraOutline,
      checkmarkOutline,
      cloudUploadOutline,
      documentOutline,
      documentTextOutline,
      openOutline,
      peopleOutline,
      personAddOutline,
      personOutline,
    });
  }

  ngOnInit(): void {
    this.alumnoId = this.route.snapshot.paramMap.get('id');
    if (this.authService.isAdmin()) {
      this.categorias = [...CATEGORIAS];
    } else {
      const asignadas = this.authService.categoriasAsignadas();
      this.categorias =
        asignadas.length > 0 ? [...asignadas] : [...CATEGORIAS];
    }

    if (!this.alumnoId) {
      // Nuevo registro: pre-fill fecha de ingreso con hoy
      const hoy = new Date().toISOString().split('T')[0];
      this.form.patchValue({ fecha_ingreso: hoy });
    }
    this.form.controls.fecha_nacimiento.valueChanges.subscribe((fecha) => {
      if (fecha) {
        this.categoriaRecomendada = this.categoriaService.calcularCategoria(fecha);
        if (!this.form.controls.categoria.dirty) {
          this.form.patchValue({ categoria: this.categoriaRecomendada });
        }
      }
    });

    if (this.alumnoId) {
      this.loadingAlumno = true;
      this.alumnosService.getById(this.alumnoId).subscribe({
        next: async (alumno) => {
          this.form.patchValue({
            nombres: alumno.nombres,
            apellidos: alumno.apellidos,
            fecha_nacimiento: alumno.fecha_nacimiento,
            genero: alumno.genero,
            nombre_tutor: alumno.nombre_tutor,
            telefono_tutor: alumno.telefono_tutor,
            categoria: alumno.categoria,
            nivel: alumno.nivel ?? '',
            talla_camiseta: alumno.talla_camiseta ?? '',
            fecha_ingreso: alumno.fecha_ingreso ?? '',
            foto_estudiante_url: alumno.foto_estudiante_url ?? '',
            foto_documento_url: alumno.foto_documento_url ?? '',
            foto_documento_padre_url: alumno.foto_documento_padre_url ?? '',
          });
          // Capturar updated_at para optimistic locking
          this.alumnoUpdatedAt = alumno.updated_at ?? null;
          this.categoriaRecomendada = this.categoriaService.calcularCategoria(
            alumno.fecha_nacimiento
          );
          this.loadingAlumno = false;

          if (alumno.foto_estudiante_url) {
            this.loadingFotoEstudiante = true;
            try {
              this.fotoEstudiantePreview = await this.supabaseService.resolveFileUrl(
                alumno.foto_estudiante_url
              );
            } catch {
              this.fotoEstudiantePreview = null;
            } finally {
              this.loadingFotoEstudiante = false;
            }
          }

          if (alumno.foto_documento_url) {
            this.documentoEsPdf = this.supabaseService.isPdfStored(
              alumno.foto_documento_url
            );
            this.loadingFotoDocumento = true;
            try {
              this.fotoDocumentoPreview = await this.supabaseService.resolveFileUrl(
                alumno.foto_documento_url
              );
            } catch {
              this.fotoDocumentoPreview = null;
            } finally {
              this.loadingFotoDocumento = false;
            }
          }

          if (alumno.foto_documento_padre_url) {
            this.documentoPadreEsPdf = this.supabaseService.isPdfStored(
              alumno.foto_documento_padre_url
            );
            this.loadingFotoDocumentoPadre = true;
            try {
              this.fotoDocumentoPadrePreview = await this.supabaseService.resolveFileUrl(
                alumno.foto_documento_padre_url
              );
            } catch {
              this.fotoDocumentoPadrePreview = null;
            } finally {
              this.loadingFotoDocumentoPadre = false;
            }
          }
        },
        error: () => {
          this.loadingAlumno = false;
        },
      });
    }
  }

  onFileSelected(event: Event, tipo: 'estudiante' | 'documento' | 'padre'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    if (tipo === 'estudiante') {
      this.fotoEstudianteFile = file;
      this.fotoEstudiantePreview = preview;
      this.loadingFotoEstudiante = false;
    } else if (tipo === 'documento') {
      this.fotoDocumentoFile = file;
      this.documentoEsPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      this.fotoDocumentoPreview = this.documentoEsPdf ? null : preview;
      this.loadingFotoDocumento = false;
    } else {
      this.fotoDocumentoPadreFile = file;
      this.documentoPadreEsPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      this.fotoDocumentoPadrePreview = this.documentoPadreEsPdf ? null : preview;
      this.loadingFotoDocumentoPadre = false;
    }
  }

  nivelColor(nivel: NivelAlumno): string {
    const colores: Record<NivelAlumno, string> = {
      basico: '#e74c3c',
      intermedio: '#f1c40f',
      avanzado: '#2ecc71',
    };
    return colores[nivel] || '#999';
  }

  aplicarCategoriaRecomendada(): void {
    this.form.patchValue({ categoria: this.categoriaRecomendada });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    try {
      const raw = this.form.getRawValue();
      const nivelValue = raw.nivel || null;
      const datosAlumno = {
        nombres: raw.nombres,
        apellidos: raw.apellidos,
        fecha_nacimiento: raw.fecha_nacimiento,
        genero: raw.genero,
        nombre_tutor: raw.nombre_tutor,
        telefono_tutor: raw.telefono_tutor,
        categoria: raw.categoria,
        nivel: nivelValue as NivelAlumno | null,
        talla_camiseta: raw.talla_camiseta || null,
        fecha_ingreso: raw.fecha_ingreso || null,
      };

      if (this.alumnoId) {
        let fotoEstudianteUrl = raw.foto_estudiante_url || null;
        let fotoDocumentoUrl = raw.foto_documento_url || null;
        let fotoDocumentoPadreUrl = raw.foto_documento_padre_url || null;

        if (this.fotoEstudianteFile) {
          fotoEstudianteUrl = await this.supabaseService.uploadAlumnoExpediente(
            this.fotoEstudianteFile,
            'fotos-estudiante',
            this.alumnoId,
            raw.foto_estudiante_url
          );
        }
        if (this.fotoDocumentoFile) {
          fotoDocumentoUrl = await this.supabaseService.uploadAlumnoExpediente(
            this.fotoDocumentoFile,
            'documentos',
            this.alumnoId,
            raw.foto_documento_url
          );
        }
        if (this.fotoDocumentoPadreFile) {
          fotoDocumentoPadreUrl = await this.supabaseService.uploadAlumnoExpediente(
            this.fotoDocumentoPadreFile,
            'documentos-padre',
            this.alumnoId,
            raw.foto_documento_padre_url
          );
        }

        await firstValueFrom(
          this.alumnosService.update(this.alumnoId, {
            ...datosAlumno,
            foto_estudiante_url: fotoEstudianteUrl,
            foto_documento_url: fotoDocumentoUrl,
            foto_documento_padre_url: fotoDocumentoPadreUrl,
            updated_at: this.alumnoUpdatedAt ?? undefined,
          })
        );
      } else {
        const tieneArchivosNuevos =
          !!this.fotoEstudianteFile || !!this.fotoDocumentoFile || !!this.fotoDocumentoPadreFile;

        let alumno = await firstValueFrom(
          this.alumnosService.create({
            ...datosAlumno,
            foto_estudiante_url: tieneArchivosNuevos
              ? null
              : raw.foto_estudiante_url || null,
            foto_documento_url: tieneArchivosNuevos
              ? null
              : raw.foto_documento_url || null,
            foto_documento_padre_url: tieneArchivosNuevos
              ? null
              : raw.foto_documento_padre_url || null,
          })
        );

        // Intentar subir archivos y hacer rollback si algo falla
        const uploadedPaths: string[] = [];
        try {
          if (this.fotoEstudianteFile) {
            const url = await this.supabaseService.uploadAlumnoExpediente(
              this.fotoEstudianteFile,
              'fotos-estudiante',
              alumno.id,
              null
            );
            uploadedPaths.push(url);
            alumno = { ...alumno, foto_estudiante_url: url };
          }
          if (this.fotoDocumentoFile) {
            const url = await this.supabaseService.uploadAlumnoExpediente(
              this.fotoDocumentoFile,
              'documentos',
              alumno.id,
              null
            );
            uploadedPaths.push(url);
            alumno = { ...alumno, foto_documento_url: url };
          }
          if (this.fotoDocumentoPadreFile) {
            const url = await this.supabaseService.uploadAlumnoExpediente(
              this.fotoDocumentoPadreFile,
              'documentos-padre',
              alumno.id,
              null
            );
            uploadedPaths.push(url);
            alumno = { ...alumno, foto_documento_padre_url: url };
          }

          if (uploadedPaths.length > 0) {
            await firstValueFrom(
              this.alumnosService.update(alumno.id, {
                foto_estudiante_url: alumno.foto_estudiante_url ?? null,
                foto_documento_url: alumno.foto_documento_url ?? null,
                foto_documento_padre_url: alumno.foto_documento_padre_url ?? null,
              })
            );
          }
        } catch (uploadErr) {
          // Rollback: eliminar archivos que se alcanzaron a subir
          if (uploadedPaths.length > 0) {
            await this.supabaseService.removeExpedientePaths(uploadedPaths).catch(() => {});
          }
          // Rollback: eliminar el registro del alumno usando firstValueFrom
          await firstValueFrom(this.alumnosService.delete(alumno.id)).catch(() => {});
          this.saving = false;
          const toast = await this.toastCtrl.create({
            message: `Error al subir archivos: ${(uploadErr as Error).message}. El registro no se guardó.`,
            duration: 4000,
            color: 'danger',
          });
          await toast.present();
          return;
        }
      }

      this.saving = false;
      const toast = await this.toastCtrl.create({
        message: `Alumno ${this.alumnoId ? 'actualizado' : 'registrado'} correctamente`,
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      await this.router.navigate(['/app/alumnos']);
    } catch (err) {
      this.saving = false;
      const toast = await this.toastCtrl.create({
        message: (err as Error).message,
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
