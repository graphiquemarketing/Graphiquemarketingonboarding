import { requireTeamAdmin, type StaffRole } from '@/lib/server/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Note, PageHead } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { AddMember } from './AddMember';
import { MemberRow, type MemberView } from './MemberRow';

export const metadata = { title: 'Equipo' };

export default async function Equipo() {
  const { sb, user } = await requireTeamAdmin();
  const admin = supabaseAdmin();
  const [{ data: staff }, { data: members }, usersRes] = await Promise.all([
    sb.from('staff').select('user_id, role, display_name, active, is_admin').order('display_name'),
    admin.from('organization_members').select('user_id'),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const users = usersRes.data?.users ?? [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const clientIds = new Set((members ?? []).map((m) => m.user_id));
  const staffIds = new Set((staff ?? []).map((s) => s.user_id));
  const team: MemberView[] = (staff ?? []).map((s) => {
    const u = byId.get(s.user_id);
    return {
      user_id: s.user_id, email: u?.email ?? '—', name: s.display_name, role: s.role as StaffRole, active: s.active, is_admin: s.is_admin,
      mfa: (u?.factors ?? []).some((f) => f.status === 'verified'), last_sign_in: u?.last_sign_in_at ?? null, self: s.user_id === user.id,
    };
  });
  const loose = users.filter((u) => !staffIds.has(u.id) && !clientIds.has(u.id));
  const count = (r: StaffRole) => team.filter((m) => m.active && m.role === r).length;
  return (
    <div className="narrow stack" style={{ maxWidth: 860 }}>
      <PageHead kicker="Administración" title="Equipo de Graphique" intro="Da de alta personas, asigna su rol y controla quién tiene acceso al panel. Los clientes no aparecen aquí: entran solo por invitación a su proyecto." />
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="kpi"><span><Icon name="briefcase" size={15} />Comercial</span><b>{count('comercial')}</b><i>activos</i></div>
        <div className="kpi"><span><Icon name="layers" size={15} />PM / revisor</span><b>{count('pm')}</b><i>activos</i></div>
        <div className="kpi"><span><Icon name="shield" size={15} />Admin técnico</span><b>{count('admin_tecnico')}</b><i>activos</i></div>
      </div>
      {count('pm') === 0 && <Note tone="warn">No hay ningún PM activo. Sin PM nadie puede revisar ni aprobar briefs.</Note>}
      <div className="panel lg stack">
        <div className="row" style={{ gap: 12 }}><span className="badge-ico"><Icon name="plus" size={20} /></span><h2>Dar de alta a una persona</h2></div>
        <p className="small muted">Creamos su cuenta y le enviamos un correo para que ponga su contraseña. En su primer acceso configura la verificación en dos pasos.</p>
        <AddMember />
      </div>
      {loose.length > 0 && (
        <div className="panel stack">
          <h2>Cuentas sin rol</h2>
          <p className="small muted">Existen en Supabase pero no tienen acceso al panel. Asígnales un rol para activarlas.</p>
          {loose.map((u) => <div key={u.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}><AddMember email={u.email ?? ''} /></div>)}
        </div>
      )}
      <h2>Personas con acceso</h2>
      {team.map((m) => <MemberRow key={m.user_id} m={m} />)}
      <Note>Roles: <b>Comercial</b> gestiona solicitudes, contratación e invitaciones. <b>PM</b> revisa el brief, clasifica el alcance y aprueba. <b>Administrador técnico</b> ve los proyectos para dar soporte. «Administra el equipo» se suma a cualquier rol.</Note>
    </div>
  );
}
