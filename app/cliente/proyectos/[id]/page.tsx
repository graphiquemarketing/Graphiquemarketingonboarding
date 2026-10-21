import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { getApprovals, getProject, getReviews } from '@/lib/server/data';
import { PACKAGES } from '@/lib/catalog';
import { NEXT_STEP } from '@/lib/states';
import { Back, Note, StatePill, Timeline, fmtDate } from '@/components/ui';
import { ProjectNav } from '@/components/ProjectNav';
import { Track } from '@/components/Track';

export default async function Expediente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enviado?: string; respondido?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { sb } = await requireClient(`/cliente/proyectos/${id}`);
  const p = await getProject(sb, id);
  const [approvals, reviews] = await Promise.all([getApprovals(sb, id), getReviews(sb, id)]);
  const open = reviews.filter((r) => !r.answered_at).length;
  return (
    <div className="wrap stack">
      {sp.enviado && <Track event="onboarding_brief_submit" params={{ paquete: p.package_code }} dedupe={`submit:${id}`} />}
      <Back href="/cliente">Mis proyectos</Back>
      <div className="row between"><div><span className="kicker mono">{p.folio}</span><h1>{p.organizations?.name}</h1></div><StatePill state={p.state} /></div>
      <ProjectNav id={id} current="Estado" pendingReviews={open} />
      {sp.enviado && <Note tone="ok">Recibimos tu brief. Te enviamos un acuse por correo.</Note>}
      {sp.respondido && <Note tone="ok">Enviamos tus respuestas a Graphique.</Note>}
      <div className="grid2">
        <div className="panel stack">
          <h2>Estado del expediente</h2>
          <Timeline state={p.state} />
          {NEXT_STEP[p.state] && <Note>Qué sigue: {NEXT_STEP[p.state]}</Note>}
          {p.state === 'BRIEF_EN_PROGRESO' && <div><Link className="btn" href={`/cliente/proyectos/${id}/brief/M01`}>Continuar brief</Link></div>}
          {open > 0 && <div><Link className="btn" href={`/cliente/proyectos/${id}/aclaraciones`}>Responder {open} aclaración{open === 1 ? '' : 'es'}</Link></div>}
        </div>
        <aside className="panel stack">
          <h3>Tu paquete</h3>
          <dl className="kv small"><dt>Paquete</dt><dd>{PACKAGES[p.package_code].name}</dd><dt>Alcance base</dt><dd>{PACKAGES[p.package_code].limitLabel}</dd>
            <dt>Garantía</dt><dd>{PACKAGES[p.package_code].warrantyDays} días correctiva</dd></dl>
          <h3>Versiones aprobadas</h3>
          {approvals.length ? <ul className="files">{approvals.map((a) => <li key={a.id}><span>Versión {a.version}<br /><span className="small muted">{fmtDate(a.approved_at)}</span></span><span className="pill tone-ok">Aprobada</span></li>)}</ul>
            : <p className="small muted">Aún no hay versiones aprobadas.</p>}
        </aside>
      </div>
    </div>
  );
}
