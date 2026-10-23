'use client';
import { useActionState, useState } from 'react';
import { CodeInput } from '@/components/CodeInput';
import { EMAIL_OTP_LENGTH } from '@/lib/otp';
import { SubmitButton } from '@/components/SubmitButton';
import { sendCodeAction, verifyCodeAction, type CodeState } from './actions';

export function AccessForm({ next }: { next?: string }) {
  const [sent, sendAction] = useActionState<CodeState, FormData>(sendCodeAction, { step: 'email' });
  const [verified, verifyAction] = useActionState<CodeState, FormData>(verifyCodeAction, sent);
  const [again, setAgain] = useState(false);
  const step = again ? 'email' : sent.step;
  const state = step === 'code' ? { ...sent, ...(verified.error ? { error: verified.error } : {}) } : sent;
  if (step === 'email') return (
    <form action={(f) => { setAgain(false); return sendAction(f); }} className="stack" noValidate>
      <div className="field">
        <label htmlFor="a_mail">Correo</label>
        <input id="a_mail" name="email" type="email" autoComplete="email" defaultValue={state.email} aria-invalid={!!state.error || undefined} aria-describedby={state.error ? 'a_err' : undefined} />
        {state.error && <p className="err" id="a_err" role="alert">{state.error}</p>}
        <p className="help">Te enviaremos un código de {EMAIL_OTP_LENGTH} dígitos. No necesitas contraseña.</p>
      </div>
      <SubmitButton className="btn block lg" pending="Enviando…">Enviarme el código</SubmitButton>
    </form>
  );
  return (
    <form action={verifyAction} className="stack" noValidate>
      <p role="status">{sent.info}</p>
      <CodeInput invalid={!!state.error} length={EMAIL_OTP_LENGTH} />
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <input type="hidden" name="next" value={next ?? ''} />
      <input type="hidden" name="email" value={sent.email ?? ''} />
      <SubmitButton className="btn block lg" pending="Verificando…">Entrar</SubmitButton>
      <button className="btn ghost block" type="button" onClick={() => setAgain(true)}>Usar otro correo o pedir otro código</button>
      <p className="small muted">¿No llegó? Revisa spam. Puedes pedir otro código en 60 segundos.</p>
    </form>
  );
}
