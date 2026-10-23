import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';
export default function NotFound() {
  return (
    <PublicShell>
      <div className="narrow stack" style={{ paddingBlock: 40 }}>
        <div className="big">404</div>
        <h1>No encontramos esta página</h1>
        <p className="lead">El enlace puede estar incompleto, la página cambió de lugar o tu cuenta no tiene acceso a ese proyecto.</p>
        <div className="row"><Link className="btn" href="/">Ir al inicio del portal</Link></div>
      </div>
    </PublicShell>
  );
}
