import Link from 'next/link';
import { BrandLink, Footer } from '@/components/brand';
import { Icon } from '@/components/Icon';
import { supabaseServer } from '@/lib/supabase/server';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const email = user?.email ?? '';
  return (
    <>
      <header className="hdr gut">
        <div className="wrap">
          <BrandLink href="/cliente" tag="Mi espacio" />
          <nav className="nav" aria-label="Cuenta">
            <Link href="/cliente"><Icon name="folder" size={16} /><span className="nl">Mis proyectos</span></Link>
            {email && <span className="who"><span className="avatar" aria-hidden="true">{email[0]?.toUpperCase()}</span><span className="sr">Sesión: </span><span className="nl" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span></span>}
            <form action="/salir" method="post"><button type="submit" title="Cerrar sesión"><Icon name="logout" size={16} /><span className="sr">Cerrar sesión</span></button></form>
          </nav>
        </div>
      </header>
      <main id="contenido" className="gut" tabIndex={-1}>{children}</main>
      <Footer />
    </>
  );
}
