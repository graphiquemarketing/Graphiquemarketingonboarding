'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export interface PwState { error?: string }

export async function setPasswordAction(_: PwState, form: FormData): Promise<PwState> {
  const pw = String(form.get('password') ?? '');
  const pw2 = String(form.get('password2') ?? '');
  if (pw.length < 12) return { error: 'Usa al menos 12 caracteres.' };
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { error: 'Combina letras y números.' };
  if (pw !== pw2) return { error: 'Las dos contraseñas no coinciden.' };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/enlace-vencido');
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return { error: /reauth|aal2/i.test(error.message) ? 'Por seguridad, entra al panel con tu verificación en dos pasos y vuelve a intentarlo.' : 'No pudimos guardar la contraseña. Pide un enlace nuevo a un administrador.' };
  await sb.auth.signOut();
  redirect('/admin/acceso?activada=1');
}
