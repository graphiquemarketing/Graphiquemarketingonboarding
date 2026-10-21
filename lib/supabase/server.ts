import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '../env';

/** Cliente con la sesión del usuario: todas las consultas pasan por RLS. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* componentes de servidor no escriben cookies */ }
      },
    },
  });
}

/** Cliente con llave de servicio. SOLO para: solicitudes públicas, alta de usuarios invitados, correo y URLs firmadas ya autorizadas. */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl(), env.serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
