import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseServer } from '../supabase/server';

export type StaffRole = 'comercial' | 'pm' | 'admin_tecnico';
export interface Staff { user_id: string; role: StaffRole; display_name: string; is_admin: boolean }

export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}

/** Cliente con sesión iniciada; si no, a /acceso. */
export async function requireClient(next?: string) {
  const { sb, user } = await currentUser();
  if (!user) redirect(`/acceso${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return { sb, user };
}

/** Personal activo de Graphique con MFA verificado (aal2). */
export async function requireStaff(roles?: StaffRole[]) {
  const { sb, user } = await currentUser();
  if (!user) redirect('/admin/acceso');
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/admin/acceso');
  const { data: staff } = await sb.from('staff').select('user_id, role, display_name, is_admin').eq('user_id', user.id).eq('active', true).maybeSingle<Staff>();
  if (!staff) redirect('/sin-acceso');
  if (roles && !roles.includes(staff.role)) redirect('/sin-acceso');
  return { sb, user, staff };
}

/** Administrador del equipo (gestiona altas, roles y activación). */
export async function requireTeamAdmin() {
  const ctx = await requireStaff();
  if (!ctx.staff.is_admin) redirect('/sin-acceso');
  return ctx;
}
