import Link from 'next/link';
import { requireStaff } from '@/lib/server/session';
import { listProjects } from '@/lib/server/data';
import { PACKAGES } from '@/lib/catalog';
import type { ProjectState } from '@/lib/states';
import { StatePill, fmtDate } from '@/components/ui';

export const metadata = { title: 'Panel de Graphique' };

const VIEWS: Record<string, { label: string; states: ProjectState[] }> = {
  revisar: { label: 'Por revisar', states: ['BRIEF_ENVIADO', 'EN_REVISION'] },
  comercial: { label: 'Comercial', states: ['SOLICITUD_RECIBIDA', 'CONTACTO_PENDIENTE', 'PROPUESTA_ENVIADA', 'CONTRATACION_PENDIENTE', 'CONTRATADO'] },
  cliente: { label: 'Con el cliente', states: ['INVITACION_PENDIENTE', 'BRIEF_EN_PROGRESO', 'INFORMACION_PENDIENTE'] },
  cerrados: { label: 'Aprobados', states: ['BRIEF_APROBADO', 'LISTO_PARA_PLANEACION'] },
  todos: { label: 'Todos', states: [] },
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { sb, staff } = await requireStaff();
  const vista = (await searchParams).vista ?? (staff.role === 'comercial' ? 'comercial' : 'revisar');
  const all = await listProjects(sb);
  const v = VIEWS[vista] ?? VIEWS.todos;
  const rows = v.states.length ? all.filter((p) => v.states.includes(p.state)) : all;
  return (
    <div className="wrap stack">
      <div className="row between">
        <div><span className="kicker">Panel de Graphique · {staff.display_name} ({staff.role})</span><h1>Proyectos y solicitudes</h1></div>
        <div className="row">
          {staff.role === 'comercial' && <Link className="btn" href="/admin/proyectos/nuevo">Alta desde HubSpot</Link>}
          <form action="/salir" method="post"><button className="btn line sm" type="submit">Cerrar sesión</button></form>
        </div>
      </div>
      <nav className="steps" aria-label="Vistas">
        {Object.entries(VIEWS).map(([k, x]) => {
          const n = x.states.length ? all.filter((p) => x.states.includes(p.state)).length : all.length;
          return <Link key={k} href={`/admin?vista=${k}`} aria-current={k === vista ? 'page' : undefined} style={k === vista ? { borderColor: 'var(--magenta)', color: 'var(--magenta)' } : undefined}>{x.label} ({n})</Link>;
        })}
      </nav>
      <div className="panel scroll">
        <table className="tbl">
          <thead><tr><th>Folio</th><th>Organización</th><th>Paquete</th><th>Estado</th><th>Origen</th><th>Actualizado</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No hay proyectos en esta vista.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="mono"><Link href={`/admin/proyectos/${p.id}`}>{p.folio}</Link></td>
                <td>{p.organizations?.name}</td><td>{PACKAGES[p.package_code].name}</td><td><StatePill state={p.state} /></td>
                <td className="small">{p.source}{p.source_cta ? ` · ${p.source_cta}` : ''}</td><td className="small muted">{fmtDate(p.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
