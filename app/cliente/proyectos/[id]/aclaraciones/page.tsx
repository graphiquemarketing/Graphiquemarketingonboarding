import { requireClient } from '@/lib/server/session';
import { getProject, getReviews } from '@/lib/server/data';
import { Note, PageHead, fmtDate } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ProjectNav } from '@/components/ProjectNav';
import { AnswerForm } from './AnswerForm';

export default async function Aclaraciones({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireClient(`/cliente/proyectos/${id}/aclaraciones`);
  const p = await getProject(sb, id);
  const reviews = await getReviews(sb, id);
  const open = reviews.filter((r) => !r.answered_at);
  const done = reviews.filter((r) => r.answered_at);
  return (
    <div className="narrow stack" style={{ gap: 22, maxWidth: 820 }}>
      <PageHead back={{ href: `/cliente/proyectos/${id}`, label: p.organizations?.name ?? 'Proyecto' }} kicker="Revisión" title="Aclaraciones"
        intro="Preguntas de Graphique sobre tu brief. Responde todas para que podamos aprobarlo." />
      <ProjectNav id={id} current="Aclaraciones" pendingReviews={open.length} />
      {p.state === 'INFORMACION_PENDIENTE' && open.length > 0
        ? <div className="panel lg stack"><Note tone="warn">Graphique necesita aclarar {open.length} punto{open.length === 1 ? '' : 's'} antes de aprobar tu brief.</Note><AnswerForm projectId={id} open={open} /></div>
        : <div className="empty"><span className="ico"><Icon name="chat" size={24} /></span><b>No tienes aclaraciones pendientes</b><span className="small muted">Si Graphique necesita algo, te avisaremos por correo.</span></div>}
      {done.length > 0 && (
        <div className="panel stack"><h2>Historial</h2>
          {done.map((r) => (
            <div key={r.id} className="stack" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <span className="small muted">{r.module} · {fmtDate(r.created_at)}</span>
              <p className="note" style={{ background: 'var(--surface-2)' }}><b>Graphique:</b> {r.question}</p>
              <p className="note ok"><b>Tu respuesta:</b> {r.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
