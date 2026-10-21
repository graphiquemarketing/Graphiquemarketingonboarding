import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { env } from '@/lib/env';

async function out() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  return NextResponse.redirect(`${env.siteUrl()}/`, { status: 303 });
}
export const GET = out;
export const POST = out;
