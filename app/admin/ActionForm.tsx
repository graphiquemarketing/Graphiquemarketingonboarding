'use client';
import { useActionState } from 'react';
import type { ActionResult } from '@/lib/errors';

/** Formulario genérico para acciones del panel con mensaje de resultado accesible. */
export function ActionForm({ action, children, className = 'stack' }: {
  action: (s: ActionResult, f: FormData) => Promise<ActionResult>; children: React.ReactNode; className?: string;
}) {
  const [s, run] = useActionState<ActionResult, FormData>(action, { ok: true });
  return (
    <form action={run} className={className}>
      {children}
      {!s.ok && <p className="err" role="alert">{s.error}</p>}
      {s.ok && s.message && <p className="small t-ok" role="status">{s.message}</p>}
    </form>
  );
}
