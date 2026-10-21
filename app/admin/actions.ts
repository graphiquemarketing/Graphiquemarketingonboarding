'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/server/session';
import { getAnswers, getOverrides, getProject } from '@/lib/server/data';
import { isPackageCode } from '@/lib/catalog';
import { STATES, type ProjectState } from '@/lib/states';
import { PM_CLASSES, blocksApproval, scopeItems, type ScopeClass } from '@/lib/scope';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { env } from '@/lib/env';
import { sendMail, templates } from '@/lib/server/email';
import { clientRecipients } from '@/lib/server/recipients';

const done = (id: string, msg?: string): ActionResult => { revalidatePath(`/admin/proyectos/${id}`); return { ok: true, message: msg }; };

export async function transitionAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff();
  const to = String(form.get('to')) as ProjectState;
  if (!STATES.includes(to)) return { ok: false, error: 'Estado inválido.' };
  const { error } = await sb.rpc('transition_project', { p_project: id, p_to: to, p_note: String(form.get('note') ?? '') || null });
  return error ? { ok: false, error: friendlyError(error) } : done(id, 'Estado actualizado.');
}

export async function confirmContractAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['comercial']);
  const ref = String(form.get('reference') ?? '').trim();
  if (ref.length < 2) return { ok: false, error: 'Escribe el folio de la propuesta o del contrato.' };
  const { error } = await sb.rpc('confirm_contract', { p_project: id, p_reference: ref });
  return error ? { ok: false, error: friendlyError(error) } : done(id, 'Contratación confirmada. Ya puedes enviar la invitación.');
}

export async function changePackageAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['comercial']);
  const pkg = String(form.get('package'));
  if (!isPackageCode(pkg)) return { ok: false, error: 'Elige un paquete del catálogo.' };
  const { error } = await sb.rpc('change_package', { p_project: id, p_package: pkg });
  return error ? { ok: false, error: friendlyError(error) } : done(id, 'Paquete corregido.');
}

export async function inviteAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['comercial', 'pm']);
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const role = form.get('role') === 'colaborador' ? 'colaborador' : 'responsable';
  const { data: token, error } = await sb.rpc('create_invitation', { p_project: id, p_email: email, p_role: role });
  if (error || !token) return { ok: false, error: friendlyError(error) };
  const p = await getProject(sb, id);
  const sent = await sendMail({ kind: 'invitacion', to: email, projectId: id, ...templates.invitacion(p.organizations?.name ?? p.folio, `${env.siteUrl()}/invitacion/${token}`) });
  return sent ? done(id, `Invitación enviada a ${email}. Vence en 72 horas.`) : { ok: false, error: 'La invitación se creó pero el correo falló. Reenvíala en unos minutos.' };
}

export async function createManualAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['comercial']);
  const v = (k: string) => String(form.get(k) ?? '').trim();
  if (!isPackageCode(v('package'))) return { ok: false, error: 'Elige un paquete.' };
  const { data, error } = await sb.rpc('create_project_manual', {
    p_full_name: v('nombre'), p_company: v('empresa'), p_email: v('correo').toLowerCase(), p_phone: v('telefono'),
    p_comment: v('comentario') || null, p_package: v('package'), p_source: v('origen') === 'manual' ? 'manual' : 'hubspot',
  }).single<{ project_id: string; duplicate: boolean }>();
  if (error || !data) return { ok: false, error: friendlyError(error) };
  redirect(`/admin/proyectos/${data.project_id}${data.duplicate ? '?duplicado=1' : ''}`);
}

export async function setScopeAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['pm']);
  const key = String(form.get('key')); const cls = String(form.get('classification')) as ScopeClass;
  if (!PM_CLASSES.includes(cls)) return { ok: false, error: 'Clasificación inválida.' };
  const note = String(form.get('note') ?? '').trim();
  if (cls === 'ADICIONAL_APROBADA' && note.length < 3) return { ok: false, error: 'Para aprobar una ampliación registra la orden de cambio: alcance, costo y calendario.' };
  const { error } = await sb.rpc('set_scope', { p_project: id, p_item_key: key, p_class: cls, p_note: note || null });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/admin/proyectos/${id}/revision`);
  return { ok: true, message: 'Partida clasificada.' };
}

export async function clarifyAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['pm']);
  const mod = String(form.get('module')); const q = String(form.get('question') ?? '').trim();
  if (!/^M\d{2}$/.test(mod) || q.length < 3) return { ok: false, error: 'Elige el módulo y escribe la aclaración.' };
  const { error } = await sb.rpc('request_clarification', { p_project: id, p_module: mod, p_question: q });
  if (error) return { ok: false, error: friendlyError(error) };
  const p = await getProject(sb, id);
  for (const to of await clientRecipients(id)) await sendMail({ kind: 'aclaracion', to, projectId: id, ...templates.aclaracion(p.folio, mod, `${env.siteUrl()}/cliente/proyectos/${id}/aclaraciones`) });
  revalidatePath(`/admin/proyectos/${id}/revision`);
  return { ok: true, message: 'Aclaración enviada al cliente.' };
}

export async function reviewFileAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['pm']);
  const status = String(form.get('status'));
  if (!['APROBADO', 'REEMPLAZO_SOLICITADO', 'RECHAZADO'].includes(status)) return { ok: false, error: 'Estado inválido.' };
  const { error } = await sb.rpc('review_file', { p_file: String(form.get('file')), p_status: status, p_note: String(form.get('note') ?? '') || null });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/admin/proyectos/${id}/revision`);
  return { ok: true };
}

/** El alcance se recalcula aquí, en el servidor, desde la base de datos; nunca se toma del navegador. */
export async function approveAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireStaff(['pm']);
  if (form.get('confirm') !== 'on') return { ok: false, error: 'Marca la confirmación para aprobar.' };
  const p = await getProject(sb, id);
  const [{ answers }, overrides] = await Promise.all([getAnswers(sb, id), getOverrides(sb, id)]);
  const items = scopeItems(p.package_code, answers, overrides);
  if (blocksApproval(items)) return { ok: false, error: 'Hay partidas pendientes o ampliaciones sin decidir.' };
  const { data, error } = await sb.rpc('approve_brief', { p_project: id, p_scope: items }).single<{ version: number; hash: string }>();
  if (error || !data) return { ok: false, error: friendlyError(error) };
  for (const to of await clientRecipients(id)) await sendMail({ kind: 'brief_aprobado', to, projectId: id, ...templates.briefAprobado(p.folio, data.version) });
  redirect(`/admin/proyectos/${id}/exportar?aprobado=${data.version}`);
}

