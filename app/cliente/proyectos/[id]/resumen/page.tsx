import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { getAnswers, getProject } from '@/lib/server/data';
import { MODULES, labelFor, missingRequired, moduleProgress } from '@/lib/questionnaire';
import { scopeItems } from '@/lib/scope';
import { Back, Note, StatePill } from '@/components/ui';
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
  return (
    <div className="narrow stack">
      <Back href={`/cliente/proyectos/${id}`}>{p.organizations?.name}</Back>
      <ProjectNav id={id} current="Resumen" />
      <div className="row between"><h1>Resumen de tu brief</h1><StatePill state={p.state} /></div>
      {editable && (miss.length ? (
        <Note tone="warn"><b>Te falta responder:</b><ul>{miss.map((x) => <li key={x.question.id}><Link href={`/cliente/proyectos/${id}/brief/${x.module.id}`}>{x.module.id} · {labelFor(x.question, p.package_code)}</Link></li>)}</ul></Note>
      ) : <Note tone="ok">Todo lo obligatorio está respondido.</Note>)}
      {extras.length > 0 && <Note tone="warn">Algunas cosas que pediste no forman parte de tu paquete y se registran como <b>solicitud de ampliación</b>: {extras.map((e) => e.component).join('; ')}. Graphique te dirá alcance, costo y calendario antes de incluirlas.</Note>}
      <div className="panel">
        <dl className="kv">
          {MODULES.map((m) => { const pr = moduleProgress(m, p.package_code, answers); return (
            <div key={m.id} style={{ display: 'contents' }}><dt>{m.id} · {m.title}</dt>
              <dd>{pr.done} de {pr.total} respondidas{editable && <> · <Link href={`/cliente/proyectos/${id}/brief/${m.id}`}>Editar</Link></>}</dd></div>); })}
        </dl>
      </div>
      {editable ? <SubmitBrief projectId={id} blocked={miss.length > 0} /> : <Note>Tu brief está con Graphique. Te avisaremos por correo si necesitamos algo.</Note>}
    </div>
  );
}
