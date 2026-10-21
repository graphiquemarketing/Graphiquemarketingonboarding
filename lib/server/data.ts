import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { PackageCode } from '../catalog';
import type { ProjectState } from '../states';
import type { Answers } from '../questionnaire';
import type { ScopeOverride } from '../scope';
import type { ApprovalSnapshot } from '../export';

export interface ProjectRow {
  id: string; folio: string; org_id: string; package_code: PackageCode; package_version: string; questionnaire_version: string;
  state: ProjectState; source: string; source_cta: string | null; created_at: string; updated_at: string;
  organizations: { name: string } | null;
}
export interface FileRow {
  id: string; file_key: string; version: number; category: string; original_name: string; storage_path: string;
  mime: string; size_bytes: number; status: string; uploaded_at: string; review_note: string | null;
}
export interface ReviewRow { id: string; module: string; question: string; created_at: string; answer: string | null; answered_at: string | null }
export interface ApprovalRow {
  id: string; project_id: string; version: number; approved_by_label: string; approved_at: string; package_code: PackageCode;
  package_version: string; questionnaire_version: string; answers: Answers; scope: ApprovalSnapshot['scope']; files: ApprovalSnapshot['files']; hash: string;
}

const PROJECT_COLS = 'id, folio, org_id, package_code, package_version, questionnaire_version, state, source, source_cta, created_at, updated_at, organizations(name)';

export async function listProjects(sb: SupabaseClient): Promise<ProjectRow[]> {
  const { data, error } = await sb.from('projects').select(PROJECT_COLS).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as ProjectRow[];
}

/** RLS decide: si el usuario no puede leer el proyecto, la consulta regresa vacío → 404 (no se revela su existencia). */
export async function getProject(sb: SupabaseClient, id: string): Promise<ProjectRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await sb.from('projects').select(PROJECT_COLS).eq('id', id).maybeSingle();
  if (!data) notFound();
  return data as unknown as ProjectRow;
}

export async function getAnswers(sb: SupabaseClient, projectId: string): Promise<{ answers: Answers; revisions: Record<string, number> }> {
  const { data, error } = await sb.from('answers').select('question_id, value, revision').eq('project_id', projectId);
  if (error) throw error;
  const answers: Answers = {}; const revisions: Record<string, number> = {};
  for (const r of data ?? []) { answers[r.question_id] = r.value; revisions[r.question_id] = r.revision; }
  return { answers, revisions };
}

export async function getFiles(sb: SupabaseClient, projectId: string): Promise<FileRow[]> {
  const { data, error } = await sb.from('files').select('id, file_key, version, category, original_name, storage_path, mime, size_bytes, status, uploaded_at, review_note')
    .eq('project_id', projectId).neq('status', 'PENDIENTE_CARGA').order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

/** Última versión de cada archivo lógico. */
export function latestFiles(files: FileRow[]): FileRow[] {
  const m = new Map<string, FileRow>();
  for (const f of files) { const c = m.get(f.file_key); if (!c || f.version > c.version) m.set(f.file_key, f); }
  return [...m.values()];
}

export async function getReviews(sb: SupabaseClient, projectId: string): Promise<ReviewRow[]> {
  const { data, error } = await sb.from('review_requests').select('id, module, question, created_at, answer, answered_at').eq('project_id', projectId).order('created_at');
  if (error) throw error;
  return (data ?? []) as ReviewRow[];
}

export async function getOverrides(sb: SupabaseClient, projectId: string): Promise<ScopeOverride[]> {
  const { data, error } = await sb.from('scope_overrides').select('item_key, classification, note').eq('project_id', projectId);
  if (error) throw error;
  return (data ?? []) as ScopeOverride[];
}

export async function getApprovals(sb: SupabaseClient, projectId: string): Promise<ApprovalRow[]> {
  const { data, error } = await sb.from('approvals').select('*').eq('project_id', projectId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApprovalRow[];
}

export function toSnapshot(p: ProjectRow, a: ApprovalRow): ApprovalSnapshot {
  return {
    project_id: p.id, folio: p.folio, version: a.version, approved_at: a.approved_at, approved_by_label: a.approved_by_label,
    package_code: a.package_code, package_version: a.package_version, questionnaire_version: a.questionnaire_version,
    answers: a.answers, scope: a.scope, files: a.files, hash: a.hash,
  };
}
