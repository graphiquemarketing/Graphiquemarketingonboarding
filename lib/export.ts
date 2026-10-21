/**
 * Expediente exportable de una versión aprobada (sección 15 del brief).
 * Todo sale del snapshot congelado en public.approvals, nunca de las respuestas vivas (EXP-01).
 */
import { PACKAGES, CATALOG_VERSION, type PackageCode } from './catalog';
import { MODULES, QUESTIONS, UNKNOWN, filled, labelFor, plainAnswer, type Answers } from './questionnaire';
import { SCOPE_LABEL, type ScopeItem } from './scope';

export interface FileManifestRow {
  file_key: string; version: number; category: string; original_name: string; mime: string; size_bytes: number; status: string;
}

export interface ApprovalSnapshot {
  project_id: string;
  folio: string;
  version: number;
  approved_at: string;
  approved_by_label: string;
  package_code: PackageCode;
  package_version: string;
  questionnaire_version: string;
  answers: Answers;
  scope: ScopeItem[];
  files: FileManifestRow[];
  hash: string;
}

/** Preguntas que nunca salen al expediente para IA. */
export function exportableQuestionIds(): string[] {
  return Object.values(QUESTIONS).filter((q) => !q.sensitive).map((q) => q.id);
}

export function briefJson(s: ApprovalSnapshot): string {
  const keep = new Set(exportableQuestionIds());
  return JSON.stringify({
    project_id: s.folio,
    package_code: s.package_code,
    package_version: s.package_version || CATALOG_VERSION,
    questionnaire_version: s.questionnaire_version,
    brief_version: s.version,
    status: 'BRIEF_APROBADO',
    approved_at: s.approved_at,
    approved_by: s.approved_by_label,
    revision_hash: s.hash,
    answers: Object.entries(s.answers)
      .filter(([k, v]) => keep.has(k) && filled(v))
      .map(([k, v]) => ({ question_id: k, module: QUESTIONS[k].module, value: v === UNKNOWN ? 'NO_LO_SE' : v })),
    excluded: Object.keys(s.answers).filter((k) => QUESTIONS[k] && !keep.has(k)),
    scope_items: s.scope.map((i) => ({ id: i.id, key: i.key, component: i.component, classification: i.classification, source: i.source })),
    file_manifest: s.files.map((f) => ({ file_key: f.file_key, category: f.category, version: f.version, type: f.mime, size_bytes: f.size_bytes, status: f.status })),
  }, null, 2);
}

export function csvCell(v: unknown): string {
  const s = String(v ?? '');
  // Evita inyección de fórmulas al abrir en Excel.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function inventoryCsv(s: ApprovalSnapshot): string {
  const head = 'file_key,categoria,nombre,version,tipo,tamano_bytes,estado';
  return [head, ...s.files.map((f) => [f.file_key, f.category, f.original_name, f.version, f.mime, f.size_bytes, f.status].map(csvCell).join(','))].join('\n') + '\n';
}

export function scopeCsv(s: ApprovalSnapshot): string {
  const head = 'id,componente,clasificacion,motivo,nota,responsable,aceptacion,estado';
  return [head, ...s.scope.map((i) => [i.id, i.component, SCOPE_LABEL[i.classification], i.reason, i.note ?? '', 'Por asignar', 'Por definir en planeación', `Aprobado v${s.version}`].map(csvCell).join(','))].join('\n') + '\n';
}

export function claudeKickoffMd(s: ApprovalSnapshot): string {
  const P = PACKAGES[s.package_code];
  const keep = new Set(exportableQuestionIds());
  const ctx = MODULES.map((m) => {
    const rows = m.questions.filter((q) => keep.has(q.id) && filled(s.answers[q.id]))
      .map((q) => `- ${labelFor(q, s.package_code)}: ${plainAnswer(q, s.answers[q.id])}`);
    return rows.length ? `### ${m.id} · ${m.title}\n${rows.join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
  const unknowns = Object.entries(s.answers).filter(([, v]) => v === UNKNOWN).map(([k]) => `- ${k}`);
  return `# Arranque Claude · ${s.folio}

- Paquete: ${P.name} (${s.package_code}, catálogo ${s.package_version}) · límite: ${P.limitLabel} · garantía correctiva ${P.warrantyDays} días
- Brief aprobado: v${s.version} · ${s.approved_at.slice(0, 10)} · ${s.approved_by_label} · huella ${s.hash}
- Cuestionario: ${s.questionnaire_version}

## Contexto validado
${ctx || '_Sin respuestas exportables._'}

## Alcance
${s.scope.map((i) => `- ${i.id} · ${i.component} → **${SCOPE_LABEL[i.classification]}**${i.note ? ` (${i.note})` : ''}`).join('\n') || '- Sin partidas.'}

## Pendientes «No lo sé»
${unknowns.join('\n') || '- Ninguno.'}

## Restricciones
- Ejecutar solo partidas «Incluida» o «Adicional aprobada».
- No acceder a archivos fuera del manifiesto ni pedir contraseñas.
- Los datos de contacto y la información confidencial del cliente no forman parte de este expediente.
- Lo marcado «No lo sé» se resuelve con Graphique antes de desarrollar.

## Orden de trabajo
Aplicar el Prompt Maestro 3.0 sobre este expediente: arquitectura → contenidos → diseño → desarrollo → QA.
`;
}

/** Huella SHA-256 estable de un objeto (claves ordenadas). */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

export const EXPORT_FILES = {
  pdf: { name: '01_Resumen_Brief.pdf', type: 'application/pdf' },
  json: { name: '02_Brief_Estructurado.json', type: 'application/json' },
  inventario: { name: '03_Inventario_Archivos.csv', type: 'text/csv; charset=utf-8' },
  matriz: { name: '04_Matriz_Alcance.csv', type: 'text/csv; charset=utf-8' },
  claude: { name: '05_Arranque_Claude.md', type: 'text/markdown; charset=utf-8' },
} as const;
export type ExportKind = keyof typeof EXPORT_FILES;
