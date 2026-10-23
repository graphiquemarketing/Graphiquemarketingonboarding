import Link from 'next/link';
import { requireStaff } from '@/lib/server/session';
import { getAnswers, getApprovals, getFiles, getOverrides, getProject, getReviews, latestFiles } from '@/lib/server/data';
import { MODULES, isVisible, labelFor, missingRequired, plainAnswer } from '@/lib/questionnaire';
import { PM_CLASSES, SCOPE_LABEL, scopeItems } from '@/lib/scope';
import { PageHead, Note, ScopePill, StatePill, fmtDate, kb } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionForm } from '../../../ActionForm';
import { clarifyAction, reviewFileAction, setScopeAction } from '../../../actions';

export default async function Revision({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, staff } = await requireStaff();
  const p = await getProject(sb, id);
  const [{ answers }, overrides, files, reviews, approvals] = await Promise.all([getAnswers(sb, id), getOverrides(sb, id), getFiles(sb, id), getReviews(sb, id), getApprovals(sb, id)]);
  const items = scopeItems(p.package_code, answers, overrides);
  const miss = missingRequired(p.package_code, answers);
  const pm = staff.role === 'pm';
  const scopeEditable = pm && ['BRIEF_ENVIADO', 'EN_REVISION'].includes(p.state);
  const last = approvals[0];
  const changed = last ? Object.keys({ ...answers, ...last.answers }).filter((k) => JSON.stringify(answers[k] ?? null) !== JSON.stringify(last.answers[k] ?? null)) : [];
  return (
    <div className="wrap stack">
      <PageHead back={{ href: `/admin/proyectos/${id}`, label: `${p.folio} · ${p.organizations?.name ?? ''}` }} kicker="Revisión" title="Brief, alcance y archivos" actions={<><StatePill state={p.state} />{staff.role === 'pm' && p.state === 'EN_REVISION' && <Link className="btn sm" href={`/admin/proyectos/${id}/aprobacion`}>Ir a aprobación</Link>}</>} />
      {p.state === 'BRIEF_ENVIADO' && <Note>Usa «Iniciar revisión» en el detalle del proyecto para poder pedir aclaraciones o aprobar.</Note>}
      {miss.length ? <Note tone="warn"><b>Obligatorias sin responder:</b> {miss.map((m) => `${m.module.id} · ${labelFor(m.question, p.package_code)}`).join('; ')}</Note> : <Note tone="ok">Todas las obligatorias tienen respuesta.</Note>}
      {last && <p className="small">Última versión aprobada: <b>v{last.version}</b> ({fmtDate(last.approved_at)}, {last.approved_by_label}, huella <span className="mono">{last.hash.slice(0, 12)}</span>). Cambios desde entonces: <b>{changed.length}</b>{changed.length ? ` (${changed.join(', ')})` : ''}.</p>}

      <div className="panel stack">
        <h2>Alcance contra {p.package_code}</h2>
        <p className="small muted">Se calcula de las respuestas. «Solicitud de ampliación» y «Pendiente» bloquean la aprobación hasta que decidas.</p>
        <div className="scroll"><table className="tbl">
          <thead><tr><th>ID</th><th>Componente</th><th>Clasificación</th><th>Motivo</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} className="muted">Sin partidas: el cliente aún no eligió apartados ni funciones.</td></tr>}
            {items.map((it) => (
              <tr key={it.key}>
                <td className="mono">{it.id}</td><td>{it.component}</td>
                <td>
                  <ScopePill c={it.classification} />{it.note && <div className="small muted">{it.note}</div>}
                  {scopeEditable && (
                    <details><summary className="small">Clasificar</summary>
                      <ActionForm action={setScopeAction.bind(null, id)}>
                        <input type="hidden" name="key" value={it.key} />
                        <label className="sr" htmlFor={`cls_${it.key}`}>Clasificación</label>
                        <select id={`cls_${it.key}`} name="classification" defaultValue={PM_CLASSES.includes(it.classification) ? it.classification : 'PENDIENTE'}>{PM_CLASSES.map((c) => <option key={c} value={c}>{SCOPE_LABEL[c]}</option>)}</select>
                        <label className="small" htmlFor={`note_${it.key}`}>Nota (obligatoria para ampliación aprobada: orden de cambio, costo y calendario)</label>
                        <input id={`note_${it.key}`} name="note" defaultValue={it.note ?? ''} maxLength={500} />
                        <div><SubmitButton className="btn sm">Guardar</SubmitButton></div>
                      </ActionForm>
                    </details>
                  )}
                </td>
                <td className="small muted">{it.reason}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="panel stack">
        <h2>Respuestas</h2>
        {MODULES.map((m) => (
          <details key={m.id}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>{m.id} · {m.title}</summary>
            <dl className="kv small" style={{ marginTop: 8 }}>
              {m.questions.filter((q) => isVisible(q, p.package_code, answers)).map((q) => (
                <div key={q.id} style={{ display: 'contents' }}><dt>{labelFor(q, p.package_code)}{q.sensitive ? ' (confidencial)' : ''}</dt><dd>{plainAnswer(q, answers[q.id]) || <span className="muted">—</span>}</dd></div>
              ))}
            </dl>
          </details>
        ))}
      </div>

      <div className="panel stack">
        <h2>Archivos</h2>
        {latestFiles(files).length === 0 && <p className="muted">Sin archivos.</p>}
        <ul className="files">
          {latestFiles(files).map((f) => (
            <li key={f.id}>
              <span><Link href={`/archivo/${f.id}`} prefetch={false}>{f.original_name}</Link> <span className="small muted">v{f.version} · {f.category} · {kb(f.size_bytes)} · {f.status}</span>
                {pm && f.status !== 'PENDIENTE_CARGA' && (
                  <ActionForm action={reviewFileAction.bind(null, id)} className="row">
                    <input type="hidden" name="file" value={f.id} />
                    <label className="sr" htmlFor={`fn_${f.id}`}>Nota</label>
                    <input id={`fn_${f.id}`} name="note" placeholder="Nota para el cliente (opcional)" style={{ maxWidth: 260 }} />
                    <SubmitButton className="btn sm" name="status" value="APROBADO">Aprobar</SubmitButton>
                    <SubmitButton className="btn sm soft" name="status" value="REEMPLAZO_SOLICITADO">Pedir reemplazo</SubmitButton>
                    <SubmitButton className="btn sm danger" name="status" value="RECHAZADO">Rechazar</SubmitButton>
                  </ActionForm>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel stack">
        <h2>Aclaraciones</h2>
        {reviews.map((r) => (
          <div key={r.id} className="small" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            <span className="muted">{r.module} · {fmtDate(r.created_at)}</span><p><b>Graphique:</b> {r.question}</p>
            <p>{r.answer ? <><b>Cliente:</b> {r.answer}</> : <span className="muted">Esperando respuesta.</span>}</p>
          </div>
        ))}
        {pm && p.state === 'EN_REVISION' && (
          <ActionForm action={clarifyAction.bind(null, id)}>
            <div className="fgrid">
              <div className="field"><label htmlFor="cl_mod">Módulo</label><select id="cl_mod" name="module">{MODULES.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.title}</option>)}</select></div>
              <div className="field"><label htmlFor="cl_q">Aclaración</label><input id="cl_q" name="question" required maxLength={1000} placeholder="¿Quién aprueba los textos finales?" /></div>
            </div>
            <div><SubmitButton className="btn soft">Solicitar aclaración</SubmitButton></div>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
