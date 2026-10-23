import Link from 'next/link';
export const metadata = { title: 'Invitación vencida' };
export default function Vencido() {
  return (
    <div className="narrow stack rise" style={{ paddingBlock: 24 }}>
      <div className="big">72 h</div>
      <h1>Tu enlace venció</h1>
      <p className="lead">Por seguridad, los enlaces de invitación y de activación funcionan una sola vez y por tiempo limitado. Responde el correo que recibiste o escribe a contacto@graphiquemarketing.com.mx y te enviaremos uno nuevo.</p>
      <p className="muted">Si ya aceptaste tu invitación antes, entra directamente con tu correo.</p>
      <div className="row"><Link className="btn" href="/acceso">Entrar con mi correo</Link><Link className="btn line" href="/">Inicio del portal</Link></div>
    </div>
  );
}
