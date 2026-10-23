import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { getFiles, getProject, latestFiles } from '@/lib/server/data';
import { CLIENT_EDITABLE } from '@/lib/states';
import { FileIcon, Note, PageHead, fmtDate, kb } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ProjectNav } from '@/components/ProjectNav';
import { FileUploader } from '@/components/brief/FileUploader';

const ST: Record<string, [string, string]> = {
  RECIBIDO: ['Recibido', 'lead'], APROBADO: ['Aprobado', 'ok'], REEMPLAZO_SOLICITADO: ['Reemplazo solicitado', 'com'], RECHAZADO: ['Rechazado', 'bad'],
};

export default async function Archivos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireClient(`/cliente/proyectos/${id}/archivos`);
  const p = await getProject(sb, id);
  const files = latestFiles(await getFiles(sb, id));
  const editable = CLIENT_EDITABLE.includes(p.state);
  return (
    <div className="wrap stack" style={{ gap: 22 }}>
      <PageHead back={{ href: `/cliente/proyectos/${id}`, label: p.organizations?.name ?? 'Proyecto' }} kicker="Material del proyecto" title="Archivos"
        intro="Logotipo, fotografías, catálogos y documentos. Se guardan de forma privada y cada reemplazo crea una versión nueva." />
      <ProjectNav id={id} current="Archivos" />
      <div className="grid2">
        <div className="panel lg stack">
          <div className="panel-title"><h2>Material recibido</h2><span className="small muted">{files.length} archivo{files.length === 1 ? '' : 's'}</span></div>
          {files.length === 0 ? (
            <div className="empty"><span className="ico"><Icon name="file" size={24} /></span><b>Aún no hay archivos</b><span className="small muted">Sube tu logotipo, fotos o catálogos desde el panel de carga.</span></div>
          ) : (
            <ul className="files">
              {files.map((f) => (
                <li key={f.id}>
                  <FileIcon name={f.original_name} />
                  <span style={{ minWidth: 0 }}><Link href={`/archivo/${f.id}`} prefetch={false} style={{ fontWeight: 700, textDecoration: 'none', overflowWrap: 'anywhere' }}>{f.original_name}</Link> <span className="small muted">v{f.version}</span><br />
                    <span className="small muted">{f.category} · {kb(f.size_bytes)} · {fmtDate(f.uploaded_at)}</span>
                    {f.review_note && <><br /><span className="small">Nota de Graphique: {f.review_note}</span></>}
                    {editable && f.status === 'REEMPLAZO_SOLICITADO' && <details style={{ marginTop: 10 }}><summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>Subir nueva versión</summary><div style={{ marginTop: 10 }}><FileUploader projectId={id} replaceKey={f.file_key} replaceName={f.original_name} /></div></details>}
                  </span>
                  <span className={`pill tone-${ST[f.status]?.[1] ?? 'na'}`}>{ST[f.status]?.[0] ?? f.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside>
          {editable ? <div className="panel stack"><h2>Subir archivos</h2><FileUploader projectId={id} /></div>
            : <Note>Los archivos se pueden subir mientras el brief está en progreso o cuando Graphique pide información.</Note>}
        </aside>
      </div>
    </div>
  );
}
