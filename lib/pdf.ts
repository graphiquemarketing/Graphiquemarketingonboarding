/** 01_Resumen_Brief.pdf con pdf-lib (Helvetica, codificación WinAnsi: admite acentos y ñ). */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { PACKAGES } from './catalog';
import { MODULES, filled, labelFor, plainAnswer } from './questionnaire';
import { SCOPE_LABEL } from './scope';
import type { ApprovalSnapshot } from './export';

const MAGENTA = rgb(0xdd / 255, 0x17 / 255, 0x86 / 255);
const INK = rgb(0.12, 0.08, 0.13);
const MUTED = rgb(0.45, 0.4, 0.44);

/** Sustituye caracteres fuera de WinAnsi para que pdf-lib no falle. */
export function winAnsi(s: string): string {
  return s
    .replace(/[→]/g, '->').replace(/[•·]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ')
    .replace(/[^\x20-\x7E¡-ÿ\n]/g, '');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of winAnsi(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export async function briefPdf(s: ApprovalSnapshot, includeSensitive = true): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Resumen del brief ${s.folio} v${s.version}`);
  doc.setAuthor('Graphique Marketing');
  doc.setCreator('Portal de clientes Graphique');
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 50, CW = W - M * 2;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const need = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const text = (t: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = o.size ?? 10, font = o.font ?? reg;
    for (const l of wrap(t, font, size, CW)) { need(size + 4); page.drawText(l, { x: M, y: y - size, size, font, color: o.color ?? INK }); y -= size + 4; }
    y -= o.gap ?? 0;
  };
  const P = PACKAGES[s.package_code];
  text('GRAPHIQUE MARKETING · RESUMEN DEL BRIEF', { size: 9, font: bold, color: MAGENTA, gap: 6 });
  text(`${s.folio} · ${P.name}`, { size: 20, font: bold, gap: 4 });
  text(`Versión aprobada v${s.version} · ${s.approved_at.slice(0, 10)} · ${s.approved_by_label} · huella ${s.hash.slice(0, 16)}`, { size: 9, color: MUTED, gap: 2 });
  text(`Paquete ${P.name} (${P.limitLabel}) · catálogo ${s.package_version} · cuestionario ${s.questionnaire_version}`, { size: 9, color: MUTED, gap: 14 });
  for (const m of MODULES) {
    const rows = m.questions.filter((q) => (includeSensitive || !q.sensitive) && filled(s.answers[q.id]));
    if (!rows.length) continue;
    need(40);
    text(`${m.id} · ${m.title}`, { size: 12, font: bold, color: MAGENTA, gap: 4 });
    for (const q of rows) {
      text(labelFor(q, s.package_code), { size: 9.5, font: bold });
      text(plainAnswer(q, s.answers[q.id]), { size: 9.5, gap: 6 });
    }
    y -= 6;
  }
  need(40);
  text('Alcance contra el paquete contratado', { size: 12, font: bold, color: MAGENTA, gap: 4 });
  if (!s.scope.length) text('Sin partidas.', { size: 9.5, color: MUTED });
  for (const i of s.scope) text(`${i.id} · ${i.component} -> ${SCOPE_LABEL[i.classification]}${i.note ? ` (${i.note})` : ''}`, { size: 9.5, gap: 2 });
  y -= 10;
  text('Archivos del expediente', { size: 12, font: bold, color: MAGENTA, gap: 4 });
  if (!s.files.length) text('Sin archivos.', { size: 9.5, color: MUTED });
  for (const f of s.files) text(`${f.category} · ${f.original_name} · v${f.version} · ${(f.size_bytes / 1024).toFixed(0)} KB · ${f.status}`, { size: 9.5, gap: 2 });
  y -= 10;
  text('La aprobación del brief habilita la planeación técnica. No implica aceptación de diseño, contenidos o producción.', { size: 8.5, color: MUTED });
  return doc.save();
}
