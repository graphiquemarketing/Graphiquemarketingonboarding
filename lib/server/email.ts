import 'server-only';
import { env } from '../env';
import { supabaseAdmin } from '../supabase/server';

/**
 * Correos transaccionales (sección 12). Cada envío queda en public.notifications.
 * Sin RESEND_API_KEY (staging) el correo no sale: se registra como ENVIADO con la marca «simulado» y se imprime en el log.
 * Nunca se incluyen tokens de sesión ni archivos; el único enlace con token es la invitación (72 h, un solo uso).
 */
export type EmailKind = 'solicitud_recibida' | 'invitacion' | 'brief_enviado' | 'aclaracion' | 'brief_aprobado' | 'interno';

interface Mail { kind: EmailKind; to: string; subject: string; text: string; projectId?: string }

const SIGN = '\n\nGraphique Marketing · Estrategia que impulsa negocios.\ncontacto@graphiquemarketing.com.mx · +52 56 1073 7562';

export const templates = {
  solicitudRecibida: (folio: string) => ({
    subject: `Recibimos tu solicitud · ${folio}`,
    text: `Gracias por escribirnos. Tu folio es ${folio}.\n\nEsto no es una contratación ni fija un precio. Siguientes pasos:\n1. Te contactamos para entender tu proyecto.\n2. Te enviamos una propuesta.\n3. Si se confirma la contratación, recibirás una invitación al portal de clientes.${SIGN}`,
  }),
  invitacion: (org: string, url: string) => ({
    subject: `Tu portal de proyecto con Graphique · ${org}`,
    text: `Tu proyecto con Graphique Marketing está contratado. Entra al portal para completar el brief y subir tus archivos:\n\n${url}\n\nEl enlace vence en 72 horas y solo funciona con este correo. Si vence, pide uno nuevo respondiendo este mensaje.${SIGN}`,
  }),
  briefEnviado: (folio: string) => ({
    subject: `Recibimos tu brief · ${folio}`,
    text: `Tu brief llegó a Graphique y está en revisión. Te escribiremos si necesitamos aclarar algo.${SIGN}`,
  }),
  aclaracion: (folio: string, modulo: string, url: string) => ({
    subject: `Graphique necesita una aclaración · ${folio}`,
    text: `Tenemos una pregunta sobre el módulo ${modulo} de tu brief. Respóndela en el portal:\n\n${url}${SIGN}`,
  }),
  briefAprobado: (folio: string, version: number) => ({
    subject: `Tu brief está aprobado · ${folio}`,
    text: `Aprobamos la versión ${version} de tu brief. El siguiente paso es la planeación técnica; te contactaremos con el calendario.\n\nLa aprobación del brief no sustituye la aprobación de diseño ni de contenidos finales.${SIGN}`,
  }),
  interno: (titulo: string, folio: string, url: string) => ({
    subject: `[Portal] ${titulo} · ${folio}`,
    text: `${titulo}: ${folio}\n${url}`,
  }),
};

export async function sendMail(m: Mail): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data: row } = await admin.from('notifications')
    .insert({ project_id: m.projectId ?? null, kind: m.kind, to_email: m.to, payload: { subject: m.subject } }).select('id').single();
  const key = env.resendKey();
  if (!key) {
    console.info(`[correo simulado] ${m.kind} → ${m.to}: ${m.subject}`);
    if (row) await admin.from('notifications').update({ status: 'ENVIADO', sent_at: new Date().toISOString(), last_error: 'simulado (sin RESEND_API_KEY)' }).eq('id', row.id);
    return true;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': row?.id ?? `${m.kind}-${m.to}-${Date.now()}` },
        body: JSON.stringify({ from: env.emailFrom(), to: [m.to], subject: m.subject, text: m.text }),
      });
      if (res.ok) {
        if (row) await admin.from('notifications').update({ status: 'ENVIADO', attempts: attempt, sent_at: new Date().toISOString() }).eq('id', row.id);
        return true;
      }
      throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } catch (e) {
      if (row) await admin.from('notifications').update({ status: 'ERROR', attempts: attempt, last_error: String(e).slice(0, 500) }).eq('id', row.id);
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 500));
    }
  }
  return false;
}

/** Aviso al equipo interno (EMAIL_INTERNAL). */
export async function notifyInternal(titulo: string, folio: string, projectId: string) {
  const to = env.emailInternal();
  if (!to) return;
  const t = templates.interno(titulo, folio, `${env.siteUrl()}/admin/proyectos/${projectId}`);
  await sendMail({ kind: 'interno', to, projectId, ...t });
}
