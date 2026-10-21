'use client';
import { useActionState } from 'react';
import { CodeInput } from '@/components/CodeInput';
import { SubmitButton } from '@/components/SubmitButton';
import { staffMfaAction, staffPasswordAction, type StaffLoginState } from './actions';

export function StaffLogin() {
  const [pw, pwAction] = useActionState<StaffLoginState, FormData>(staffPasswordAction, { step: 'password' });
  const [mfa, mfaAction] = useActionState<StaffLoginState, FormData>(async (_s, f) => staffMfaAction(pw, f), pw);
  if (pw.step === 'password') return (
    <form action={pwAction} className="stack">
      <div className="field"><label htmlFor="st_mail">Correo</label><input id="st_mail" name="email" type="email" autoComplete="username" required /></div>
      <div className="field"><label htmlFor="st_pw">Contraseña</label><input id="st_pw" name="password" type="password" autoComplete="current-password" required /></div>
      {pw.error && <p className="err" role="alert">{pw.error}</p>}
      <div><SubmitButton pending="Verificando…">Continuar</SubmitButton></div>
    </form>
  );
  return (
    <form action={mfaAction} className="stack" noValidate>
      {pw.step === 'enroll' ? (
        <>
          <p><b>Activa la verificación en dos pasos.</b> Escanea el código con Google Authenticator, 1Password u otra app compatible.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {pw.qr && <img src={pw.qr} alt="Código QR para tu app de autenticación" width={180} height={180} style={{ background: '#fff', borderRadius: 8, padding: 8 }} />}
          <p className="small muted">Si no puedes escanear, escribe esta clave en la app: <code className="mono">{pw.secret}</code></p>
        </>
      ) : <p>Escribe el código de 6 dígitos de tu app de autenticación.</p>}
      <CodeInput invalid={!!mfa.error} />
      {mfa.error && <p className="err" role="alert">{mfa.error}</p>}
      <div><SubmitButton pending="Verificando…">Entrar al panel</SubmitButton></div>
    </form>
  );
}
