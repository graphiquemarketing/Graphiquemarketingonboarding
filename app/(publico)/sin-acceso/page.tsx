import Link from 'next/link';
export const metadata = { title: 'Sin acceso' };
export default function SinAcceso() {
  return (
    <div className="narrow stack rise" style={{ paddingBlock: 24 }}>
      <div className="big">403</div>
      <h1>No tienes acceso a esta sección</h1>
      <p className="lead">Tu cuenta no forma parte de este proyecto o de este equipo. Si crees que es un error, pide a la persona responsable que te invite o escribe a contacto@graphiquemarketing.com.mx.</p>
      <div className="row"><Link className="btn" href="/cliente">Ir a mis proyectos</Link><Link className="btn line" href="/">Inicio del portal</Link></div>
    </div>
  );
}
