import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/server/session';
import { getApprovals, getProject, toSnapshot } from '@/lib/server/data';
import { EXPORT_FILES, briefJson, claudeKickoffMd, inventoryCsv, scopeCsv, type ExportKind } from '@/lib/export';
import { briefPdf } from '@/lib/pdf';

export async function GET(_: Request, { params }: { params: Promise<{ id: string; version: string; kind: string }> }) {
  const { id, version, kind } = await params;
  if (!(kind in EXPORT_FILES)) return new NextResponse('No encontrado', { status: 404 });
  const { sb } = await requireStaff();
  const p = await getProject(sb, id);
  const a = (await getApprovals(sb, id)).find((x) => x.version === Number(version));
  if (!a) return new NextResponse('Versión no encontrada', { status: 404 });
  const s = toSnapshot(p, a);
  const k = kind as ExportKind;
  const body: string | Uint8Array =
    k === 'pdf' ? await briefPdf(s) : k === 'json' ? briefJson(s) : k === 'inventario' ? '﻿' + inventoryCsv(s) : k === 'matriz' ? '﻿' + scopeCsv(s) : claudeKickoffMd(s);
  await sb.rpc('record_export', { p_approval: a.id, p_kind: k });
  const name = `${p.folio}_v${a.version}_${EXPORT_FILES[k].name}`;
  return new NextResponse(body as BodyInit, {
    headers: { 'Content-Type': EXPORT_FILES[k].type, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
}
