'use server';
import { revalidatePath } from 'next/cache';
import { requireTeamAdmin, type StaffRole } from '@/lib/server/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { env } from '@/lib/env';
import { sendMail, templates } from '@/lib/server/email';

const ROLES: StaffRole[] = ['comercial', 'pm', 'admin_tecnico'];
const ROLE_LABEL: Record<StaffRole, string> = { comercial: 'Comercial', pm: 'PM / revisor', admin_tecnico: 'Administrador técnico' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f-]{36}$/i;

async function findUserByEmail(email: string) {
  const admin = supabaseAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Enlace de un solo uso para crear contraseña; el token viaja solo en el correo. */
async function sendActivation(email: string, name: string, role: StaffRole): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data?.properties?.hashed_token) return false;
  const url = `${env.siteUrl()}/cuenta/activar?token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
  return sendMail({ kind: 'activacion_equipo', to: email, ...templates.activacionEquipo(name, ROLE_LABEL[role], url) });
}

export async function addMemberAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireTeamAdmin();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const name = String(form.get('name') ?? '').trim();
  const role = String(form.get('role')) as StaffRole;
  const isAdmin = form.get('is_admin') === 'on';
  if (!EMAIL.test(email)) return { ok: false, error: 'Escribe un correo válido.' };
  if (name.length < 2) return { ok: false, error: 'Escribe el nombre de la persona.' };
  if (!ROLES.includes(role)) return { ok: false, error: 'Elige un rol.' };
  const admin = supabaseAdmin();
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) return { ok: false, error: 'No pudimos crear la cuenta. Revisa el correo e inténtalo de nuevo.' };
    user = data.user;
  }
  const { error } = await sb.rpc('team_save', { p_user: user.id, p_role: role, p_name: name, p_active: true, p_admin: isAdmin });
  if (error) return { ok: false, error: friendlyError(error) };
  const sent = await sendActivation(email, name, role);
  revalidatePath('/admin/equipo');
  return sent ? { ok: true, message: `${name} quedó como ${ROLE_LABEL[role]}. Le enviamos el correo de activación.` }
    : { ok: true, message: `${name} quedó como ${ROLE_LABEL[role]}, pero el correo de activación falló. Usa «Reenviar activación».` };
}

export async function updateMemberAction(userId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireTeamAdmin();
  if (!UUID.test(userId)) return { ok: false, error: 'Cuenta inválida.' };
  const role = String(form.get('role')) as StaffRole;
  if (!ROLES.includes(role)) return { ok: false, error: 'Elige un rol.' };
  const { error } = await sb.rpc('team_save', {
    p_user: userId, p_role: role, p_name: String(form.get('name') ?? '').trim(),
    p_active: form.get('active') === 'on', p_admin: form.get('is_admin') === 'on',
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/admin/equipo');
  return { ok: true, message: 'Cambios guardados.' };
}

export async function resendActivationAction(userId: string): Promise<ActionResult> {
  const { sb } = await requireTeamAdmin();
  const { data: st } = await sb.from('staff').select('display_name, role, active').eq('user_id', userId).maybeSingle();
  if (!st?.active) return { ok: false, error: 'Activa primero a la persona.' };
  const { data } = await supabaseAdmin().auth.admin.getUserById(userId);
  if (!data.user?.email) return { ok: false, error: 'No encontramos el correo de esa cuenta.' };
  const sent = await sendActivation(data.user.email, st.display_name, st.role);
  return sent ? { ok: true, message: `Reenviamos la activación a ${data.user.email}.` } : { ok: false, error: 'El correo falló. Inténtalo en unos minutos.' };
}

/** Para teléfono perdido o cambiado: borra los factores y la persona vuelve a configurar su app al entrar. */
export async function resetMfaAction(userId: string): Promise<ActionResult> {
  const { user, staff } = await requireTeamAdmin();
  if (userId === user.id) return { ok: false, error: 'No puedes restablecer tu propia verificación desde aquí; pídeselo a otro administrador.' };
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) return { ok: false, error: 'No pudimos leer la verificación de esa cuenta.' };
  for (const f of data.factors) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
  await admin.auth.admin.signOut(userId).catch(() => undefined);
  await admin.from('audit_logs').insert({ actor: user.id, actor_label: `Graphique ${staff.role} · ${staff.display_name}`, action: 'MFA_RESTABLECIDO', detail: { user_id: userId, factores: data.factors.length } });
  revalidatePath('/admin/equipo');
  return { ok: true, message: 'Verificación restablecida. En su próximo acceso configurará su app de nuevo.' };
}
