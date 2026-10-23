import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/montserrat/wght.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Portal de clientes · Graphique Marketing', template: '%s · Portal Graphique' },
  description: 'Brief, archivos y aprobaciones de tu proyecto con Graphique Marketing.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FFFFFF' }, { media: '(prefers-color-scheme: dark)', color: '#120E14' }],
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const staging = process.env.PORTAL_ENV !== 'production';
  return (
    <html lang="es-MX">
      <body>
        <a className="skip" href="#contenido">Saltar al contenido</a>
        {staging && <div className="testbar gut" role="note"><b>STAGING</b> · datos de prueba · no conectado al sitio público ni a producción</div>}
        {children}
      </body>
    </html>
  );
}
