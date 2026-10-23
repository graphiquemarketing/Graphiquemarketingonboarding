import { Logo } from './brand';
import { Icon, type IconName } from './Icon';

const DEFAULT: [IconName, string][] = [
  ['layers', 'Brief guiado en 10 módulos, adaptado a tu paquete.'],
  ['upload', 'Archivos privados, con versiones y enlaces temporales.'],
  ['shield', 'Cada aprobación queda registrada y versionada.'],
];

/** Pantalla dividida: panel de marca + formulario. Se usa en todos los accesos. */
export function AuthSplit({ title, kicker, intro, children, points = DEFAULT, claim = 'Tu proyecto, organizado desde el primer día.' }: {
  title: React.ReactNode; kicker?: string; intro?: React.ReactNode; children: React.ReactNode; points?: [IconName, string][]; claim?: string;
}) {
  return (
    <div className="auth">
      <aside className="auth-brand" aria-label="Graphique Marketing">
        <Logo onDark height={46} className="logo" />
        <div className="stack" style={{ gap: 18 }}>
          <h2>{claim}</h2>
          <p>Estrategia, diseño y tecnología con un mismo objetivo: generar negocio. Aquí sigues cada paso de tu proyecto con nosotros.</p>
        </div>
        <ul className="auth-points">
          {points.map(([i, t]) => <li key={t}><span><Icon name={i} size={16} /></span>{t}</li>)}
        </ul>
      </aside>
      <div className="auth-form">
        <div className="auth-card rise">
          <Logo height={36} className="mobile-logo" />
          <div className="stack" style={{ gap: 8 }}>
            {kicker && <span className="kicker">{kicker}</span>}
            <h1>{title}</h1>
            {intro && <div className="muted">{intro}</div>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
