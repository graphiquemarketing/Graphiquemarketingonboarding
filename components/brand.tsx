/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

/** Logotipo oficial; cambia a la versión clara en modo oscuro o sobre fondos de marca. */
export function Logo({ height = 38, onDark = false, className }: { height?: number; onDark?: boolean; className?: string }) {
  const w = Math.round((height * 1333) / 478);
  if (onDark) return <img src="/brand/logo-graphique-dark.png" alt="Graphique Marketing" width={w} height={height} style={{ height, width: 'auto' }} className={className} />;
  return (
    <picture className={className}>
      <source srcSet="/brand/logo-graphique-dark.png" media="(prefers-color-scheme: dark)" />
      <img src="/brand/logo-graphique.png" alt="Graphique Marketing" width={w} height={height} style={{ height, width: 'auto', display: 'block' }} />
    </picture>
  );
}

export function BrandLink({ href = '/', tag = 'Portal de clientes', onDark = false, height }: { href?: string; tag?: string; onDark?: boolean; height?: number }) {
  return (
    <Link className="brand" href={href} aria-label="Graphique Marketing · inicio del portal">
      <Logo onDark={onDark} height={height} />
      {tag && <span className="tag">{tag}</span>}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="ftr gut">
      <div className="wrap">
        <span>© {new Date().getFullYear()} Graphique Integral Solutions SA de CV · Marketing Honesto</span>
        <span className="row" style={{ gap: 18 }}>
          <a href="https://graphiquemarketing.com.mx/aviso-de-privacidad/" target="_blank" rel="noopener">Aviso de privacidad</a>
          <a href="https://graphiquemarketing.com.mx/terminos-y-condiciones/" target="_blank" rel="noopener">Términos</a>
          <a href="https://graphiquemarketing.com.mx/" target="_blank" rel="noopener">graphiquemarketing.com.mx</a>
        </span>
      </div>
    </footer>
  );
}
