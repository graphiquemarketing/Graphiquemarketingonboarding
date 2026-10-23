'use client';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import type { ActionResult } from '@/lib/errors';
import { addMemberAction } from './actions';

export function AddMember({ email, name }: { email?: string; name?: string }) {
  const [s, action] = useActionState<ActionResult, FormData>(addMemberAction, { ok: true });
  const k = email ?? 'nuevo';
  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <div className="fgrid">
        <div className="field"><label htmlFor={`am_e_${k}`}>Correo</label><input id={`am_e_${k}`} name="email" type="email" required defaultValue={email} readOnly={!!email} /></div>
        <div className="field"><label htmlFor={`am_n_${k}`}>Nombre</label><input id={`am_n_${k}`} name="name" required maxLength={80} defaultValue={name} /></div>
        <div className="field"><label htmlFor={`am_r_${k}`}>Rol</label>
          <select id={`am_r_${k}`} name="role" defaultValue="pm">
            <option value="comercial">Comercial</option><option value="pm">PM / revisor</option><option value="admin_tecnico">Administrador técnico</option>
          </select></div>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="is_admin" /><span>Administra el equipo</span></label>
      </div>
      <div className="row"><SubmitButton pending="Dando de alta…">{email ? 'Asignar rol y enviar activación' : 'Dar de alta y enviar activación'}</SubmitButton></div>
      {!s.ok && <p className="err" role="alert">{s.error}</p>}
      {s.ok && s.message && <p className="small t-ok" role="status">{s.message}</p>}
    </form>
  );
}
