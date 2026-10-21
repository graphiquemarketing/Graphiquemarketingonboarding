'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export interface StaffLoginState { step: 'password' | 'enroll' | 'verify'; factorId?: string; qr?: string; secret?: string; error?: string }

export async function staffPasswordAction(_: StaffLoginState, form: FormData): Promise<StaffLoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { step: 'password', error: 'Correo o contraseña incorrectos.' };
  const { data: staff } = await sb.from('staff').select('user_id').eq('user_id', data.user.id).eq('active', true).maybeSingle();
  if (!staff) { await sb.auth.signOut(); return { step: 'password', error: 'Esta cuenta no pertenece al equipo de Graphique.' }; }
  const { data: factors } = await sb.auth.mfa.listFactors();
  const totp = factors?.totp?.find((f) => f.status === 'verified');
  if (totp) return { step: 'verify', factorId: totp.id };
  // Primera vez: alta obligatoria de la app de autenticación.
  for (const f of factors?.all ?? []) if (f.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: f.id });
  const { data: en, error: enErr } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Portal Graphique' });
  if (enErr || !en) return { step: 'password', error: 'No pudimos preparar la verificación en dos pasos. Inténtalo de nuevo.' };
  return { step: 'enroll', factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret };
}

export async function staffMfaAction(prev: StaffLoginState, form: FormData): Promise<StaffLoginState> {
  const code = String(form.get('token') ?? '').replace(/\D/g, '');
  if (code.length !== 6 || !prev.factorId) return { ...prev, error: 'Escribe los 6 dígitos de tu app de autenticación.' };
  const sb = await supabaseServer();
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: prev.factorId, code });
  if (error) return { ...prev, error: 'El código no coincide. Revisa la hora de tu teléfono y usa el código actual.' };
  redirect('/admin');
}
