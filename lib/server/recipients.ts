import 'server-only';
import { supabaseAdmin } from '../supabase/server';

/** Correos del cliente para avisos: miembros del proyecto, contacto de M10 y del prospecto (sin duplicados). */
export async function clientRecipients(projectId: string): Promise<string[]> {
  const admin = supabaseAdmin();
  const out = new Set<string>();
  const { data: p } = await admin.from('projects').select('org_id').eq('id', projectId).single();
  if (p) {
    const { data: members } = await admin.from('organization_members').select('user_id').eq('org_id', p.org_id);
    for (const m of members ?? []) {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data.user?.email) out.add(data.user.email.toLowerCase());
    }
  }
  const { data: m10 } = await admin.from('answers').select('value').eq('project_id', projectId).eq('question_id', 'M10_Q01').maybeSingle();
  const c = (m10?.value as { correo?: string } | null)?.correo;
  if (c && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) out.add(c.toLowerCase());
  if (!out.size) {
    const { data: l } = await admin.from('lead_contacts').select('email').eq('project_id', projectId).maybeSingle();
    if (l?.email) out.add(l.email);
  }
  return [...out];
}
