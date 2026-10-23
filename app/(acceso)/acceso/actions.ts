'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { EMAIL_OTP_LENGTH } from '@/lib/otp';

export interface CodeState { step: 'email' | 'code'; email?: string; error?: string; info?: string }
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function sendCodeAction(_: CodeState, form: FormData): Promise<CodeState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { step: 'email', email, error: 'Escribe un correo válido, por ejemplo nombre@empresa.mx.' };
  const sb = await supabaseServer();
  // shouldCreateUser:false → solo entran cuentas creadas por una invitación. Mismo mensaje exista o no la cuenta (sin enumeración).
  await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  return { step: 'code', email, info: `Si tu correo tiene un proyecto con Graphique, te llegó un código de ${EMAIL_OTP_LENGTH} dígitos. Vence en 10 minutos.` };
}

export async function verifyCodeAction(prev: CodeState, form: FormData): Promise<CodeState> {
  const email = String(form.get('email') ?? prev.email ?? '').trim().toLowerCase();
  const token = String(form.get('token') ?? '').replace(/\D/g, '');
  if (token.length !== EMAIL_OTP_LENGTH) return { step: 'code', email, error: `Faltan dígitos: el código tiene ${EMAIL_OTP_LENGTH}.` };
  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return { step: 'code', email, error: 'El código no coincide o ya venció. Revisa el último correo o pide uno nuevo.' };
  const next = String(form.get('next') ?? '');
  redirect(next.startsWith('/cliente') ? next : '/cliente');
}
