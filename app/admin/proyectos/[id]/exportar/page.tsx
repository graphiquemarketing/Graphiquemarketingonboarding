import { requireStaff } from '@/lib/server/session';
import { getApprovals, getProject } from '@/lib/server/data';
import { EXPORT_FILES } from '@/lib/export';
import { FileIcon, PageHead, Note, fmtDate } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Track } from '@/components/Track';

export default async function Exportar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aprobado?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { sb } = await requireStaff();
  const p = await getProject(sb, id);
  const approvals = await getApprovals(sb, id);
  return (
    <div className="narrow stack">
      {sp.aprobado && <Track event="onboarding_brief_approved" params={{ paquete: p.package_code }} dedupe={`ap:${id}:${sp.aprobado}`} />}
      <PageHead back={{ href: `/admin/proyectos/${id}`, label: `${p.folio} · ${p.organizations?.name ?? ''}` }} kicker="Expediente" title="Archivos exportables" intro="Todo sale de la versión aprobada y congelada; las respuestas posteriores no se mezclan." />
      {sp.aprobado && <Note tone="ok">Versión v{sp.aprobado} aprobada. Avisamos al cliente por correo.</Note>}
      {approvals.length === 0 && <Note>Aún no hay versiones aprobadas.</Note>}
      {approvals.map((a, i) => (
        <div className="panel lg stack" key={a.id}>
          <div className="row between"><h2>Versión v{a.version}{i === 0 ? ' · vigente' : ''}</h2><span className="small muted">{fmtDate(a.approved_at)} · {a.approved_by_label}</span></div>
          <p className="small">Huella <span className="mono">{a.hash}</span></p>
          <ul className="files">
            {Object.entries(EXPORT_FILES).map(([k, f]) => (
              <li key={k}><FileIcon name={f.name} /><span><b>{f.name}</b></span><a className="btn sm soft" href={`/admin/proyectos/${id}/exportar/${a.version}/${k}`} download><Icon name="download" size={15} />Descargar</a></li>
            ))}
          </ul>
        </div>
      ))}
      <p className="small muted">Cada descarga queda en la auditoría. El expediente para Claude excluye datos de contacto e información confidencial; la exportación a IA es manual.</p>
    </div>
  );
}
