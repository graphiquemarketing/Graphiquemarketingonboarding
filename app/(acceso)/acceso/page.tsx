import Link from 'next/link';
import { AuthSplit } from '@/components/AuthSplit';
import { AccessForm } from './AccessForm';
export const metadata = { title: 'Entrar' };
export default async function Acceso({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthSplit kicker="Acceso de clientes" title="Entra a tu portal" intro="Usa el correo al que llegó tu invitación. Te enviaremos un código; no necesitas contraseña.">
      <div className="panel lg"><AccessForm next={next} /></div>
      <p className="small muted">¿Eres del equipo Graphique? <Link href="/admin/acceso">Entra aquí</Link> · <Link href="/">Inicio del portal</Link></p>
    </AuthSplit>
  );
}
