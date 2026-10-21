import { AccessForm } from './AccessForm';
export const metadata = { title: 'Entrar' };
export default async function Acceso({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="narrow stack" style={{ maxWidth: 520 }}>
      <span className="kicker">Acceso de clientes</span>
      <h1>Entra a tu portal</h1>
      <div className="panel"><AccessForm next={next} /></div>
      <p className="small muted">¿Eres del equipo Graphique? <a href="/admin/acceso">Entra aquí</a>.</p>
    </div>
  );
}
