import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="narrow stack">
      <div className="big">404</div>
      <h1>No encontramos esta página</h1>
      <p className="muted">El enlace puede estar incompleto, la página cambió de lugar o tu cuenta no tiene acceso a ese proyecto.</p>
      <div className="row"><Link className="btn" href="/">Ir al inicio del portal</Link></div>
    </div>
  );
}
