import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Portal de clientes · Graphique Marketing', template: '%s · Portal Graphique' },
  description: 'Brief, archivos y aprobaciones de tu proyecto con Graphique Marketing.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { themeColor: '#DD1786', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const staging = process.env.PORTAL_ENV !== 'production';
  return (
    <html lang="es-MX">
      <body>
        <a className="skip" href="#contenido">Saltar al contenido</a>
        {staging && (
          <div className="testbar gut" role="note">
            <div className="wrap">STAGING · datos de prueba · este portal no está conectado al sitio público ni a producción</div>
          </div>
        )}
        <header className="hdr gut">
          <div className="wrap">
            <Link className="brand" href="/"><i aria-hidden="true">G</i><span>Graphique Marketing<small>Portal de clientes</small></span></Link>
            <nav className="nav" aria-label="Accesos">
              <Link href="/cliente">Mis proyectos</Link>
              <Link href="/admin">Equipo Graphique</Link>
            </nav>
          </div>
        </header>
        <main id="contenido" className="gut" tabIndex={-1}>{children}</main>
        <footer className="ftr gut">
          <div className="wrap row between">
            <span>© {new Date().getFullYear()} Graphique Integral Solutions SA de CV</span>
            <span className="row">
              <a href="https://graphiquemarketing.com.mx/aviso-de-privacidad/" target="_blank" rel="noopener">Aviso de privacidad</a>
              <a href="https://graphiquemarketing.com.mx/" target="_blank" rel="noopener">graphiquemarketing.com.mx</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
