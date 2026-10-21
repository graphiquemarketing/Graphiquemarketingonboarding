import Link from 'next/link';
import { requireClient } from '@/lib/server/session';
import { getFiles, getProject, latestFiles } from '@/lib/server/data';
import { CLIENT_EDITABLE } from '@/lib/states';
import { Back, Note, fmtDate, kb } from '@/components/ui';
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
    <div className="wrap stack">
      <Back href={`/cliente/proyectos/${id}`}>{p.organizations?.name}</Back>
      <ProjectNav id={id} current="Archivos" />
      <h1>Archivos del proyecto</h1>
      {editable ? <div className="panel"><FileUploader projectId={id} /></div>
        : <Note>Los archivos se pueden subir mientras el brief está en progreso o cuando Graphique pide información.</Note>}
      <div className="panel stack">
        <h2>Material recibido</h2>
        {files.length === 0 ? <p className="muted">Aún no hay archivos. Sube tu logotipo, fotos o catálogos.</p> : (
          <ul className="files">
            {files.map((f) => (
              <li key={f.id}>
                <span><Link href={`/archivo/${f.id}`} prefetch={false}>{f.original_name}</Link> <span className="small muted">v{f.version}</span><br />
                  <span className="small muted">{f.category} · {kb(f.size_bytes)} · {fmtDate(f.uploaded_at)}</span>
                  {f.review_note && <><br /><span className="small">Nota de Graphique: {f.review_note}</span></>}
                  {editable && f.status === 'REEMPLAZO_SOLICITADO' && <details style={{ marginTop: 8 }}><summary className="small">Subir nueva versión</summary><FileUploader projectId={id} replaceKey={f.file_key} replaceName={f.original_name} /></details>}
                </span>
                <span className={`pill tone-${ST[f.status]?.[1] ?? 'na'}`}>{ST[f.status]?.[0] ?? f.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
