import Link from 'next/link';
export const metadata = { title: 'Invitación vencida' };
export default function Vencido() {
  return (
    <div className="narrow stack">
      <div className="big">72 h</div>
      <h1>Tu invitación venció</h1>
      <p className="muted">Por seguridad, los enlaces de invitación duran 72 horas y se usan una sola vez. Responde el correo de invitación o escribe a contacto@graphiquemarketing.com.mx y te enviaremos uno nuevo al mismo correo.</p>
      <p className="muted">Si ya aceptaste la invitación antes, entra directamente con tu correo.</p>
      <div className="row"><Link className="btn" href="/acceso">Entrar con mi correo</Link></div>
    </div>
  );
}
