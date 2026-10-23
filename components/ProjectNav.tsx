import Link from 'next/link';

const TABS = [['', 'Estado'], ['/brief/M01', 'Brief'], ['/archivos', 'Archivos'], ['/resumen', 'Resumen'], ['/aclaraciones', 'Aclaraciones']] as const;

export function ProjectNav({ id, current, pendingReviews }: { id: string; current: string; pendingReviews?: number }) {
  return (
    <nav className="steps" aria-label="Secciones del proyecto">
      {TABS.map(([path, label]) => (
        <Link key={path} href={`/cliente/proyectos/${id}${path}`} aria-current={current === label ? 'page' : undefined}>
          {label}{label === 'Aclaraciones' && pendingReviews ? <span className="pill tone-bad" style={{ padding: '0 7px' }}>{pendingReviews}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
