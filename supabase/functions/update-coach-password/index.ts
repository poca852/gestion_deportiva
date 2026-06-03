import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment variables' });
  }

  if (!authHeader) {
    return jsonResponse(401, { error: 'Missing authorization header' });
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verificar que el solicitante está autenticado
  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  // Verificar que el solicitante es admin o super_admin
  const [entrenadorResult, superAdminResult] = await Promise.all([
    supabaseAdmin.from('entrenadores').select('rol, academia_id').eq('id', user.id).maybeSingle(),
    supabaseAdmin.from('super_admins').select('id').eq('id', user.id).maybeSingle(),
  ]);

  const esSuperAdmin = !!superAdminResult.data;
  const esAdmin = !esSuperAdmin && entrenadorResult.data?.rol === 'admin';

  if (!esSuperAdmin && !esAdmin) {
    return jsonResponse(403, { error: 'Solo administradores pueden cambiar contraseñas' });
  }

  // Leer payload
  let payload: { coach_id: string; password: string };
  try {
    payload = (await req.json()) as { coach_id: string; password: string };
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const coachId = payload.coach_id?.trim();
  const password = payload.password?.trim();

  if (!coachId || !password) {
    return jsonResponse(400, {
      error: 'coach_id y password son obligatorios',
    });
  }

  if (password.length < 6) {
    return jsonResponse(400, {
      error: 'La contraseña debe tener al menos 6 caracteres',
    });
  }

  // Verificar que el usuario target existe (solo para admins de academia)
  if (esAdmin) {
    const { data: coach, error: coachError } = await supabaseAdmin
      .from('entrenadores')
      .select('id, academia_id')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return jsonResponse(404, {
        error: 'El usuario no existe',
      });
    }

    // El admin solo puede cambiar contraseñas de su propia academia
    if (coach.academia_id !== entrenadorResult.data?.academia_id) {
      return jsonResponse(403, {
        error: 'No puedes cambiar la contraseña de un usuario de otra academia',
      });
    }
  }

  // Actualizar la contraseña en Auth
  const { error: updateError } =
    await supabaseAdmin.auth.admin.updateUserById(coachId, {
      password,
    });

  if (updateError) {
    return jsonResponse(400, {
      error: updateError.message ?? 'No se pudo actualizar la contraseña',
    });
  }

  return jsonResponse(200, { message: 'Contraseña actualizada correctamente' });
});
