'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon, type IconName } from './Icon';

export interface NavItem { href: string; label: string; icon: IconName; match?: string }

export function StaffNav({ items, compact = false }: { items: NavItem[]; compact?: boolean }) {
  const path = usePathname();
  const sp = useSearchParams();
  const full = `${path}${sp.toString() ? `?${sp}` : ''}`;
  const active = (it: NavItem) => (it.match ? full.startsWith(it.match) || (it.match === '/admin?vista=' && path.startsWith('/admin/proyectos/') && !path.startsWith('/admin/proyectos/nuevo')) : path === it.href);
  return (
    <nav className={compact ? undefined : 'side-nav'} aria-label="Panel de Graphique">
      {!compact && <span className="lbl">Operación</span>}
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={active(it) ? 'page' : undefined}>
          {!compact && <Icon name={it.icon} size={18} />}{it.label}
        </Link>
      ))}
    </nav>
  );
}
