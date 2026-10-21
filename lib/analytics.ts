/**
 * Eventos de la sección 13 del brief. Solo se permiten parámetros sin datos personales.
 * El portal vive en otro subdominio: el consentimiento del sitio (localStorage) no se comparte,
 * así que GTM solo se carga si NEXT_PUBLIC_GTM_ID existe y el visitante acepta en el portal.
 */
export const EVENTS = [
  'package_cta_click', 'onboarding_request_start', 'onboarding_request_submit', 'onboarding_invitation_accepted',
  'onboarding_brief_start', 'onboarding_step_complete', 'onboarding_brief_submit', 'onboarding_brief_approved',
] as const;
export type EventName = (typeof EVENTS)[number];

const ALLOWED_PARAMS = new Set(['paquete', 'modulo', 'idioma']);
const PII = /@|\d{7,}|https?:\/\//;

export function cleanParams(p: Record<string, unknown> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (!ALLOWED_PARAMS.has(k)) continue;
    const s = String(v ?? '').slice(0, 40);
    if (!s || PII.test(s)) continue;
    out[k] = s;
  }
  return out;
}

declare global { interface Window { dataLayer?: Record<string, unknown>[] } }

const sent = new Set<string>();
/** Envía un evento al dataLayer una sola vez por clave de deduplicación. */
export function track(event: EventName, params: Record<string, unknown> = {}, dedupeKey?: string) {
  if (typeof window === 'undefined') return;
  const key = dedupeKey ?? `${event}:${JSON.stringify(params)}`;
  if (sent.has(key)) return;
  try { if (sessionStorage.getItem(`ev:${key}`)) return; sessionStorage.setItem(`ev:${key}`, '1'); } catch { /* sin almacenamiento */ }
  sent.add(key);
  (window.dataLayer = window.dataLayer || []).push({ event, ...cleanParams(params) });
}
