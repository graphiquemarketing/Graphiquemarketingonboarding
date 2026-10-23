import Link from 'next/link';
import { requireStaff } from '@/lib/server/session';
import { listProjects } from '@/lib/server/data';
import { PACKAGES } from '@/lib/catalog';
import type { ProjectState } from '@/lib/states';
import { StatePill, fmtDate } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';

export const metadata = { title: 'Panel de Graphique' };

const VIEWS: Record<string, { label: string; hint: string; icon: IconName; states: ProjectState[] }> = {
  revisar: { label: 'Por revisar', hint: 'Briefs enviados', icon: 'inbox', states: ['BRIEF_ENVIADO', 'EN_REVISION'] },
  comercial: { label: 'Comercial', hint: 'Solicitud a contrato', icon: 'briefcase', states: ['SOLICITUD_RECIBIDA', 'CONTACTO_PENDIENTE', 'PROPUESTA_ENVIADA', 'CONTRATACION_PENDIENTE', 'CONTRATADO'] },
  cliente: { label: 'Con el cliente', hint: 'Brief o aclaraciones', icon: 'clock', states: ['INVITACION_PENDIENTE', 'BRIEF_EN_PROGRESO', 'INFORMACION_PENDIENTE'] },
  cerrados: { label: 'Aprobados', hint: 'Listos para planear', icon: 'check', states: ['BRIEF_APROBADO', 'LISTO_PARA_PLANEACION'] },
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string }> }) {
  const { sb, staff } = await requireStaff();
  const sp = await searchParams;
  const vista = sp.vista ?? (staff.role === 'comercial' ? 'comercial' : 'revisar');
  const q = (sp.q ?? '').trim().toLowerCase();
  const all = await listProjects(sb);
  const v = VIEWS[vista];
  let rows = v ? all.filter((p) => v.states.includes(p.state)) : all;
  if (q) rows = rows.filter((p) => p.folio.toLowerCase().includes(q) || (p.organizations?.name ?? '').toLowerCase().includes(q));
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Mexico_City' }));
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 6 }}>
          <span className="kicker">Panel de Graphique</span>
          <h1>{greet}, {staff.display_name.split(' ')[0]}</h1>
          <p className="lead">{all.length} proyecto{all.length === 1 ? '' : 's'} en el portal. Elige una bandeja para empezar.</p>
        </div>
        {staff.role === 'comercial' && <Link className="btn" href="/admin/proyectos/nuevo"><Icon name="plus" size={16} />Alta desde HubSpot</Link>}
      </div>
      <nav className="kpis" aria-label="Bandejas">
        {Object.entries(VIEWS).map(([k, x]) => (
          <Link key={k} className="kpi" href={`/admin?vista=${k}`} aria-current={k === vista ? 'page' : undefined}>
            <span><Icon name={x.icon} size={15} />{x.label}</span>
            <b>{all.filter((p) => x.states.includes(p.state)).length}</b>
            <i>{x.hint}</i>
          </Link>
        ))}
      </nav>
      <div className="panel tablewrap">
        <div className="row between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row" style={{ gap: 8 }}><h2>{v?.label ?? 'Todos los proyectos'}</h2><span className="pill tone-na">{rows.length}</span></div>
          <form className="row" role="search" style={{ gap: 8 }}>
            <input type="hidden" name="vista" value={vista} />
            <label className="sr" htmlFor="buscar">Buscar por folio u organización</label>
            <input id="buscar" name="q" defaultValue={sp.q ?? ''} placeholder="Buscar folio u organización" style={{ minHeight: 38, width: 240 }} />
            <Link className="btn sm ghost" href="/admin?vista=todos">Ver todos</Link>
          </form>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Folio</th><th>Organización</th><th>Paquete</th><th>Estado</th><th>Origen</th><th>Actualizado</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ margin: 8 }}><span className="ico"><Icon name="inbox" size={22} /></span><b>Nada en esta bandeja</b><span className="small muted">Cuando un proyecto llegue a este punto aparecerá aquí.</span></div></td></tr>}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono"><Link href={`/admin/proyectos/${p.id}`}>{p.folio}</Link></td>
                  <td><b>{p.organizations?.name}</b></td><td>{PACKAGES[p.package_code].name}</td><td><StatePill state={p.state} /></td>
                  <td className="small muted">{p.source}{p.source_cta ? ` · ${p.source_cta}` : ''}</td><td className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
