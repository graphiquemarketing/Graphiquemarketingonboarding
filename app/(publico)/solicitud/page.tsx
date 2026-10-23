import { planFromParam } from '@/lib/catalog';
import { SolicitudForm } from './SolicitudForm';

export const metadata = { title: 'Solicitar propuesta' };

/** ?plan= solo preselecciona (SEC-01); el servidor valida el paquete contra el catálogo. */
export default async function Solicitud({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (v && (k.startsWith('utm_') || k === 'cta')) utm[k] = String(v).slice(0, 100);
  return (
    <div className="narrow stack rise" style={{ maxWidth: 860, gap: 22 }}>
      <div className="stack" style={{ gap: 10 }}>
        <span className="kicker">Solicitud de propuesta</span>
        <h1>Cuéntanos de tu proyecto y <span className="g">te contactamos</span></h1>
        <p className="lead">Toma menos de dos minutos. Enviar la solicitud no es una contratación ni fija un precio: primero entendemos tu negocio y luego te proponemos el alcance.</p>
      </div>
      <div className="panel lg"><SolicitudForm initialPlan={planFromParam(sp.plan)} utm={utm} /></div>
    </div>
  );
}
