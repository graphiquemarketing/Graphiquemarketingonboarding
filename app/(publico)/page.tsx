import Link from 'next/link';
import { Icon } from '@/components/Icon';

export default function Bienvenida() {
  return (
    <div className="wrap stack" style={{ gap: 28 }}>
      <section className="hero rise">
        <div className="stack" style={{ gap: 18 }}>
          <span className="kicker" style={{ color: '#FFB3DA' }}>Portal de clientes</span>
          <h1>Tu proyecto con Graphique, en un solo lugar.</h1>
          <p>Completa tu brief, comparte tus archivos y sigue cada aprobación con historial. Privado, guiado y a tu ritmo.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <Link className="btn lg" href="/acceso">Entrar con mi correo <Icon name="arrowRight" size={18} /></Link>
            <Link className="btn lg ghost" style={{ color: '#fff', border: '1px solid rgba(255,255,255,.3)' }} href="/solicitud">Solicitar una propuesta</Link>
          </div>
        </div>
      </section>

      <section className="choice">
        <div className="panel">
          <span className="badge-ico"><Icon name="folder" size={22} /></span>
          <h2>¿Ya eres cliente?</h2>
          <p className="muted">Entra con el correo al que llegó tu invitación. Te enviamos un código de acceso; no necesitas contraseña.</p>
          <div><Link className="btn" href="/acceso">Entrar a mis proyectos <Icon name="arrowRight" size={16} /></Link></div>
        </div>
        <div className="panel">
          <span className="badge-ico"><Icon name="sparkle" size={22} /></span>
          <h2>¿Quieres una propuesta?</h2>
          <p className="muted">Cuéntanos de tu proyecto y te contactamos. Solicitar no es contratar: primero entendemos tu negocio.</p>
          <div><Link className="btn soft" href="/solicitud">Solicitar propuesta</Link></div>
        </div>
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <h2>Cómo funciona</h2>
        <div className="steps-strip">
          <div><b>Solicitud</b><span>Nos cuentas qué necesitas.</span></div>
          <div><b>Propuesta</b><span>Te enviamos alcance e inversión.</span></div>
          <div><b>Brief guiado</b><span>10 módulos, con autoguardado.</span></div>
          <div><b>Aprobación</b><span>Versión firmada y lista para producir.</span></div>
        </div>
      </section>
    </div>
  );
}
