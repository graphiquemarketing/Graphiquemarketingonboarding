/**
 * Matriz comercial-técnica: clasifica lo que el cliente pidió contra el paquete contratado.
 * Las partidas se recalculan desde las respuestas; las decisiones del PM se guardan en
 * public.scope_overrides por item_key estable y se congelan al aprobar.
 */
import { PACKAGES, type FunctionKey, type PackageCode } from './catalog';
import { QUESTIONS, filled, type Answers } from './questionnaire';

export const SCOPE_CLASSES = ['INCLUIDA', 'NO_INCLUIDA', 'PENDIENTE', 'ADICIONAL', 'ADICIONAL_APROBADA', 'NO_APLICA'] as const;
export type ScopeClass = (typeof SCOPE_CLASSES)[number];

export const SCOPE_LABEL: Record<ScopeClass, string> = {
  INCLUIDA: 'Incluida', NO_INCLUIDA: 'No incluida', PENDIENTE: 'Pendiente',
  ADICIONAL: 'Solicitud de ampliación', ADICIONAL_APROBADA: 'Adicional aprobada', NO_APLICA: 'No aplica',
};

/** Clases que el PM puede asignar (ADICIONAL lo asigna solo el sistema). */
export const PM_CLASSES: ScopeClass[] = ['INCLUIDA', 'NO_INCLUIDA', 'PENDIENTE', 'ADICIONAL_APROBADA', 'NO_APLICA'];

/** Clases que bloquean la aprobación. */
export const BLOCKING: ScopeClass[] = ['PENDIENTE', 'ADICIONAL'];

export interface ScopeOverride { item_key: string; classification: ScopeClass; note: string | null; decided_by_label?: string | null }

export interface ScopeItem {
  key: string;
  id: string;
  component: string;
  auto: ScopeClass;
  classification: ScopeClass;
  reason: string;
  source: string;
  note: string | null;
}

export function classifyFunction(pkg: PackageCode, f: FunctionKey): ScopeClass {
  const P = PACKAGES[pkg];
  if (P.included.includes(f)) return 'INCLUIDA';
  if (P.conditional === '*' || P.conditional.includes(f)) return 'PENDIENTE';
  return 'ADICIONAL';
}

export function functionLabel(f: string): string {
  return QUESTIONS.M08_Q01.keyedOptions!.find((o) => o.key === f)?.label ?? f;
}

export function scopeItems(pkg: PackageCode, a: Answers, overrides: ScopeOverride[] = []): ScopeItem[] {
  const P = PACKAGES[pkg];
  const ov = new Map(overrides.map((o) => [o.item_key, o]));
  const raw: Omit<ScopeItem, 'id' | 'classification' | 'note'>[] = [];
  const pages = Array.isArray(a.M07_Q01) ? (a.M07_Q01 as string[]) : [];
  if (pages.length) {
    if (P.max && pages.length > P.max) {
      raw.push({ key: 'pages:included', component: `${P.max} ${P.unit} dentro del límite: ${pages.slice(0, P.max).join(', ')}`, auto: 'INCLUIDA', reason: `Límite del paquete: ${P.limitLabel}`, source: 'M07_Q01' });
      raw.push({ key: 'pages:extra', component: `${pages.length - P.max} ${P.unit} adicionales: ${pages.slice(P.max).join(', ')}`, auto: 'ADICIONAL', reason: `Excede el límite de ${P.limitLabel}`, source: 'M07_Q01' });
    } else {
      raw.push({ key: 'pages:included', component: `${pages.length} ${P.unit}: ${pages.join(', ')}`, auto: P.max ? 'INCLUIDA' : 'PENDIENTE', reason: P.max ? `Dentro de ${P.limitLabel}` : 'Según contrato', source: 'M07_Q01' });
    }
  }
  for (const f of (Array.isArray(a.M08_Q01) ? (a.M08_Q01 as FunctionKey[]) : [])) {
    const c = classifyFunction(pkg, f);
    raw.push({ key: `fn:${f}`, component: `Función: ${functionLabel(f)}`, auto: c, source: 'M08_Q01',
      reason: c === 'INCLUIDA' ? `Incluida en ${P.name}` : c === 'PENDIENTE' ? (pkg === 'TURNKEY' ? 'Según contrato' : 'Solo si está contratada expresamente') : `No forma parte de ${P.name}` });
  }
  if (filled(a.M08_Q03) && (!QUESTIONS.M08_Q03.packages || QUESTIONS.M08_Q03.packages.includes(pkg))) {
    raw.push({ key: 'special', component: `Proceso especial: ${String(a.M08_Q03).slice(0, 120)}`, auto: 'PENDIENTE', reason: 'Requiere clasificación de Graphique', source: 'M08_Q03' });
  }
  if (a.M09_Q04 === 'Sí' && QUESTIONS.M09_Q04.packages!.includes(pkg)) {
    raw.push({ key: 'migration', component: 'Migración de datos o contenidos', auto: 'PENDIENTE', reason: 'Se valida contra contrato', source: 'M09_Q04' });
  }
  return raw.map((r, i) => {
    const o = ov.get(r.key);
    return { ...r, id: `REQ-${String(i + 1).padStart(3, '0')}`, classification: o?.classification ?? r.auto, note: o?.note ?? null };
  });
}

export function blocksApproval(items: ScopeItem[]): boolean {
  return items.some((i) => BLOCKING.includes(i.classification));
}
