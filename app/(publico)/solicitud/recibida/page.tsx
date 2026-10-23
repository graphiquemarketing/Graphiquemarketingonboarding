import Link from 'next/link';
import { Track } from '@/components/Track';
import { isPackageCode } from '@/lib/catalog';

export const metadata = { title: 'Solicitud recibida' };
export default async function Recibida({ searchParams }: { searchParams: Promise<{ folio?: string; paquete?: string }> }) {
  const { folio, paquete } = await searchParams;
  const safeFolio = /^GM-\d{4}-\d{4,}$/.test(folio ?? '') ? folio : null;
  return (
    <div className="narrow stack rise" style={{ paddingBlock: 16 }}>
      {safeFolio && isPackageCode(paquete) && <Track event="onboarding_request_submit" params={{ paquete }} dedupe={`req:${safeFolio}`} />}
      <span className="kicker">Solicitud recibida</span>
      <h1>Gracias, ya tenemos tu <span className="g">solicitud</span></h1>
      {safeFolio && <div className="panel flat row between"><span className="muted small">Tu folio</span><b className="mono" style={{ fontSize: 20 }}>{safeFolio}</b></div>}
      <p className="lead">Te enviamos una confirmación por correo.</p>
      <div className="note">Esto no confirma una contratación ni fija un precio.</div>
      <div className="panel"><ol className="tl"><li className="cur">Te contactamos para entender tu proyecto</li><li>Te enviamos una propuesta</li><li>Contratación</li><li>Invitación al portal para tu brief</li></ol></div>
      <div className="row"><a className="btn soft" href="https://graphiquemarketing.com.mx/">Volver al sitio</a><Link className="btn line" href="/">Inicio del portal</Link></div>
    </div>
  );
}
