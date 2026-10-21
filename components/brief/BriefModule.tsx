'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PACKAGES, type PackageCode } from '@/lib/catalog';
import { MODULES, UNKNOWN, isVisible, labelFor, moduleProgress, optionsFor, pagesOver, progress, type Answers, type Question } from '@/lib/questionnaire';
import { classifyFunction } from '@/lib/scope';
import { track } from '@/lib/analytics';
import { saveAnswerAction } from '@/app/cliente/actions';

type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';
const SAVE_TEXT: Record<SaveState, string> = {
  idle: 'Se guarda solo', saving: 'Guardando…', saved: 'Guardado', offline: 'Sin conexión: guardaremos al reconectar',
  error: 'No se pudo guardar. Reintentando…', conflict: 'Otra persona editó una respuesta. Recarga para ver su versión.',
};
const SAVE_CLASS: Record<SaveState, string> = { idle: 'muted', saving: 't-warn', saved: 't-ok', offline: 't-warn', error: 't-bad', conflict: 't-bad' };

export function BriefModule({ projectId, pkg, moduleIndex, initial, revisions: initialRev }: {
  projectId: string; pkg: PackageCode; moduleIndex: number; initial: Answers; revisions: Record<string, number>;
}) {
  const router = useRouter();
  const mod = MODULES[moduleIndex];
  const [answers, setAnswers] = useState<Answers>(initial);
  const [status, setStatus] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rev = useRef<Record<string, number>>(initialRev);
  const pending = useRef<Map<string, unknown>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { track('onboarding_brief_start', { paquete: pkg }, `brief_start:${projectId}`); }, [pkg, projectId]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!pending.current.size) return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setStatus('offline'); return false; }
    setStatus('saving');
    const batch = [...pending.current.entries()];
    pending.current.clear();
    let ok = true;
    for (const [qid, value] of batch) {
      const r = await saveAnswerAction(projectId, qid, value, rev.current[qid] ?? null);
      if (r.ok) { rev.current[qid] = r.data!.revision; }
      else if ('conflict' in r && r.conflict) { setStatus('conflict'); setError(r.error); return false; }
      else { ok = false; pending.current.set(qid, value); setError(r.error); }
    }
    if (ok) { setStatus('saved'); setSavedAt(new Date()); setError(null); }
    else { setStatus('error'); timer.current = setTimeout(flush, 4000); }
    return ok;
  }, [projectId]);

  useEffect(() => {
    const on = () => { if (pending.current.size) void flush(); };
    const before = (e: BeforeUnloadEvent) => { if (pending.current.size) { e.preventDefault(); } };
    window.addEventListener('online', on);
    window.addEventListener('beforeunload', before);
    return () => { window.removeEventListener('online', on); window.removeEventListener('beforeunload', before); };
  }, [flush]);

  const set = (qid: string, value: unknown, immediate = false) => {
    setAnswers((a) => ({ ...a, [qid]: value }));
    pending.current.set(qid, value);
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, immediate ? 50 : 800);
  };

  const go = async (i: number) => {
    const ok = await flush();
    if (!ok && status === 'conflict') return;
    const p = moduleProgress(mod, pkg, answers);
    if (p.total && p.done === p.total) track('onboarding_step_complete', { paquete: pkg, modulo: mod.id }, `step:${projectId}:${mod.id}`);
    router.push(i >= MODULES.length ? `/cliente/proyectos/${projectId}/resumen` : `/cliente/proyectos/${projectId}/brief/${MODULES[i].id}`);
  };

  const visible = useMemo(() => mod.questions.filter((q) => isVisible(q, pkg, answers)), [mod, pkg, answers]);
  const pct = progress(pkg, answers);
  const last = moduleIndex === MODULES.length - 1;

  return (
    <div className="stack">
      <div className="row between">
        <span className={`save ${SAVE_CLASS[status]}`} role="status" aria-live="polite">
          {status === 'saved' && savedAt ? `Guardado ${savedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : SAVE_TEXT[status]}
        </span>
        <span className="small muted">{pct}% del brief</span>
      </div>
      <div className="prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del brief"><i style={{ width: `${pct}%` }} /></div>
      <nav className="steps" aria-label="Módulos del brief">
        {MODULES.map((m, i) => {
          const p = moduleProgress(m, pkg, answers);
          return <Link key={m.id} href={`/cliente/proyectos/${projectId}/brief/${m.id}`} aria-current={i === moduleIndex ? 'step' : undefined}
            className={p.total && p.done === p.total ? 'done' : undefined} onClick={async (e) => { e.preventDefault(); await go(i); }}>{m.id} {m.title}</Link>;
        })}
      </nav>
      {error && status !== 'saved' && <div className="note bad" role="alert">{error}{status === 'conflict' && <> <button className="linkbtn" type="button" onClick={() => location.reload()}>Recargar</button></>}</div>}
      <form className="stack" noValidate onSubmit={(e) => e.preventDefault()}>
        {visible.map((q) => <QuestionField key={q.id} q={q} pkg={pkg} answers={answers} onChange={set} />)}
      </form>
      <div className="row between">
        <button className="btn line" type="button" disabled={moduleIndex === 0} onClick={() => go(moduleIndex - 1)}>Volver</button>
        <button className="btn" type="button" onClick={() => go(moduleIndex + 1)}>{last ? 'Revisar y enviar' : 'Continuar'}</button>
      </div>
    </div>
  );
}

function QuestionField({ q, pkg, answers, onChange }: { q: Question; pkg: PackageCode; answers: Answers; onChange: (qid: string, v: unknown, immediate?: boolean) => void }) {
  const v = answers[q.id];
  const id = `q_${q.id}`;
  const unknown = v === UNKNOWN;
  const label = <>{labelFor(q, pkg)}{q.required && <span className="req"> *</span>}</>;
  const help = q.help ? <p className="help" id={`h_${q.id}`}>{q.help}</p> : null;
  const describedBy = q.help ? `h_${q.id}` : undefined;
  const idk = q.allowUnknown ? (
    <label className="check small"><input type="checkbox" checked={unknown} onChange={(e) => onChange(q.id, e.target.checked ? UNKNOWN : '', true)} /><span>No lo sé</span></label>
  ) : null;

  if (q.type === 'text' || q.type === 'url' || q.type === 'date') return (
    <div className="field">
      <label htmlFor={id}>{label}</label>{help}
      <input id={id} type={q.type === 'text' ? 'text' : q.type} value={!unknown && typeof v === 'string' ? v : ''} disabled={unknown}
        aria-describedby={describedBy} maxLength={q.type === 'url' ? 500 : 1000} onChange={(e) => onChange(q.id, e.target.value, q.type === 'date')} />
      {idk}
    </div>
  );
  if (q.type === 'area') return (
    <div className="field">
      <label htmlFor={id}>{label}</label>{help}
      <textarea id={id} value={!unknown && typeof v === 'string' ? v : ''} disabled={unknown} aria-describedby={describedBy} maxLength={4000} onChange={(e) => onChange(q.id, e.target.value)} />
      {idk}
    </div>
  );
  if (q.type === 'single' || q.type === 'multi') {
    const opts = optionsFor(q, answers);
    const multi = q.type === 'multi';
    const sel: string[] = multi ? (Array.isArray(v) ? (v as string[]) : []) : typeof v === 'string' ? [v] : [];
    if (!opts.length) return <div className="field"><span className="lbl">{label}</span><p className="help">{q.emptyText}</p></div>;
    const P = PACKAGES[pkg];
    const over = q.countsPages ? pagesOver(pkg, answers) : 0;
    return (
      <fieldset className="field">
        <legend>{label}</legend>{help}
        {q.countsPages && P.max && <p className="help">Tu paquete incluye {P.limitLabel.toLowerCase()}. Llevas <b>{sel.length}</b>.{over > 0 && <span className="err"> {over === 1 ? 'La extra se registra' : `Las ${over} extra se registran`} como solicitud de ampliación; no queda incluida.</span>}</p>}
        {q.scoped && <p className="help">Lo que no forma parte de {P.name} se marca como solicitud de ampliación y no garantiza inclusión.</p>}
        <div className="chips">
          {opts.map((o) => {
            const checked = sel.includes(o.value);
            let badge: React.ReactNode = null;
            if (q.scoped) {
              const c = classifyFunction(pkg, o.value as never);
              badge = c === 'INCLUIDA' ? <small className="t-ok">incluida</small> : c === 'PENDIENTE' ? <small className="t-warn">según contrato</small> : <small className="t-bad">ampliación</small>;
            }
            return (
              <label className="chip" key={o.value}>
                <input type={multi ? 'checkbox' : 'radio'} name={q.id} value={o.value} checked={checked}
                  onChange={(e) => onChange(q.id, multi ? (e.target.checked ? [...sel, o.value] : sel.filter((x) => x !== o.value)) : o.value, true)} />
                <span>{o.label}{badge}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }
  if (q.type === 'fields') {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, string>;
    return (
      <fieldset className="field"><legend>{label}</legend>{help}
        <div className="fgrid">
          {q.fields!.map((f) => (
            <div className="field" key={f.key}>
              <label className="small" htmlFor={`${id}_${f.key}`}>{f.label}{f.required && <span className="req"> *</span>}</label>
              <input id={`${id}_${f.key}`} type={f.input ?? 'text'} value={o[f.key] ?? ''} maxLength={300} onChange={(e) => onChange(q.id, { ...o, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>
      </fieldset>
    );
  }
  if (q.type === 'list') {
    const rows = (Array.isArray(v) ? v : []) as Record<string, string>[];
    return (
      <fieldset className="field"><legend>{label}</legend>{help}
        <div className="stack" style={{ gap: 8 }}>
          {rows.map((r, ri) => (
            <div className="reprow" key={ri}>
              {q.fields!.map((f) => {
                const fid = `${id}_${ri}_${f.key}`;
                const upd = (val: string) => onChange(q.id, rows.map((x, j) => (j === ri ? { ...x, [f.key]: val } : x)));
                return (
                  <div className="field" key={f.key}>
                    <label className="small" htmlFor={fid}>{f.label}</label>
                    {f.options
                      ? <select id={fid} value={r[f.key] ?? ''} onChange={(e) => upd(e.target.value)}><option value="" />{f.options.map((o) => <option key={o}>{o}</option>)}</select>
                      : <input id={fid} type={f.input ?? 'text'} value={r[f.key] ?? ''} maxLength={500} onChange={(e) => upd(e.target.value)} />}
                  </div>
                );
              })}
              <button type="button" className="btn sm line" aria-label={`Quitar fila ${ri + 1}`} onClick={() => onChange(q.id, rows.filter((_, j) => j !== ri), true)}>Quitar</button>
            </div>
          ))}
          <div><button type="button" className="btn sm soft" onClick={() => onChange(q.id, [...rows, {}], true)}>Agregar</button></div>
        </div>
      </fieldset>
    );
  }
  if (q.type === 'tri') {
    const t = (v && typeof v === 'object' ? v : {}) as Record<string, string>;
    return (
      <fieldset className="field"><legend>{label}</legend>
        <div className="tri">
          {q.items!.map((it) => (
            <div key={it} style={{ display: 'contents' }}>
              <span>{it}</span>
              <div className="seg" role="radiogroup" aria-label={it}>
                {['Sí', 'No', 'No lo sé'].map((o) => (
                  <label key={o}><input type="radio" name={`${q.id}_${it}`} value={o} checked={t[it] === o} onChange={() => onChange(q.id, { ...t, [it]: o }, true)} /><span>{o}</span></label>
                ))}
              </div>
            </div>
          ))}
        </div>{help}
      </fieldset>
    );
  }
  if (q.type === 'order') {
    const src = Array.isArray(answers[q.orderOf!]) ? (answers[q.orderOf!] as string[]) : [];
    const cur = (Array.isArray(v) ? (v as string[]) : []).filter((x) => src.includes(x));
    const ord = [...cur, ...src.filter((x) => !cur.includes(x))];
    if (!ord.length) return <div className="field"><span className="lbl">{label}</span><p className="help">Elige primero los apartados.</p></div>;
    const move = (i: number, j: number) => { const n = [...ord]; [n[i], n[j]] = [n[j], n[i]]; onChange(q.id, n, true); };
    return (
      <div className="field"><span className="lbl" id={`l_${q.id}`}>{label}</span>{help}
        <ol className="stack" style={{ gap: 6, margin: 0, paddingLeft: 22 }} aria-labelledby={`l_${q.id}`}>
          {ord.map((x, i) => (
            <li key={x}><div className="row between"><span>{x}</span><span className="row" style={{ gap: 4 }}>
              <button type="button" className="btn sm line" disabled={i === 0} aria-label={`Subir ${x}`} onClick={() => move(i, i - 1)}>↑</button>
              <button type="button" className="btn sm line" disabled={i === ord.length - 1} aria-label={`Bajar ${x}`} onClick={() => move(i, i + 1)}>↓</button>
            </span></div></li>
          ))}
        </ol>
      </div>
    );
  }
  return null;
}
