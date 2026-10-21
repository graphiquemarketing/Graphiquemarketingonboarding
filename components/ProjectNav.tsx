import Link from 'next/link';

const TABS = [['', 'Estado'], ['/brief/M01', 'Brief'], ['/archivos', 'Archivos'], ['/resumen', 'Resumen'], ['/aclaraciones', 'Aclaraciones']] as const;

export function ProjectNav({ id, current, pendingReviews }: { id: string; current: string; pendingReviews?: number }) {
  return (
    <nav className="steps" aria-label="Secciones del proyecto">
      {TABS.map(([path, label]) => (
        <Link key={path} href={`/cliente/proyectos/${id}${path}`} aria-current={current === label ? 'page' : undefined}
          style={current === label ? { borderColor: 'var(--magenta)', color: 'var(--magenta)' } : undefined}>
          {label}{label === 'Aclaraciones' && pendingReviews ? ` (${pendingReviews})` : ''}
        </Link>
      ))}
    </nav>
  );
}
