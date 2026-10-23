'use client';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { setPasswordAction, type PwState } from './actions';

export function PasswordForm() {
  const [s, action] = useActionState<PwState, FormData>(setPasswordAction, {});
  return (
    <form action={action} className="stack" noValidate>
      <div className="field"><label htmlFor="pw1">Contraseña nueva</label><input id="pw1" name="password" type="password" autoComplete="new-password" minLength={12} required aria-describedby="pw_help" /></div>
      <p className="help" id="pw_help">Mínimo 12 caracteres, con letras y números. Te sugerimos guardarla en un gestor de contraseñas.</p>
      <div className="field"><label htmlFor="pw2">Repite la contraseña</label><input id="pw2" name="password2" type="password" autoComplete="new-password" required /></div>
      {s.error && <p className="err" role="alert">{s.error}</p>}
      <SubmitButton className="btn block lg" pending="Guardando…">Guardar y continuar</SubmitButton>
    </form>
  );
}
