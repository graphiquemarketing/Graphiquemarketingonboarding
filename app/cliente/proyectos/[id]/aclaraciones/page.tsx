import { requireClient } from '@/lib/server/session';
import { getProject, getReviews } from '@/lib/server/data';
import { Back, Note, fmtDate } from '@/components/ui';
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
    <div className="narrow stack">
      <Back href={`/cliente/proyectos/${id}`}>{p.organizations?.name}</Back>
      <ProjectNav id={id} current="Aclaraciones" pendingReviews={open.length} />
      <h1>Aclaraciones</h1>
      {p.state === 'INFORMACION_PENDIENTE' && open.length > 0
        ? <div className="panel stack"><Note tone="bad">Graphique necesita aclarar {open.length} punto{open.length === 1 ? '' : 's'} antes de aprobar tu brief.</Note><AnswerForm projectId={id} open={open} /></div>
        : <Note>No tienes aclaraciones pendientes.</Note>}
      {done.length > 0 && (
        <div className="panel stack"><h2>Historial</h2>
          {done.map((r) => (
            <div key={r.id} className="stack" style={{ gap: 4, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
              <span className="small muted">{r.module} · {fmtDate(r.created_at)}</span>
              <p><b>Graphique:</b> {r.question}</p>
              <p><b>Tu respuesta:</b> {r.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
