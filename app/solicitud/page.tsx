import { planFromParam } from '@/lib/catalog';
import { SolicitudForm } from './SolicitudForm';

export const metadata = { title: 'Solicitar propuesta' };

/** ?plan= solo preselecciona (SEC-01); el servidor valida el paquete contra el catálogo. */
export default async function Solicitud({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (v && (k.startsWith('utm_') || k === 'cta')) utm[k] = String(v).slice(0, 100);
  return (
    <div className="narrow stack">
      <span className="kicker">Solicitud</span>
      <h1>Cuéntanos de tu proyecto y <span className="g">te contactamos</span></h1>
      <div className="note">Enviar esta solicitud no es una contratación ni fija un precio. El portal de onboarding se abre cuando el proyecto está contratado.</div>
      <div className="panel"><SolicitudForm initialPlan={planFromParam(sp.plan)} utm={utm} /></div>
    </div>
  );
}
