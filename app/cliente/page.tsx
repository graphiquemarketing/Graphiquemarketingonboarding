import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { listProjects, getAnswers } from '@/lib/server/data';
import { progress } from '@/lib/questionnaire';
import { PACKAGES } from '@/lib/catalog';
import { NEXT_STEP } from '@/lib/states';
import { StatePill } from '@/components/ui';
import { Ring } from '@/components/Ring';
import { Icon } from '@/components/Icon';

export const metadata = { title: 'Mis proyectos' };

export default async function MisProyectos() {
  const { sb, user } = await requireClient('/cliente');
  const projects = await listProjects(sb);
  const rows = await Promise.all(projects.map(async (p) => ({ p, pct: progress(p.package_code, (await getAnswers(sb, p.id)).answers) })));
  const name = (user.email ?? '').split('@')[0];
  return (
    <div className="wrap stack" style={{ gap: 26 }}>
      <div className="stack" style={{ gap: 8 }}>
        <span className="kicker">Mi espacio</span>
        <h1>Hola{name ? `, ${name}` : ''}. Estos son tus proyectos con <span className="g">Graphique</span></h1>
        <p className="lead">Retoma tu brief donde lo dejaste, sube tus archivos y sigue cada paso de la revisión.</p>
      </div>
      {rows.length === 0 && (
        <div className="empty">
          <span className="ico"><Icon name="inbox" size={24} /></span>
          <h2>Todavía no tienes proyectos</h2>
          <p className="muted" style={{ maxWidth: '52ch' }}>Cuando Graphique confirme tu contratación te llegará una invitación por correo. Si ya la recibiste, ábrela desde ese correo.</p>
        </div>
      )}
      <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {rows.map(({ p, pct }, i) => {
          const href = p.state === 'BRIEF_EN_PROGRESO' ? `/cliente/proyectos/${p.id}/brief/M01` : p.state === 'INFORMACION_PENDIENTE' ? `/cliente/proyectos/${p.id}/aclaraciones` : `/cliente/proyectos/${p.id}`;
          const cta = p.state === 'BRIEF_EN_PROGRESO' ? (pct > 0 ? 'Continuar brief' : 'Empezar brief') : p.state === 'INFORMACION_PENDIENTE' ? 'Responder aclaraciones' : 'Ver expediente';
          return (
            <article className="pcard rise" key={p.id} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="row between"><span className="kicker mono">{p.folio}</span><StatePill state={p.state} /></div>
              <div className="pcard-top">
                <Ring value={pct} size={72} label={`Brief ${pct}% completo`} />
                <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <h2>{p.organizations?.name}</h2>
                  <span className="small muted">{PACKAGES[p.package_code].name} · {PACKAGES[p.package_code].limitLabel}</span>
                </div>
              </div>
              {NEXT_STEP[p.state] && <p className="small" style={{ color: 'var(--ink-2)' }}><b>Qué sigue:</b> {NEXT_STEP[p.state]}</p>}
              <Link className="btn block" href={href}>{cta} <Icon name="arrowRight" size={16} /></Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
