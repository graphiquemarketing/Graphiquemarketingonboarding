'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/server/session';
import { getAnswers, getProject } from '@/lib/server/data';
import { QUESTIONS, missingRequired, sanitizeAnswer } from '@/lib/questionnaire';
import { checkFile, FILE_CATEGORIES } from '@/lib/files';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { sendMail, templates, notifyInternal } from '@/lib/server/email';
import { clientRecipients } from '@/lib/server/recipients';

export async function saveAnswerAction(projectId: string, questionId: string, value: unknown, expected: number | null)
  : Promise<ActionResult<{ revision: number; value: unknown }> & { conflict?: boolean; fatal?: boolean }> {
  const { sb } = await requireClient();
  const q = QUESTIONS[questionId];
  if (!q) return { ok: false, error: 'Esa pregunta no existe.' };
  const { answers } = await getAnswers(sb, projectId);
  const clean = sanitizeAnswer(q, value, { ...answers, [questionId]: value });
  const { data, error } = await sb.rpc('save_answer', { p_project: projectId, p_question: questionId, p_value: clean ?? null, p_expected_revision: expected });
  // fatal = error de negocio: reintentar no sirve (evita bucles que agotan el pool de conexiones).
  if (error) return { ok: false, error: friendlyError(error), conflict: error.message.includes('CONFLICTO'), fatal: /BRIEF_BLOQUEADO|SIN_PERMISO|PREGUNTA_INVALIDA|RESPUESTA_DEMASIADO_LARGA/.test(error.message) };
  return { ok: true, data: { revision: data as number, value: clean } };
}

export async function submitBriefAction(projectId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireClient();
  if (form.get('confirm') !== 'on') return { ok: false, error: 'Marca la confirmación para enviar.' };
  const p = await getProject(sb, projectId);
  const { answers } = await getAnswers(sb, projectId);
  const miss = missingRequired(p.package_code, answers);
  if (miss.length) return { ok: false, error: `Faltan ${miss.length} pregunta(s) obligatoria(s).` };
  const { error } = await sb.rpc('submit_brief', { p_project: projectId });
  if (error) return { ok: false, error: friendlyError(error) };
  for (const to of await clientRecipients(projectId)) await sendMail({ kind: 'brief_enviado', to, projectId, ...templates.briefEnviado(p.folio) });
  await notifyInternal('Brief enviado para revisión', p.folio, projectId);
  revalidatePath(`/cliente/proyectos/${projectId}`);
  redirect(`/cliente/proyectos/${projectId}?enviado=1`);
}

export async function answerClarificationsAction(projectId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { sb } = await requireClient();
  const answers: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith('r_')) answers[k.slice(2)] = String(v).trim();
  if (Object.values(answers).some((v) => !v)) return { ok: false, error: 'Responde todas las aclaraciones antes de enviarlas.' };
  const { error } = await sb.rpc('answer_clarifications', { p_project: projectId, p_answers: answers });
  if (error) return { ok: false, error: friendlyError(error) };
  const p = await getProject(sb, projectId);
  await notifyInternal('Aclaraciones respondidas', p.folio, projectId);
  revalidatePath(`/cliente/proyectos/${projectId}`);
  redirect(`/cliente/proyectos/${projectId}?respondido=1`);
}

export async function registerFileAction(projectId: string, input: { fileKey: string | null; category: string; name: string; size: number; mime: string })
  : Promise<ActionResult<{ fileId: string; path: string; mime: string }>> {
  const { sb } = await requireClient();
  if (!(FILE_CATEGORIES as readonly string[]).includes(input.category)) return { ok: false, error: 'Elige una categoría.' };
  const c = checkFile(input.name, input.size, input.mime);
  if (!c.ok) return { ok: false, error: c.error };
  const { data, error } = await sb.rpc('register_file', {
    p_project: projectId, p_file_key: input.fileKey, p_category: input.category, p_original_name: input.name, p_ext: c.ext, p_mime: c.mime, p_size: input.size,
  }).single<{ file_id: string; storage_path: string; version: number }>();
  if (error || !data) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: { fileId: data.file_id, path: data.storage_path, mime: c.mime } };
}

export async function confirmFileAction(projectId: string, fileId: string): Promise<ActionResult> {
  const { sb } = await requireClient();
  const { error } = await sb.rpc('confirm_file', { p_file: fileId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/cliente/proyectos/${projectId}/archivos`);
  return { ok: true };
}
