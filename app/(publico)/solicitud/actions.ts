'use server';
import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isPackageCode } from '@/lib/catalog';
import { env } from '@/lib/env';
import { friendlyError } from '@/lib/errors';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendMail, templates, notifyInternal } from '@/lib/server/email';
import { sendPortalLeadToHubSpot } from '@/lib/server/hubspot';
import { PACKAGES } from '@/lib/catalog';

const schema = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(60),
  apellidos: z.string().trim().min(2, 'Escribe tus apellidos.').max(80),
  empresa: z.string().trim().min(1, 'Escribe el nombre de tu empresa.').max(200),
  correo: z.string().trim().toLowerCase().email('Revisa el correo: falta la @ o el dominio, por ejemplo nombre@empresa.mx.').max(254),
  telefono: z.string().trim().refine((v) => { const d = v.replace(/\D/g, ''); return d.length >= 10 && d.length <= 15; }, 'El teléfono debe tener 10 dígitos o más, con lada.'),
  sitio: z.string().trim().max(200).optional().default(''),
  comentario: z.string().trim().max(2000).optional().default(''),
  paquete: z.string().refine(isPackageCode, 'Elige un paquete.'),
  privacidad: z.literal('on', { errorMap: () => ({ message: 'Para enviar, acepta el Aviso de Privacidad.' }) }),
  cta: z.string().max(120).optional().default(''),
});

export interface SolicitudState { errors?: Record<string, string>; message?: string; values?: Record<string, string> }

export async function createRequestAction(_: SolicitudState, form: FormData): Promise<SolicitudState> {
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  // Antispam: campo trampa y tiempo mínimo de llenado.
  if (values.website2 || Date.now() - Number(values.t0 || 0) < 2500) return { message: 'No pudimos validar el envío. Espera unos segundos y vuelve a intentarlo.', values };
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors, values };
  }
  const d = parsed.data;
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'sin-ip';
  const ipHash = createHash('sha256').update(`${env.ipSalt()}:${ip}`).digest('hex');
  const utm: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) if (values[k]) utm[k] = values[k].slice(0, 100);
  const nombreCompleto = `${d.nombre} ${d.apellidos}`;
  const comentario = [d.sitio && `Sitio web: ${d.sitio}`, d.comentario].filter(Boolean).join('\n');
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc('create_request', {
    p_full_name: nombreCompleto, p_company: d.empresa, p_email: d.correo, p_phone: d.telefono, p_comment: comentario,
    p_package: d.paquete, p_source_cta: d.cta || null, p_utm: utm, p_ip_hash: ipHash,
  }).single<{ project_id: string; folio: string; duplicate: boolean }>();
  if (error || !data) return { message: friendlyError(error), values };
  // HubSpot «Solicitud portal onboarding»: si falla no detiene la solicitud (ya quedó guardada).
  await sendPortalLeadToHubSpot({
    nombre: d.nombre, apellidos: d.apellidos, empresa: d.empresa, correo: d.correo, telefono: d.telefono,
    sitio: d.sitio, paquete: PACKAGES[d.paquete as keyof typeof PACKAGES].name, comentario: d.comentario,
    hutk: (await cookies()).get('hubspotutk')?.value, pageUri: `${env.siteUrl()}/solicitud`,
  });
  if (!data.duplicate) {
    await sendMail({ kind: 'solicitud_recibida', to: d.correo, projectId: data.project_id, ...templates.solicitudRecibida(data.folio) });
    await notifyInternal('Nueva solicitud en el portal', data.folio, data.project_id);
  }
  redirect(`/solicitud/recibida?folio=${encodeURIComponent(data.folio)}&paquete=${d.paquete}`);
}
