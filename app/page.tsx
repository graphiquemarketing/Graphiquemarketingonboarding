import Link from 'next/link';

export default function Bienvenida() {
  return (
    <div className="narrow stack">
      <span className="kicker">Portal de clientes</span>
      <h1>Organiza tu proyecto con <span className="g">Graphique</span></h1>
      <p className="muted">Brief, archivos, aclaraciones y aprobaciones en un solo lugar, privado y con historial de cada versión.</p>
      <div className="cards">
        <div className="panel stack">
          <h2>¿Ya eres cliente?</h2>
          <p className="small muted">Entra con el correo al que llegó tu invitación. Te enviamos un código; no necesitas contraseña.</p>
          <Link className="btn" href="/acceso">Entrar con mi correo</Link>
        </div>
        <div className="panel stack">
          <h2>¿Quieres una propuesta?</h2>
          <p className="small muted">Cuéntanos de tu proyecto y te contactamos. Solicitar no es contratar.</p>
          <Link className="btn soft" href="/solicitud">Solicitar</Link>
        </div>
      </div>
    </div>
  );
}
