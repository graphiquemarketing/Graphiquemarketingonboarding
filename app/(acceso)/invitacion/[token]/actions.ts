'use server';
import { redirect } from 'next/navigation';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import { EMAIL_OTP_LENGTH } from '@/lib/otp';

export interface InviteState { step: 'start' | 'code'; error?: string }

async function info(token: string) {
  const sb = await supabaseServer();
  const { data } = await sb.rpc('invitation_info', { p_token: token }).maybeSingle<{ email: string; status: string; folio: string }>();
  return data;
}

export async function sendInviteCode(token: string, _: InviteState): Promise<InviteState> {
  const inv = await info(token);
  if (!inv || inv.status === 'VENCIDA' || inv.status === 'REVOCADA') redirect('/enlace-vencido');
  if (inv.status === 'ACEPTADA') redirect('/acceso');
  // Las altas públicas están desactivadas: la cuenta se crea solo aquí, con una invitación vigente.
  const admin = supabaseAdmin();
  const { error: createErr } = await admin.auth.admin.createUser({ email: inv.email, email_confirm: true });
  if (createErr && !/already|registered|exists/i.test(createErr.message)) return { step: 'start', error: 'No pudimos preparar tu cuenta. Inténtalo de nuevo en unos minutos.' };
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({ email: inv.email, options: { shouldCreateUser: false } });
  if (error) return { step: 'start', error: 'No pudimos enviar el código. Espera un minuto e inténtalo de nuevo.' };
  return { step: 'code' };
}

export async function verifyInviteCode(token: string, prev: InviteState, form: FormData): Promise<InviteState> {
  const inv = await info(token);
  if (!inv || inv.status !== 'VIGENTE') redirect('/enlace-vencido');
  const code = String(form.get('token') ?? '').replace(/\D/g, '');
  if (code.length !== EMAIL_OTP_LENGTH) return { ...prev, error: `Faltan dígitos: el código tiene ${EMAIL_OTP_LENGTH}.` };
  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ email: inv.email, token: code, type: 'email' });
  if (error) return { ...prev, error: 'El código no coincide o ya venció. Pide uno nuevo.' };
  return acceptWith(sb, token);
}

export async function acceptInvitation(token: string): Promise<InviteState> {
  const sb = await supabaseServer();
  return acceptWith(sb, token);
}

async function acceptWith(sb: Awaited<ReturnType<typeof supabaseServer>>, token: string): Promise<InviteState> {
  const { data, error } = await sb.rpc('accept_invitation', { p_token: token });
  if (error) {
    if (/VENCIDA|USADA|INVALIDA/.test(error.message)) redirect('/enlace-vencido');
    return { step: 'code', error: friendlyError(error) };
  }
  redirect(`/cliente/proyectos/${data}/brief/M01?bienvenida=1`);
}
