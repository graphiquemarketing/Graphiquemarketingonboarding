import { Suspense } from 'react';
import { BrandLink } from '@/components/brand';
import { Icon } from '@/components/Icon';
import { StaffNav, type NavItem } from '@/components/StaffNav';
import { supabaseServer } from '@/lib/supabase/server';

const ROLE: Record<string, string> = { comercial: 'Comercial', pm: 'PM / revisor', admin_tecnico: 'Administrador técnico' };

/** Con sesión de personal (MFA) muestra la barra lateral; en /admin/acceso, la pantalla de acceso a pantalla completa. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  let staff: { role: string; display_name: string; is_admin: boolean } | null = null;
  if (user) {
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal2') {
      const { data } = await sb.from('staff').select('role, display_name, is_admin').eq('user_id', user.id).eq('active', true).maybeSingle();
      staff = data;
    }
  }
  if (!staff) return <main id="contenido" tabIndex={-1} style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</main>;
  const items: NavItem[] = [
    { href: '/admin', label: 'Proyectos', icon: 'briefcase', match: '/admin?vista=' },
    ...(staff.role === 'comercial' ? [{ href: '/admin/proyectos/nuevo', label: 'Alta desde HubSpot', icon: 'plus' as const }] : []),
    ...(staff.is_admin ? [{ href: '/admin/equipo', label: 'Equipo', icon: 'users' as const }] : []),
  ];
  const initials = staff.display_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="staff">
      <aside className="side">
        <BrandLink href="/admin" tag="Panel" onDark height={34} />
        <Suspense><StaffNav items={items} /></Suspense>
        <div className="side-user">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div style={{ minWidth: 0 }}><b>{staff.display_name}</b><span>{ROLE[staff.role]}{staff.is_admin ? ' · admin' : ''}</span></div>
          <form action="/salir" method="post"><button type="submit" title="Cerrar sesión"><Icon name="logout" size={17} /><span className="sr">Cerrar sesión</span></button></form>
        </div>
      </aside>
      <div className="staff-main">
        <div className="staff-top gut">
          <BrandLink href="/admin" tag="" onDark height={28} />
          <Suspense><StaffNav items={items} compact /></Suspense>
          <form action="/salir" method="post"><button className="iconbtn" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }} type="submit" title="Cerrar sesión"><Icon name="logout" size={16} /></button></form>
        </div>
        <main id="contenido" className="gut" tabIndex={-1}><div className="wrap">{children}</div></main>
      </div>
    </div>
  );
}
