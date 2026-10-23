import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { getAnswers, getProject } from '@/lib/server/data';
import { MODULES, labelFor, missingRequired, moduleProgress, progress } from '@/lib/questionnaire';
import { Ring } from '@/components/Ring';
import { scopeItems } from '@/lib/scope';
import { Note, PageHead, StatePill } from '@/components/ui';
import { ProjectNav } from '@/components/ProjectNav';
import { SubmitBrief } from './SubmitBrief';

export default async function Resumen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireClient(`/cliente/proyectos/${id}/resumen`);
  const p = await getProject(sb, id);
  const { answers } = await getAnswers(sb, id);
  const miss = missingRequired(p.package_code, answers);
  const extras = scopeItems(p.package_code, answers).filter((i) => i.auto === 'ADICIONAL');
  const editable = p.state === 'BRIEF_EN_PROGRESO';
  const pct = progress(p.package_code, answers);
  return (
    <div className="wrap stack" style={{ gap: 22 }}>
      <PageHead back={{ href: `/cliente/proyectos/${id}`, label: p.organizations?.name ?? 'Proyecto' }} kicker="Revisión final" title="Resumen de tu brief" actions={<StatePill state={p.state} />} />
      <ProjectNav id={id} current="Resumen" />
      <div className="grid2">
        <div className="stack">
          {editable && (miss.length ? (
            <Note tone="warn"><b>Te falta responder {miss.length} pregunta{miss.length === 1 ? '' : 's'}:</b><ul>{miss.map((x) => <li key={x.question.id}><Link href={`/cliente/proyectos/${id}/brief/${x.module.id}`}>{x.module.title} · {labelFor(x.question, p.package_code)}</Link></li>)}</ul></Note>
          ) : <Note tone="ok">Todo lo obligatorio está respondido. Ya puedes enviarlo a revisión.</Note>)}
          {extras.length > 0 && <Note tone="warn">Algunas cosas que pediste no forman parte de tu paquete y se registran como <b>solicitud de ampliación</b>: {extras.map((e) => e.component).join('; ')}. Graphique te dirá alcance, costo y calendario antes de incluirlas.</Note>}
          <div className="panel tablewrap">
            <table className="tbl">
              <thead><tr><th>Módulo</th><th>Avance</th><th><span className="sr">Acción</span></th></tr></thead>
              <tbody>
                {MODULES.map((m, i) => { const pr = moduleProgress(m, p.package_code, answers); const full = pr.total > 0 && pr.done === pr.total; return (
                  <tr key={m.id}>
                    <td><span className="small muted mono">{String(i + 1).padStart(2, '0')}</span> <b>{m.title}</b></td>
                    <td style={{ minWidth: 140 }}><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><div className="prog" style={{ flex: 1 }}><i style={{ width: `${pr.total ? (pr.done * 100) / pr.total : 0}%`, background: full ? 'var(--ok)' : undefined }} /></div><span className="small mono">{pr.done}/{pr.total}</span></div></td>
                    <td style={{ textAlign: 'right' }}>{editable && <Link className="btn sm ghost" href={`/cliente/proyectos/${id}/brief/${m.id}`}>Editar</Link>}</td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="stack">
          <div className="panel row" style={{ gap: 16 }}><Ring value={pct} size={76} /><div className="stack" style={{ gap: 2 }}><b>Avance total</b><span className="small muted">{editable ? 'Puedes seguir editando hasta enviarlo.' : 'Brief enviado a Graphique.'}</span></div></div>
          {editable ? <SubmitBrief projectId={id} blocked={miss.length > 0} /> : <Note>Tu brief está con Graphique. Te avisaremos por correo si necesitamos algo.</Note>}
        </aside>
      </div>
    </div>
  );
}
