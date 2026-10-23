import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/** Enlace de activación o recuperación del equipo: valida el token de un solo uso y lleva a crear la contraseña. */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash') ?? '';
  const base = env.siteUrl();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(tokenHash)) return NextResponse.redirect(`${base}/enlace-vencido`, 303);
  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  if (error) return NextResponse.redirect(`${base}/enlace-vencido`, 303);
  return NextResponse.redirect(`${base}/cuenta/contrasena`, 303);
}
