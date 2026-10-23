import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { InviteFlow } from './InviteFlow';
import { AuthSplit } from '@/components/AuthSplit';

export const metadata = { title: 'Invitación' };

export default async function Invitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) redirect('/enlace-vencido');
  const sb = await supabaseServer();
  const { data: inv } = await sb.rpc('invitation_info', { p_token: token })
    .maybeSingle<{ folio: string; organization: string; email_masked: string; email: string; status: string }>();
  if (!inv || inv.status === 'VENCIDA' || inv.status === 'REVOCADA') redirect('/enlace-vencido');
  if (inv.status === 'ACEPTADA') redirect('/acceso');
  const { data: { user } } = await sb.auth.getUser();
  const sameUser = user?.email?.toLowerCase() === inv.email.toLowerCase();
  return (
    <AuthSplit kicker={`Invitación · ${inv.folio}`} claim="Bienvenido. Empecemos tu proyecto con claridad."
      title={<>Bienvenido al portal de <span className="g">{inv.organization}</span></>}
      intro="Aquí completarás el brief, subirás tus archivos y verás cada paso de la revisión. Toma unos 25 minutos y puedes pausarlo cuando quieras.">
      {user && !sameUser && <div className="note warn">Entraste con otro correo. Esta invitación es para {inv.email_masked}; <a href="/salir">cierra sesión</a> para continuar.</div>}
      <div className="panel lg"><InviteFlow token={token} emailMasked={inv.email_masked} signedInAs={sameUser ? user!.email! : null} /></div>
    </AuthSplit>
  );
}
