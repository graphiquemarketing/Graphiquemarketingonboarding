'use client';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionResult } from '@/lib/errors';
import { answerClarificationsAction } from '@/app/cliente/actions';

export function AnswerForm({ projectId, open }: { projectId: string; open: { id: string; module: string; question: string }[] }) {
  const [s, action] = useActionState<ActionResult, FormData>(answerClarificationsAction.bind(null, projectId), { ok: true });
  return (
    <form action={action} className="stack">
      {open.map((r) => (
        <div className="field" key={r.id}>
          <label htmlFor={`r_${r.id}`}><span className="small muted">{r.module}</span><br />{r.question}</label>
          <textarea id={`r_${r.id}`} name={`r_${r.id}`} required maxLength={4000} />
        </div>
      ))}
      {!s.ok && <p className="err" role="alert">{s.error}</p>}
      <div><SubmitButton pending="Enviando…">Enviar respuestas</SubmitButton></div>
    </form>
  );
}
