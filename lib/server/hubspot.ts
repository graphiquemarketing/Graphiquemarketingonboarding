import 'server-only';

/**
 * Envío de la solicitud pública al formulario propio de HubSpot «Solicitud portal onboarding».
 * Se envía desde el servidor (sin CSP de por medio). Mismas reglas que el sitio comercial:
 * primera palabra → firstname, resto → lastname; 10 dígitos → +52; vacíos no se envían.
 * HubSpot rechaza TODO el envío (400) si llega una propiedad que no está en el formulario,
 * por eso se intenta en niveles: completo → campos del formulario → mínimo.
 * Nunca detiene el portal: si falla, solo queda en el log.
 */
export interface HubSpotLead {
  nombre: string; apellidos: string; empresa: string; correo: string; telefono: string;
  sitio?: string; paquete?: string; comentario?: string; hutk?: string; pageUri: string;
}

type Field = { name: string; value: string; objectTypeId?: string };

const CONTACT = '0-1';
const COMPANY = '0-2';

export function hubspotPhone(v: string): string {
  const d = v.replace(/\D/g, '');
  return d.length === 10 ? `+52 ${d}` : v.trim();
}

export async function sendPortalLeadToHubSpot(l: HubSpotLead): Promise<void> {
  const portalId = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;
  const formId = process.env.NEXT_PUBLIC_HUBSPOT_FORM_ID_PORTAL;
  if (!portalId || !formId) { console.warn('[HubSpot] sin NEXT_PUBLIC_HUBSPOT_PORTAL_ID / NEXT_PUBLIC_HUBSPOT_FORM_ID_PORTAL: no se envía'); return; }

  const f = (name: string, value: string | undefined, objectTypeId = CONTACT): Field | null =>
    value && value.trim() ? { objectTypeId, name, value: value.trim() } : null;

  const minimo = [f('firstname', l.nombre), f('lastname', l.apellidos), f('email', l.correo), f('phone', hubspotPhone(l.telefono))];
  const formulario = [...minimo, f('company', l.empresa), f('website', l.sitio, COMPANY)];
  const completo = [...formulario, f('paquete_de_interes', l.paquete), f('message', l.comentario)];
  const niveles: [string, (Field | null)[]][] = [['completo', completo], ['formulario', formulario], ['minimo', minimo]];

  const context: Record<string, string> = { pageUri: l.pageUri, pageName: 'Solicitud de propuesta · Portal Graphique' };
  if (l.hutk) context.hutk = l.hutk;
  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;

  for (const [nivel, campos] of niveles) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: campos.filter(Boolean),
          context,
          legalConsentOptions: { consent: { consentToProcess: true, text: 'Acepto el Aviso de Privacidad de Graphique Marketing.' } },
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) { if (nivel !== 'completo') console.warn(`[HubSpot] envío con campos de nivel «${nivel}»`); return; }
      const body = await r.text().catch(() => '');
      if (r.status !== 400) { console.error(`[HubSpot] error ${r.status}: ${body.slice(0, 300)}`); return; }
      console.warn(`[HubSpot] 400 en nivel «${nivel}»: ${body.slice(0, 300)}`);
    } catch (e) {
      console.error('[HubSpot] sin respuesta:', e instanceof Error ? e.message : e);
      return;
    }
  }
}
