'use client';
import { useActionState } from 'react';
import { CodeInput } from '@/components/CodeInput';
import { EMAIL_OTP_LENGTH } from '@/lib/otp';
import { SubmitButton } from '@/components/SubmitButton';
import { acceptInvitation, sendInviteCode, verifyInviteCode, type InviteState } from './actions';

export function InviteFlow({ token, emailMasked, signedInAs }: { token: string; emailMasked: string; signedInAs: string | null }) {
  const [sent, send] = useActionState<InviteState, FormData>(sendInviteCode.bind(null, token), { step: 'start' });
  const [ver, verify] = useActionState<InviteState, FormData>(verifyInviteCode.bind(null, token), { step: 'code' });
  const [acc, accept] = useActionState<InviteState, FormData>(acceptInvitation.bind(null, token), { step: 'start' });
  if (signedInAs) return (
    <form action={accept} className="stack">
      <p>Entraste como <b>{signedInAs}</b>.</p>
      {acc.error && <p className="err" role="alert">{acc.error}</p>}
      <SubmitButton className="btn block lg" pending="Aceptando…">Aceptar invitación y empezar</SubmitButton>
    </form>
  );
  if (sent.step === 'start') return (
    <form action={send} className="stack">
      <p>Te enviaremos un código de {EMAIL_OTP_LENGTH} dígitos a <b>{emailMasked}</b> para confirmar que eres tú.</p>
      {sent.error && <p className="err" role="alert">{sent.error}</p>}
      <SubmitButton className="btn block lg" pending="Enviando…">Enviarme el código</SubmitButton>
    </form>
  );
  return (
    <form action={verify} className="stack" noValidate>
      <p role="status">Revisa tu correo {emailMasked}. El código vence en 10 minutos.</p>
      <CodeInput invalid={!!ver.error} length={EMAIL_OTP_LENGTH} />
      {ver.error && <p className="err" role="alert">{ver.error}</p>}
      <SubmitButton className="btn block lg" pending="Verificando…">Confirmar y entrar</SubmitButton>
    </form>
  );
}
