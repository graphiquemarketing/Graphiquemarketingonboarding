'use client';
import { useRef } from 'react';

/** Seis casillas para el código; admite pegar el código completo (WCAG 3.3.8). */
export function CodeInput({ name = 'token', invalid }: { name?: string; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const hidden = useRef<HTMLInputElement | null>(null);
  const sync = () => { if (hidden.current) hidden.current.value = refs.current.map((r) => r?.value ?? '').join(''); };
  return (
    <fieldset className="field">
      <legend>Código de 6 dígitos</legend>
      <div className="code">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" maxLength={1} aria-label={`Dígito ${i + 1}`}
            aria-invalid={invalid || undefined} autoComplete={i === 0 ? 'one-time-code' : 'off'} autoFocus={i === 0}
            onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 1); sync(); if (e.target.value) refs.current[i + 1]?.focus(); }}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !e.currentTarget.value) refs.current[i - 1]?.focus(); }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
              if (!t) return;
              e.preventDefault();
              refs.current.forEach((r, j) => { if (r) r.value = t[j] ?? ''; });
              sync(); refs.current[Math.min(t.length, 5)]?.focus();
            }} />
        ))}
      </div>
      <input type="hidden" name={name} ref={hidden} />
    </fieldset>
  );
}
