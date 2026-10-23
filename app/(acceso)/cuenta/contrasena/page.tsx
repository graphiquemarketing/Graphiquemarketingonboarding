import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { PasswordForm } from './PasswordForm';
import { AuthSplit } from '@/components/AuthSplit';

export const metadata = { title: 'Crea tu contraseña' };

export default async function Contrasena() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/enlace-vencido');
  return (
    <AuthSplit kicker="Equipo Graphique" title="Crea tu contraseña" claim="Bienvenido al equipo del portal."
      intro={<>Cuenta: <b>{user.email}</b>. Después entrarás al panel y configurarás tu verificación en dos pasos.</>}>
      <div className="panel lg"><PasswordForm /></div>
    </AuthSplit>
  );
}
