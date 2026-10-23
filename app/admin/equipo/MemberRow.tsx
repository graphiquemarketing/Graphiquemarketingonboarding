'use client';
import { useActionState, useTransition, useState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionResult } from '@/lib/errors';
import { resendActivationAction, resetMfaAction, updateMemberAction } from './actions';

export interface MemberView {
  user_id: string; email: string; name: string; role: 'comercial' | 'pm' | 'admin_tecnico'; active: boolean; is_admin: boolean;
  mfa: boolean; last_sign_in: string | null; self: boolean;
}

export function MemberRow({ m }: { m: MemberView }) {
  const [s, save] = useActionState<ActionResult, FormData>(updateMemberAction.bind(null, m.user_id), { ok: true });
  const [extra, setExtra] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [confirmMfa, setConfirmMfa] = useState(false);
  const msg = extra ?? s;
  return (
    <div className="panel stack" style={{ gap: 12 }}>
      <div className="row between">
        <div className="row" style={{ gap: 12, flexWrap: 'nowrap', minWidth: 0 }}>
          <span className="avatar" aria-hidden="true" style={{ width: 42, height: 42, opacity: m.active ? 1 : .4 }}>{m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
          <div style={{ minWidth: 0 }}><b>{m.name}</b>{m.self && <span className="small muted"> · tú</span>}<br /><span className="small muted" style={{ overflowWrap: 'anywhere' }}>{m.email}</span></div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className={`pill tone-${m.active ? 'ok' : 'na'}`}>{m.active ? 'Activo' : 'Inactivo'}</span>
          {m.is_admin && <span className="pill tone-lead">Administrador</span>}
          <span className={`pill tone-${m.mfa ? 'ok' : 'com'}`}>{m.mfa ? 'MFA activo' : 'MFA pendiente'}</span>
        </div>
      </div>
      <p className="small muted">{m.last_sign_in ? `Último acceso: ${new Date(m.last_sign_in).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún no ha entrado al panel.'}</p>
      <form action={save} className="stack" style={{ gap: 10 }}>
        <div className="fgrid">
          <div className="field"><label htmlFor={`n_${m.user_id}`}>Nombre</label><input id={`n_${m.user_id}`} name="name" defaultValue={m.name} required maxLength={80} /></div>
          <div className="field"><label htmlFor={`r_${m.user_id}`}>Rol</label>
            <select id={`r_${m.user_id}`} name="role" defaultValue={m.role}>
              <option value="comercial">Comercial · solicitudes, contratación e invitaciones</option>
              <option value="pm">PM / revisor · revisión, alcance y aprobación</option>
              <option value="admin_tecnico">Administrador técnico · soporte, solo lectura</option>
            </select></div>
        </div>
        <div className="row">
          <label className="check"><input type="checkbox" name="active" defaultChecked={m.active} disabled={m.self} /><span>Cuenta activa</span></label>
          <label className="check"><input type="checkbox" name="is_admin" defaultChecked={m.is_admin} disabled={m.self} /><span>Administra el equipo</span></label>
          {m.self && <><input type="hidden" name="active" value="on" /><input type="hidden" name="is_admin" value="on" /></>}
        </div>
        <div className="row">
          <SubmitButton className="btn sm" pending="Guardando…">Guardar cambios</SubmitButton>
          {m.active && !m.last_sign_in && <button className="btn sm soft" type="button" disabled={pending} onClick={() => start(async () => setExtra(await resendActivationAction(m.user_id)))}>Reenviar activación</button>}
          {!m.self && m.mfa && !confirmMfa && <button className="btn sm line" type="button" onClick={() => setConfirmMfa(true)}>Restablecer MFA</button>}
        </div>
        {confirmMfa && (
          <div className="confirm" role="group" aria-label="Confirmar restablecer MFA">
            <p className="small">Se borrará la verificación en dos pasos de {m.name} y se cerrarán sus sesiones. En su próximo acceso escaneará un QR nuevo. Úsalo solo si perdió o cambió su teléfono.</p>
            <div className="row"><button className="btn sm danger" type="button" disabled={pending} onClick={() => start(async () => { setExtra(await resetMfaAction(m.user_id)); setConfirmMfa(false); })}>Sí, restablecer</button>
              <button className="btn sm line" type="button" onClick={() => setConfirmMfa(false)}>Cancelar</button></div>
          </div>
        )}
        {!msg.ok && <p className="err" role="alert">{msg.error}</p>}
        {msg.ok && msg.message && <p className="small t-ok" role="status">{msg.message}</p>}
      </form>
    </div>
  );
}
