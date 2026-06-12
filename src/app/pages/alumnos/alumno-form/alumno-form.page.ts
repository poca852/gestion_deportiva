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
  cardOutline,
  checkmarkOutline,
  closeCircle,
  cloudUploadOutline,
  documentOutline,
  documentTextOutline,
  imagesOutline,
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
import { CategoriaService } from '../../../services/categoria.service';
import { MediaService } from '../../../services/media.service';
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
  private loadedAlumnoId: string | null = null;
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alumnosService = inject(AlumnosService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly mediaService = inject(MediaService);

  alumnoId: string | null = null;
  /** Guarda el updated_at original para optimistic locking */
  private alumnoUpdatedAt: string | null = null;
  saving = false;
  loadingAlumno = false;
  loadingFotoEstudiante = false;
  loadingFotoDocumento = false;
  loadingFotoDocumentoPadre = false;
  categorias: string[] = [];
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
      cardOutline,
      checkmarkOutline,
      closeCircle,
      cloudUploadOutline,
      documentOutline,
      documentTextOutline,
      imagesOutline,
      openOutline,
      peopleOutline,
      personAddOutline,
      personOutline,
    });
  }

  ngOnInit(): void {
    if (this.authService.isAdmin()) {
      this.categorias = [...this.categoriaService.getAll()];
    } else {
      const asignadas = this.authService.categoriasAsignadas();
      this.categorias =
        asignadas.length > 0 ? [...asignadas] : [...this.categoriaService.getAll()];
    }

    this.form.controls.fecha_nacimiento.valueChanges.subscribe((fecha) => {
      if (fecha) {
        this.categoriaRecomendada = this.categoriaService.calcularCategoria(fecha);
        if (!this.form.controls.categoria.dirty) {
          this.form.patchValue({ categoria: this.categoriaRecomendada });
        }
      } else {
        this.categoriaRecomendada = '';
      }
    });
  }

  ionViewWillEnter(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.alumnoId = id;

    if (!id) {
      this.resetForNewAlumno();
      this.loadedAlumnoId = null;
      return;
    }

    if (id !== this.loadedAlumnoId) {
      this.clearMediaState();
      this.loadAlumno(id);
      this.loadedAlumnoId = id;
    }
  }

  private resetForNewAlumno(): void {
    this.clearMediaState();
    this.alumnoUpdatedAt = null;
    this.saving = false;
    this.loadingAlumno = false;
    this.categoriaRecomendada = '';

    const hoy = new Date().toISOString().split('T')[0];
    this.form.reset({
      nombres: '',
      apellidos: '',
      fecha_nacimiento: '',
      genero: 'masculino',
      nombre_tutor: '',
      telefono_tutor: '',
      categoria: '',
      nivel: '',
      talla_camiseta: '',
      fecha_ingreso: hoy,
      foto_estudiante_url: '',
      foto_documento_url: '',
      foto_documento_padre_url: '',
    });
  }

  private clearMediaState(): void {
    this.revokeBlobUrl(this.fotoEstudiantePreview);
    this.revokeBlobUrl(this.fotoDocumentoPreview);
    this.revokeBlobUrl(this.fotoDocumentoPadrePreview);

    this.fotoEstudianteFile = null;
    this.fotoDocumentoFile = null;
    this.fotoDocumentoPadreFile = null;
    this.fotoEstudiantePreview = null;
    this.fotoDocumentoPreview = null;
    this.fotoDocumentoPadrePreview = null;
    this.documentoEsPdf = false;
    this.documentoPadreEsPdf = false;
    this.loadingFotoEstudiante = false;
    this.loadingFotoDocumento = false;
    this.loadingFotoDocumentoPadre = false;
  }

  private revokeBlobUrl(url: string | null): void {
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  private loadAlumno(id: string): void {
    this.loadingAlumno = true;
    this.alumnosService.getById(id).subscribe({
      next: async (alumno) => {
        this.form.reset({
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

  // ──────────────────────────────────────
  //  Acciones de cámara / galería
  // ──────────────────────────────────────

  async takeStudentPhoto(): Promise<void> {
    const media = await this.mediaService.takePhoto();
    if (media) {
      this.applyFileTo('estudiante', media.file, media.preview);
    }
  }

  async pickStudentFromGallery(): Promise<void> {
    const media = await this.mediaService.pickFromGallery();
    if (media) {
      this.applyFileTo('estudiante', media.file, media.preview);
    }
  }

  async takeParentPhoto(): Promise<void> {
    const media = await this.mediaService.takePhoto();
    if (media) {
      this.applyFileTo('padre', media.file, media.preview);
    }
  }

  async pickParentFromGallery(): Promise<void> {
    const media = await this.mediaService.pickFromGallery();
    if (media) {
      this.applyFileTo('padre', media.file, media.preview);
    }
  }

  /**
   * Para la partida de nacimiento: se prefiere PDF, pero también
   * se permite fotografiar un documento físico.
   */
  async pickBirthCertificatePdf(): Promise<void> {
    const file = await this.mediaService.pickPdf();
    if (file) {
      const preview = URL.createObjectURL(file);
      this.applyFileTo('documento', file, preview);
    }
  }

  async takeBirthCertificatePhoto(): Promise<void> {
    const media = await this.mediaService.takePhoto();
    if (media) {
      this.applyFileTo('documento', media.file, media.preview);
    }
  }

  // ──────────────────────────────────────
  //  Aplicar archivo seleccionado al estado
  // ──────────────────────────────────────

  private applyFileTo(
    tipo: 'estudiante' | 'documento' | 'padre',
    file: File,
    preview: string
  ): void {
    const esPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (tipo === 'estudiante') {
      this.fotoEstudianteFile = file;
      this.fotoEstudiantePreview = preview;
      this.loadingFotoEstudiante = false;
    } else if (tipo === 'documento') {
      this.fotoDocumentoFile = file;
      this.documentoEsPdf = esPdf;
      this.fotoDocumentoPreview = esPdf ? null : preview;
      this.loadingFotoDocumento = false;
    } else {
      this.fotoDocumentoPadreFile = file;
      this.documentoPadreEsPdf = esPdf;
      this.fotoDocumentoPadrePreview = esPdf ? null : preview;
      this.loadingFotoDocumentoPadre = false;
    }
  }

  /**
   * Quita el archivo seleccionado para un campo, volviendo al valor
   * persistido (si existe) o limpiando la previsualización.
   */
  removeFile(tipo: 'estudiante' | 'documento' | 'padre'): void {
    const formKey =
      tipo === 'estudiante'
        ? 'foto_estudiante_url'
        : tipo === 'documento'
          ? 'foto_documento_url'
          : 'foto_documento_padre_url' as const;

    if (tipo === 'estudiante') {
      this.fotoEstudianteFile = null;
      this.fotoEstudiantePreview = this.form.controls[formKey].value || null;
      this.loadingFotoEstudiante = false;
    } else if (tipo === 'documento') {
      this.fotoDocumentoFile = null;
      this.fotoDocumentoPreview = this.form.controls[formKey].value || null;
      this.loadingFotoDocumento = false;
    } else {
      this.fotoDocumentoPadreFile = null;
      this.fotoDocumentoPadrePreview = this.form.controls[formKey].value || null;
      this.loadingFotoDocumentoPadre = false;
    }
  }

  // ──────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────

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

  // ──────────────────────────────────────
  //  Submit
  // ──────────────────────────────────────

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
      if (!this.alumnoId) {
        this.resetForNewAlumno();
        this.loadedAlumnoId = null;
      }
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
