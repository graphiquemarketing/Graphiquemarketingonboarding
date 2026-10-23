import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/server/session';
import { getAnswers, getApprovals, getFiles, getOverrides, getProject, getReviews, latestFiles } from '@/lib/server/data';
import { missingRequired } from '@/lib/questionnaire';
import { BLOCKING, scopeItems } from '@/lib/scope';
import { PageHead, Note } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionForm } from '../../../ActionForm';
import { approveAction } from '../../../actions';

export default async function Aprobacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireStaff(['pm']);
  const p = await getProject(sb, id);
  if (p.state !== 'EN_REVISION') redirect(`/admin/proyectos/${id}`);
  const [{ answers }, overrides, files, reviews, approvals] = await Promise.all([getAnswers(sb, id), getOverrides(sb, id), getFiles(sb, id), getReviews(sb, id), getApprovals(sb, id)]);
  const items = scopeItems(p.package_code, answers, overrides);
  const blocking = items.filter((i) => BLOCKING.includes(i.classification));
  const miss = missingRequired(p.package_code, answers);
  const open = reviews.filter((r) => !r.answered_at);
  const manifest = latestFiles(files).filter((f) => ['RECIBIDO', 'APROBADO'].includes(f.status));
  const count = (c: string) => items.filter((i) => i.classification === c).length;
  const ok = !blocking.length && !miss.length && !open.length;
  const v = (approvals[0]?.version ?? 0) + 1;
  return (
    <div className="narrow stack">
      <PageHead back={{ href: `/admin/proyectos/${id}/revision`, label: 'Revisión' }} kicker={`${p.folio} · ${p.organizations?.name ?? ''}`} title={<>Aprobar versión <span className="g">v{v}</span></>} />
      <div className="panel stack">
        <dl className="kv">
          <dt>Proyecto</dt><dd>{p.folio} · {p.organizations?.name} · {p.package_code}</dd>
          <dt>Alcance</dt><dd>{items.length} partidas · {count('INCLUIDA')} incluidas · {count('ADICIONAL_APROBADA')} adicionales aprobadas · {count('NO_INCLUIDA')} no incluidas · {count('NO_APLICA')} no aplican</dd>
          <dt>Archivos</dt><dd>{manifest.length} en el manifiesto</dd>
        </dl>
        {!ok && <Note tone="bad"><b>No se puede aprobar todavía:</b><ul>
          {miss.length > 0 && <li>{miss.length} obligatoria(s) sin respuesta</li>}
          {blocking.length > 0 && <li>{blocking.length} partida(s) pendientes o ampliaciones sin decidir</li>}
          {open.length > 0 && <li>{open.length} aclaración(es) sin respuesta</li>}
        </ul></Note>}
        <Note tone="warn">La aprobación congela respuestas, alcance y archivos con una huella SHA-256. Cualquier cambio posterior crea una versión nueva. Habilita la planeación técnica; no aprueba diseño, contenidos ni producción.</Note>
        <ActionForm action={approveAction.bind(null, id)} className="confirm">
          <label className="check"><input type="checkbox" name="confirm" required /><span>Confirmo que revisé respuestas, archivos y alcance, y que cuento con la autorización para aprobar.</span></label>
          <div className="row"><SubmitButton disabled={!ok} pending="Aprobando…">Aprobar versión v{v}</SubmitButton></div>
        </ActionForm>
      </div>
    </div>
  );
}
