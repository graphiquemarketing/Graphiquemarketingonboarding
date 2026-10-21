import { StaffLogin } from './StaffLogin';
export const metadata = { title: 'Acceso del equipo' };
export default function StaffAccess() {
  return (
    <div className="narrow stack" style={{ maxWidth: 520 }}>
      <span className="kicker">Equipo Graphique</span>
      <h1>Entra al panel</h1>
      <p className="muted small">Contraseña y verificación en dos pasos obligatoria. Sin la segunda verificación, la base de datos no muestra ningún proyecto.</p>
      <div className="panel"><StaffLogin /></div>
    </div>
  );
}
