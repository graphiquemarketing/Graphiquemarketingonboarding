import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { getAnswers, getApprovals, getFiles, getProject, getReviews, latestFiles } from '@/lib/server/data';
import { PACKAGES } from '@/lib/catalog';
import { NEXT_STEP } from '@/lib/states';
import { progress } from '@/lib/questionnaire';
import { Note, PageHead, StatePill, Timeline, fmtDate } from '@/components/ui';
import { ProjectNav } from '@/components/ProjectNav';
import { Track } from '@/components/Track';
import { Ring } from '@/components/Ring';
import { Icon } from '@/components/Icon';

export default async function Expediente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enviado?: string; respondido?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { sb } = await requireClient(`/cliente/proyectos/${id}`);
  const p = await getProject(sb, id);
  const [approvals, reviews, { answers }, files] = await Promise.all([getApprovals(sb, id), getReviews(sb, id), getAnswers(sb, id), getFiles(sb, id)]);
  const open = reviews.filter((r) => !r.answered_at).length;
  const pct = progress(p.package_code, answers);
  const P = PACKAGES[p.package_code];
  return (
    <div className="wrap stack" style={{ gap: 22 }}>
      {sp.enviado && <Track event="onboarding_brief_submit" params={{ paquete: p.package_code }} dedupe={`submit:${id}`} />}
      <PageHead back={{ href: '/cliente', label: 'Mis proyectos' }} kicker={<span className="mono">{p.folio}</span>} title={p.organizations?.name} actions={<StatePill state={p.state} />} />
      <ProjectNav id={id} current="Estado" pendingReviews={open} />
      {sp.enviado && <Note tone="ok">Recibimos tu brief. Te enviamos un acuse por correo.</Note>}
      {sp.respondido && <Note tone="ok">Enviamos tus respuestas a Graphique.</Note>}
      <div className="grid2">
        <div className="stack">
          <div className="panel lg stack" style={{ gap: 20 }}>
            <div className="panel-title"><h2>Estado del expediente</h2>{NEXT_STEP[p.state] && <span className="small muted">Actualizado {fmtDate(p.updated_at)}</span>}</div>
            <Timeline state={p.state} />
            {NEXT_STEP[p.state] && <Note><b>Qué sigue:</b> {NEXT_STEP[p.state]}</Note>}
            <div className="row">
              {p.state === 'BRIEF_EN_PROGRESO' && <Link className="btn" href={`/cliente/proyectos/${id}/brief/M01`}>{pct > 0 ? 'Continuar brief' : 'Empezar brief'} <Icon name="arrowRight" size={16} /></Link>}
              {open > 0 && <Link className="btn" href={`/cliente/proyectos/${id}/aclaraciones`}>Responder {open} aclaración{open === 1 ? '' : 'es'}</Link>}
            </div>
          </div>
        </div>
        <aside className="stack">
          <div className="panel stack" style={{ gap: 16 }}>
            <div className="row" style={{ gap: 16 }}><Ring value={pct} size={76} /><div className="stack" style={{ gap: 2 }}><b>Brief</b><span className="small muted">{latestFiles(files).length} archivo(s) recibidos</span></div></div>
            <dl className="kv small"><dt>Paquete</dt><dd>{P.name}</dd><dt>Alcance base</dt><dd>{P.limitLabel}</dd><dt>Garantía</dt><dd>{P.warrantyDays} días correctiva</dd></dl>
          </div>
          <div className="panel stack">
            <h3>Versiones aprobadas</h3>
            {approvals.length ? <ul className="files">{approvals.map((a) => <li key={a.id}><span className="ficon">v{a.version}</span><span className="small">{fmtDate(a.approved_at)}</span><span className="pill tone-ok">Aprobada</span></li>)}</ul>
              : <p className="small muted">Aún no hay versiones aprobadas.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
