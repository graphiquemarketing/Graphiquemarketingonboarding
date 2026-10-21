'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="narrow stack">
      <h1>Algo salió mal</h1>
      <p className="muted">No pudimos cargar esta página. Tus respuestas guardadas no se perdieron. Inténtalo de nuevo; si el problema sigue, escribe a contacto@graphiquemarketing.com.mx.</p>
      <div className="row"><button className="btn" type="button" onClick={reset}>Reintentar</button><Link className="btn line" href="/">Inicio del portal</Link></div>
    </div>
  );
}
