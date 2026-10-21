import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { listProjects, getAnswers } from '@/lib/server/data';
import { progress } from '@/lib/questionnaire';
import { PACKAGES } from '@/lib/catalog';
import { NEXT_STEP, CLIENT_EDITABLE } from '@/lib/states';
import { StatePill } from '@/components/ui';

export const metadata = { title: 'Mis proyectos' };

export default async function MisProyectos() {
  const { sb, user } = await requireClient('/cliente');
  const projects = await listProjects(sb);
  const rows = await Promise.all(projects.map(async (p) => ({ p, pct: progress(p.package_code, (await getAnswers(sb, p.id)).answers) })));
  return (
    <div className="wrap stack">
      <div className="row between">
        <div><span className="kicker">Mi espacio</span><h1>Tus proyectos con <span className="g">Graphique</span></h1></div>
        <form action="/salir" method="post"><button className="btn line sm" type="submit">Cerrar sesión</button></form>
      </div>
      <p className="small muted">Sesión: {user.email}</p>
      {rows.length === 0 && (
        <div className="panel stack"><h2>Todavía no tienes proyectos</h2>
          <p className="muted">Cuando Graphique confirme tu contratación te llegará una invitación por correo. Si ya la recibiste, ábrela desde ese correo.</p></div>
      )}
      <div className="cards">
        {rows.map(({ p, pct }) => (
          <div className="panel stack" key={p.id}>
            <div className="row between"><span className="kicker mono">{p.folio}</span><StatePill state={p.state} /></div>
            <h2>{p.organizations?.name}</h2>
            <p className="small muted">{PACKAGES[p.package_code].name} · {PACKAGES[p.package_code].limitLabel}</p>
            <div className="prog" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
            <p className="small"><b>{pct}%</b> del brief · {NEXT_STEP[p.state]}</p>
            <Link className="btn" href={CLIENT_EDITABLE.includes(p.state) && p.state === 'BRIEF_EN_PROGRESO' ? `/cliente/proyectos/${p.id}/brief/M01` : p.state === 'INFORMACION_PENDIENTE' ? `/cliente/proyectos/${p.id}/aclaraciones` : `/cliente/proyectos/${p.id}`}>
              {p.state === 'BRIEF_EN_PROGRESO' ? 'Continuar brief' : p.state === 'INFORMACION_PENDIENTE' ? 'Responder aclaraciones' : 'Ver expediente'}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
