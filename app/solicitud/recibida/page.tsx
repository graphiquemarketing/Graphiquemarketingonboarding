import Link from 'next/link';
import { Track } from '@/components/Track';
import { isPackageCode } from '@/lib/catalog';

export const metadata = { title: 'Solicitud recibida' };
export default async function Recibida({ searchParams }: { searchParams: Promise<{ folio?: string; paquete?: string }> }) {
  const { folio, paquete } = await searchParams;
  const safeFolio = /^GM-\d{4}-\d{4,}$/.test(folio ?? '') ? folio : null;
  return (
    <div className="narrow stack">
      {safeFolio && isPackageCode(paquete) && <Track event="onboarding_request_submit" params={{ paquete }} dedupe={`req:${safeFolio}`} />}
      <span className="kicker">Solicitud recibida</span>
      <h1>Gracias, ya tenemos tu <span className="g">solicitud</span></h1>
      {safeFolio && <p>Folio <b className="mono">{safeFolio}</b>. Te enviamos una confirmación por correo.</p>}
      <div className="note">Esto no confirma una contratación ni fija un precio.</div>
      <ol className="tl"><li className="cur">Te contactamos para entender tu proyecto</li><li>Te enviamos una propuesta</li><li>Contratación</li><li>Invitación al portal para tu brief</li></ol>
      <div className="row"><a className="btn soft" href="https://graphiquemarketing.com.mx/">Volver al sitio</a><Link className="btn line" href="/">Inicio del portal</Link></div>
    </div>
  );
}
