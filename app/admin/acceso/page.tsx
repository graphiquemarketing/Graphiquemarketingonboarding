import { AuthSplit } from '@/components/AuthSplit';
import { StaffLogin } from './StaffLogin';
export const metadata = { title: 'Acceso del equipo' };
export default async function StaffAccess({ searchParams }: { searchParams: Promise<{ activada?: string }> }) {
  const { activada } = await searchParams;
  return (
    <AuthSplit kicker="Equipo Graphique" title="Entra al panel" claim="Operación clara, decisiones con fundamento."
      intro="Contraseña y verificación en dos pasos. Sin la segunda verificación no se muestra ningún proyecto."
      points={[['briefcase', 'Solicitudes, contratación e invitaciones en un flujo.'], ['layers', 'Revisión del brief y alcance contra el paquete.'], ['shield', 'Aprobaciones versionadas con huella y auditoría.']]}>
      {activada && <div className="note ok" role="status">Contraseña guardada. Entra con tu correo y contraseña; después configurarás tu verificación en dos pasos.</div>}
      <div className="panel lg"><StaffLogin /></div>
    </AuthSplit>
  );
}
