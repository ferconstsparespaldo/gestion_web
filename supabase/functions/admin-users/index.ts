import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RolUsuario = 'admin' | 'trabajador';

type RequestBody = {
  action?: 'list' | 'create' | 'update';
  id?: string;
  email?: string;
  password?: string;
  nombre?: string;
  rol?: RolUsuario;
  activo?: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Falta configuración del servidor Supabase.' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return json({ error: 'Sesión no válida.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const caller = userData.user;

  if (userError || !caller) {
    return json({ error: 'Sesión no válida.' }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await admin
    .from('profiles')
    .select('rol, activo')
    .eq('id', caller.id)
    .maybeSingle();

  if (
    callerProfileError ||
    !callerProfile ||
    callerProfile.activo !== true ||
    callerProfile.rol !== 'admin'
  ) {
    return json({ error: 'No tienes permisos de administrador.' }, 403);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  try {
    if (body.action === 'list') {
      const usuariosAuth = [];
      let page = 1;

      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error) throw error;

        usuariosAuth.push(...data.users);
        if (data.users.length < 200) break;
        page += 1;
      }

      const ids = usuariosAuth.map((user) => user.id);
      const perfiles = ids.length
        ? await admin
            .from('profiles')
            .select('id, nombre, rol, activo, created_at')
            .in('id', ids)
        : { data: [], error: null };

      if (perfiles.error) throw perfiles.error;

      const perfilesPorId = new Map(
        (perfiles.data || []).map((perfil) => [perfil.id, perfil])
      );

      const usuarios = usuariosAuth
        .map((user) => {
          const perfil = perfilesPorId.get(user.id);
          return {
            id: user.id,
            email: user.email || '',
            nombre:
              perfil?.nombre ||
              String(user.user_metadata?.nombre || user.user_metadata?.name || ''),
            rol: (perfil?.rol || 'trabajador') as RolUsuario,
            activo: perfil?.activo ?? true,
            created_at: perfil?.created_at || user.created_at || null,
            perfil_configurado: Boolean(perfil),
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

      return json({ usuarios });
    }

    if (body.action === 'create') {
      const email = body.email?.trim().toLowerCase();
      const nombre = body.nombre?.trim();
      const password = body.password || '';
      const rol: RolUsuario = body.rol === 'admin' ? 'admin' : 'trabajador';
      const activo = body.activo ?? true;

      if (!email || !nombre || password.length < 8) {
        return json(
          { error: 'Correo, nombre y contraseña de al menos 8 caracteres son obligatorios.' },
          400
        );
      }

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre },
      });
      if (error || !data.user) throw error || new Error('No se pudo crear el usuario.');

      const { error: profileError } = await admin.from('profiles').upsert({
        id: data.user.id,
        nombre,
        rol,
        activo,
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }

      return json({ ok: true, id: data.user.id });
    }

    if (body.action === 'update') {
      const id = body.id?.trim();
      const nombre = body.nombre?.trim();
      const rol: RolUsuario = body.rol === 'admin' ? 'admin' : 'trabajador';
      const activo = body.activo ?? true;

      if (!id || !nombre) {
        return json({ error: 'ID y nombre son obligatorios.' }, 400);
      }

      if (id === caller.id && (!activo || rol !== 'admin')) {
        return json(
          { error: 'No puedes quitarte tu propio acceso de administrador desde esta sesión.' },
          400
        );
      }

      if (body.password && body.password.length < 8) {
        return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
      }

      if (body.password) {
        const { error } = await admin.auth.admin.updateUserById(id, {
          password: body.password,
        });
        if (error) throw error;
      }

      const { error: profileError } = await admin.from('profiles').upsert({
        id,
        nombre,
        rol,
        activo,
      });
      if (profileError) throw profileError;

      return json({ ok: true });
    }

    return json({ error: 'Acción no soportada.' }, 400);
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor.' },
      500
    );
  }
});
