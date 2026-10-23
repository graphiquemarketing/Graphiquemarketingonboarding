'use client';
import { useRef } from 'react';

/** Casillas para el código; admite pegar el código completo (WCAG 3.3.8). */
export function CodeInput({ name = 'token', invalid, length = 6 }: { name?: string; invalid?: boolean; length?: number }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const hidden = useRef<HTMLInputElement | null>(null);
  const sync = () => { if (hidden.current) hidden.current.value = refs.current.map((r) => r?.value ?? '').join(''); };
  const idx = Array.from({ length }, (_, i) => i);
  return (
    <fieldset className="field">
      <legend>Código de {length} dígitos</legend>
      <div className="code" style={length > 6 ? { gap: 6 } : undefined}>
        {idx.map((i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" maxLength={1} aria-label={`Dígito ${i + 1} de ${length}`}
            aria-invalid={invalid || undefined} autoComplete={i === 0 ? 'one-time-code' : 'off'} autoFocus={i === 0}
            style={length > 6 ? { width: 38, height: 50, fontSize: 20 } : undefined}
            onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 1); sync(); if (e.target.value) refs.current[i + 1]?.focus(); }}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !e.currentTarget.value) refs.current[i - 1]?.focus(); }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
              if (!t) return;
              e.preventDefault();
              refs.current.forEach((r, j) => { if (r) r.value = t[j] ?? ''; });
              sync(); refs.current[Math.min(t.length, length - 1)]?.focus();
            }} />
        ))}
      </div>
      <input type="hidden" name={name} ref={hidden} />
    </fieldset>
  );
}
