import Link from 'next/link';
import { STATE_LABEL, STATE_TONE, rank, type ProjectState } from '@/lib/states';
import { SCOPE_LABEL, type ScopeClass } from '@/lib/scope';

export function StatePill({ state }: { state: ProjectState }) {
  return <span className={`pill tone-${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>;
}

const SCOPE_TONE: Record<ScopeClass, string> = {
  INCLUIDA: 'ok', NO_INCLUIDA: 'bad', PENDIENTE: 'com', ADICIONAL: 'bad', ADICIONAL_APROBADA: 'lead', NO_APLICA: 'na',
};
export function ScopePill({ c }: { c: ScopeClass }) {
  return <span className={`pill tone-${SCOPE_TONE[c]}`}>{SCOPE_LABEL[c]}</span>;
}

export function Note({ tone, children }: { tone?: 'warn' | 'bad' | 'ok'; children: React.ReactNode }) {
  return <div className={`note${tone ? ` ${tone}` : ''}`}>{children}</div>;
}

export function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="small" href={href}>← {children}</Link>;
}

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
}

export function kb(n: number) { return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }

const STEPS: [ProjectState, string][] = [
  ['CONTRATADO', 'Contratado'], ['BRIEF_EN_PROGRESO', 'Brief en progreso'], ['BRIEF_ENVIADO', 'Brief enviado'],
  ['EN_REVISION', 'Revisión de Graphique'], ['BRIEF_APROBADO', 'Brief aprobado'], ['LISTO_PARA_PLANEACION', 'Planeación técnica'],
];
/** Línea de tiempo del expediente para el cliente. */
export function Timeline({ state }: { state: ProjectState }) {
  const cur = state === 'INFORMACION_PENDIENTE' ? 'EN_REVISION' : state === 'INVITACION_PENDIENTE' ? 'CONTRATADO' : state;
  const r = rank(cur);
  return (
    <ol className="tl" aria-label="Estado del expediente">
      {STEPS.map(([s, label]) => {
        const sr = rank(s);
        const cls = s === cur && s !== 'LISTO_PARA_PLANEACION' ? 'cur' : sr <= r ? 'done' : '';
        return <li key={s} className={cls} aria-current={cls === 'cur' ? 'step' : undefined}>{label}{state === 'INFORMACION_PENDIENTE' && s === 'EN_REVISION' ? ' · esperando tus aclaraciones' : ''}</li>;
      })}
    </ol>
  );
}
