import Link from 'next/link';
import { BrandLink, Footer } from './brand';
import { Icon } from './Icon';

export function PublicHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="hdr gut">
      <div className="wrap">
        <BrandLink />
        <nav className="nav" aria-label="Accesos">
          {right ?? (<>
            <Link href="/acceso"><Icon name="folder" size={16} /><span className="nl">Mis proyectos</span></Link>
            <Link href="/admin"><Icon name="lock" size={16} /><span className="nl">Equipo</span></Link>
          </>)}
        </nav>
      </div>
    </header>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (<><PublicHeader /><main id="contenido" className="gut" tabIndex={-1}>{children}</main><Footer /></>);
}
