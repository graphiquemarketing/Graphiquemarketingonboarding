import Link from 'next/link';
import { requireStaff } from '@/lib/server/session';
import { getProject } from '@/lib/server/data';
import { PACKAGES, PACKAGE_CODES } from '@/lib/catalog';
import { genericActions } from '@/lib/states';
import { Back, Note, StatePill, fmtDate } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionForm } from '../../ActionForm';
import { changePackageAction, confirmContractAction, inviteAction, transitionAction } from '../../actions';

export default async function Proyecto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicado?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { sb, staff } = await requireStaff();
  const p = await getProject(sb, id);
  const [{ data: lead }, { data: contract }, { data: audit }, { data: invites }] = await Promise.all([
    sb.from('lead_contacts').select('full_name, email, phone, comment').eq('project_id', id).maybeSingle(),
    sb.from('contracts').select('reference, confirmed_at').eq('project_id', id).maybeSingle(),
    sb.from('audit_logs').select('id, actor_label, action, detail, at').eq('project_id', id).order('at', { ascending: false }).limit(60),
    sb.from('invitations').select('email, role, expires_at, accepted_at, revoked_at, created_at').eq('project_id', id).order('created_at', { ascending: false }),
  ]);
  const P = PACKAGES[p.package_code];
  const actions = genericActions(p.state, staff.role);
  const preContract = ['SOLICITUD_RECIBIDA', 'CONTACTO_PENDIENTE', 'PROPUESTA_ENVIADA', 'CONTRATACION_PENDIENTE'].includes(p.state);
  const canInvite = ['CONTRATADO', 'INVITACION_PENDIENTE', 'BRIEF_EN_PROGRESO', 'INFORMACION_PENDIENTE'].includes(p.state) && staff.role !== 'admin_tecnico';
  const briefOpen = !preContract && p.state !== 'CONTRATADO' && p.state !== 'DESCARTADA';
  return (
    <div className="wrap stack">
      <Back href="/admin">Proyectos</Back>
      {sp.duplicado && <Note tone="warn">Ese correo ya tenía una solicitud abierta: este es su expediente.</Note>}
      <div className="row between"><div><span className="kicker mono">{p.folio}</span><h1>{p.organizations?.name}</h1></div><StatePill state={p.state} /></div>
      {briefOpen && (
        <nav className="row">
          <Link className="btn soft sm" href={`/admin/proyectos/${id}/revision`}>Revisión del brief</Link>
          {staff.role === 'pm' && p.state === 'EN_REVISION' && <Link className="btn soft sm" href={`/admin/proyectos/${id}/aprobacion`}>Aprobación</Link>}
          <Link className="btn soft sm" href={`/admin/proyectos/${id}/exportar`}>Expediente</Link>
        </nav>
      )}
      <div className="grid2">
        <div className="stack">
          <div className="panel stack">
            <h2>Proyecto</h2>
            <dl className="kv">
              <dt>Paquete</dt><dd>{P.name} · {P.priceLabel} · {P.limitLabel} (catálogo {p.package_version})</dd>
              <dt>Garantía</dt><dd>{P.warrantyDays} días correctiva · {P.rounds}</dd>
              <dt>Contacto</dt><dd>{lead ? `${lead.full_name} · ${lead.email} · ${lead.phone}` : '—'}</dd>
              {lead?.comment && <><dt>Comentario</dt><dd>{lead.comment}</dd></>}
              <dt>Origen</dt><dd>{p.source}{p.source_cta ? ` · CTA «${p.source_cta}»` : ''}</dd>
              <dt>Contrato</dt><dd>{contract ? `${contract.reference} · ${fmtDate(contract.confirmed_at)}` : 'Sin confirmar'}</dd>
            </dl>
            {actions.length > 0 && (
              <div className="row">
                {actions.map((t) => (
                  <ActionForm key={t.to} action={transitionAction.bind(null, id)} className="row">
                    <input type="hidden" name="to" value={t.to} />
                    <SubmitButton className={`btn sm${t.to === 'DESCARTADA' ? ' danger' : ''}`}>{t.label}</SubmitButton>
                  </ActionForm>
                ))}
              </div>
            )}
            {staff.role === 'comercial' && p.state === 'CONTRATACION_PENDIENTE' && (
              <ActionForm action={confirmContractAction.bind(null, id)}>
                <div className="field"><label htmlFor="c_ref">Folio de propuesta o contrato <span className="req">*</span></label>
                  <input id="c_ref" name="reference" required maxLength={80} placeholder="PRO-2026-118" /><p className="help">Queda en la auditoría. Sin folio no se confirma.</p></div>
                <div><SubmitButton pending="Confirmando…">Confirmar contratación</SubmitButton></div>
              </ActionForm>
            )}
            {staff.role === 'comercial' && preContract && (
              <ActionForm action={changePackageAction.bind(null, id)} className="row">
                <label className="sr" htmlFor="c_pkg">Corregir paquete</label>
                <select id="c_pkg" name="package" defaultValue={p.package_code} style={{ maxWidth: 260 }}>{PACKAGE_CODES.map((k) => <option key={k} value={k}>{PACKAGES[k].name}</option>)}</select>
                <SubmitButton className="btn soft sm">Corregir paquete</SubmitButton>
              </ActionForm>
            )}
          </div>
          {canInvite && (
            <div className="panel stack">
              <h2>Invitación al portal</h2>
              <ActionForm action={inviteAction.bind(null, id)}>
                <div className="fgrid">
                  <div className="field"><label htmlFor="i_mail">Correo</label><input id="i_mail" name="email" type="email" defaultValue={lead?.email ?? ''} required /></div>
                  <div className="field"><label htmlFor="i_role">Rol</label><select id="i_role" name="role"><option value="responsable">Responsable (envía el brief)</option><option value="colaborador">Colaborador (edita y sube archivos)</option></select></div>
                </div>
                <div><SubmitButton pending="Enviando…">Enviar invitación</SubmitButton></div>
                <p className="help">El enlace vence en 72 horas y solo funciona con ese correo. Enviar otra invitación al mismo correo invalida la anterior.</p>
              </ActionForm>
              {(invites ?? []).length > 0 && (
                <ul className="files">{(invites ?? []).map((i, k) => (
                  <li key={k}><span>{i.email} · {i.role}<br /><span className="small muted">{fmtDate(i.created_at)}</span></span>
                    <span className={`pill tone-${i.accepted_at ? 'ok' : i.revoked_at || new Date(i.expires_at) < new Date() ? 'na' : 'work'}`}>{i.accepted_at ? 'Aceptada' : i.revoked_at ? 'Reemplazada' : new Date(i.expires_at) < new Date() ? 'Vencida' : 'Vigente'}</span></li>
                ))}</ul>
              )}
            </div>
          )}
        </div>
        <aside className="panel stack">
          <h3>Auditoría</h3>
          <ul className="log">{(audit ?? []).map((a) => <li key={a.id}><b>{a.action}</b> {a.detail?.de ? `${a.detail.de} → ${a.detail.a}` : ''}<br /><span className="muted">{a.actor_label} · {fmtDate(a.at)}</span></li>)}</ul>
        </aside>
      </div>
    </div>
  );
}
