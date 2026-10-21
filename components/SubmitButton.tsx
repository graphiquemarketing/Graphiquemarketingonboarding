'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, pending, className = 'btn', disabled, name, value }: {
  children: React.ReactNode; pending?: string; className?: string; disabled?: boolean; name?: string; value?: string;
}) {
  const s = useFormStatus();
  return (
    <button className={className} type="submit" disabled={disabled || s.pending} aria-disabled={disabled || s.pending} name={name} value={value}>
      {s.pending ? pending ?? 'Procesando…' : children}
    </button>
  );
}
