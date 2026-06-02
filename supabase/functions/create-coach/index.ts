import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

type RolEntrenador = 'admin' | 'coach';

interface CreateCoachBody {
  nombre: string;
  correo: string;
  password: string;
  categorias_asignadas?: string[];
  rol?: RolEntrenador;
  academia_id?: string;
}

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

function normalizeCategorias(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((c) => String(c).trim()).filter(Boolean))];
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

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  // Verificar que el solicitante es super_admin (tabla super_admins) o admin (tabla entrenadores)
  const { data: superAdmin } = await supabaseAdmin
    .from('super_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  let requester: { rol: string; academia_id: string | null } | null = null;

  if (!superAdmin) {
    // No es super_admin, verificar si es admin en entrenadores
    const { data: ent, error: entError } = await supabaseAdmin
      .from('entrenadores')
      .select('rol, academia_id')
      .eq('id', user.id)
      .single();

    if (entError || !ent) {
      return jsonResponse(403, { error: 'Only admins can create coaches' });
    }
    requester = ent;
  } else {
    requester = { rol: 'super_admin', academia_id: null };
  }

  const isAdmin = requester.rol === 'admin' || requester.rol === 'super_admin';
  if (!isAdmin) {
    return jsonResponse(403, { error: 'Only admins can create coaches' });
  }

  let payload: CreateCoachBody;
  try {
    payload = (await req.json()) as CreateCoachBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const nombre = payload.nombre?.trim();
  const correo = payload.correo?.trim().toLowerCase();
  const password = payload.password?.trim();
  const rol: RolEntrenador = payload.rol === 'admin' ? 'admin' : 'coach';
  const categoriasAsignadas = normalizeCategorias(payload.categorias_asignadas);

  // Determinar academia_id:
  // - El super_admin puede especificarlo o no
  // - El admin de academia usa su propia academia
  let academiaId: string | null = null;
  if (requester.rol === 'super_admin') {
    academiaId = payload.academia_id || null;
  } else {
    academiaId = requester.academia_id;
  }

  if (!nombre || !correo || !password) {
    return jsonResponse(400, {
      error: 'nombre, correo y password son obligatorios',
    });
  }

  if (password.length < 6) {
    return jsonResponse(400, {
      error: 'La contraseña debe tener al menos 6 caracteres',
    });
  }

  const { data: createdUser, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: nombre,
      },
    });

  if (createError || !createdUser.user) {
    return jsonResponse(400, {
      error: createError?.message ?? 'No se pudo crear el usuario en Auth',
    });
  }

  const userId = createdUser.user.id;

  const { data: entrenador, error: upsertError } = await supabaseAdmin
    .from('entrenadores')
    .upsert(
      {
        id: userId,
        nombre,
        correo,
        categorias_asignadas: categoriasAsignadas,
        rol,
        academia_id: academiaId,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (upsertError || !entrenador) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return jsonResponse(500, {
      error: upsertError?.message ?? 'No se pudo guardar el perfil del entrenador',
    });
  }

  return jsonResponse(200, { data: entrenador });
});
