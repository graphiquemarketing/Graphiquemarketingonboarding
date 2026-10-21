import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/** Descarga con URL firmada de 60 s. RLS decide si el usuario puede leer el archivo (FIL-01). */
export async function GET(_: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return new NextResponse('No encontrado', { status: 404 });
  const sb = await supabaseServer();
  const { data: f } = await sb.from('files').select('storage_path, original_name, project_id').eq('id', fileId).maybeSingle();
  if (!f) return new NextResponse('No encontrado', { status: 404 });
  const { data, error } = await sb.storage.from('expedientes').createSignedUrl(f.storage_path, 60, { download: f.original_name });
  if (error || !data) return new NextResponse('No disponible', { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { 'Cache-Control': 'no-store' } });
}
