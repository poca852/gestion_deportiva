import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const EXPEDIENTES_BUCKET = 'expedientes-academia';
const SIGNED_URL_TTL_SEC = 60 * 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isPdfPath(path: string | null | undefined): boolean {
  return !!path && path.toLowerCase().endsWith('.pdf');
}

async function createSignedUrl(
  supabaseAdmin: ReturnType<typeof createClient>,
  storedPath: string | null | undefined
): Promise<string | null> {
  if (!storedPath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(EXPEDIENTES_BUCKET)
    .createSignedUrl(storedPath, SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment variables' });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token')?.trim();

  if (!token) {
    return jsonResponse(400, { error: 'Token requerido' });
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(token)) {
    return jsonResponse(400, { error: 'Token inválido' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: alumno, error: alumnoError } = await supabaseAdmin
    .from('alumnos')
    .select(
      'nombres, apellidos, fecha_nacimiento, categoria, foto_estudiante_url, foto_documento_url, academia_id'
    )
    .eq('public_token', token)
    .maybeSingle();

  if (alumnoError) {
    return jsonResponse(500, { error: 'Error al consultar el perfil' });
  }

  if (!alumno) {
    return jsonResponse(404, { error: 'Perfil no encontrado' });
  }

  let academiaNombre = '';
  let academiaLogoUrl: string | null = null;

  if (alumno.academia_id) {
    const { data: academia } = await supabaseAdmin
      .from('academias')
      .select('nombre, logo_url')
      .eq('id', alumno.academia_id)
      .maybeSingle();

    if (academia) {
      academiaNombre = academia.nombre ?? '';
      academiaLogoUrl = await createSignedUrl(supabaseAdmin, academia.logo_url);
    }
  }

  const [fotoUrl, documentoUrl] = await Promise.all([
    createSignedUrl(supabaseAdmin, alumno.foto_estudiante_url),
    createSignedUrl(supabaseAdmin, alumno.foto_documento_url),
  ]);

  return jsonResponse(200, {
    data: {
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      fecha_nacimiento: alumno.fecha_nacimiento,
      categoria: alumno.categoria,
      foto_url: fotoUrl,
      documento_url: documentoUrl,
      documento_es_pdf: isPdfPath(alumno.foto_documento_url),
      academia_nombre: academiaNombre,
      academia_logo_url: academiaLogoUrl,
    },
  });
});
