'use client';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionResult } from '@/lib/errors';
import { submitBriefAction } from '@/app/cliente/actions';

export function SubmitBrief({ projectId, blocked }: { projectId: string; blocked: boolean }) {
  const [s, action] = useActionState<ActionResult, FormData>(submitBriefAction.bind(null, projectId), { ok: true });
  return (
    <form action={action} className="confirm">
      <b>Enviar brief para revisión</b>
      <p className="small">Después de enviarlo ya no podrás editar hasta que Graphique te pida información. Las solicitudes de ampliación no quedan incluidas hasta que Graphique las autorice.</p>
      <label className="check"><input type="checkbox" name="confirm" required /><span>Confirmo que la información es correcta y no incluye contraseñas.</span></label>
      {!s.ok && <p className="err" role="alert">{s.error}</p>}
      <div><SubmitButton disabled={blocked} pending="Enviando…">Enviar brief para revisión</SubmitButton></div>
    </form>
  );
}
