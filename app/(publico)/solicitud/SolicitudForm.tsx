'use client';
import { useActionState, useEffect, useState } from 'react';
import { PACKAGES, PACKAGE_CODES, CATALOG_VERSION, type PackageCode } from '@/lib/catalog';
import { track } from '@/lib/analytics';
import { SubmitButton } from '@/components/SubmitButton';
import { createRequestAction, type SolicitudState } from './actions';

export function SolicitudForm({ initialPlan, utm }: { initialPlan: PackageCode | null; utm: Record<string, string> }) {
  const [state, action] = useActionState<SolicitudState, FormData>(createRequestAction, {});
  const [plan, setPlan] = useState<PackageCode | null>((state.values?.paquete as PackageCode) ?? initialPlan);
  const [t0] = useState(() => String(Date.now()));
  const e = state.errors ?? {};
  const v = state.values ?? {};
  useEffect(() => { if (initialPlan) track('package_cta_click', { paquete: initialPlan }, `cta:${initialPlan}`); }, [initialPlan]);
  const err = (k: string) => (e[k] ? <p className="err" id={`e_${k}`}>{e[k]}</p> : null);
  const aria = (k: string) => (e[k] ? { 'aria-invalid': true, 'aria-describedby': `e_${k}` } : {});
  return (
    <form action={action} className="stack" noValidate onInput={() => track('onboarding_request_start', { paquete: plan ?? 'sin_paquete' }, 'req_start')}>
      {Object.keys(e).length > 0 && (
        <div className="note bad" role="alert"><b>Revisa estos datos:</b><ul>{Object.entries(e).map(([k, m]) => <li key={k}><a href={`#s_${k}`}>{m}</a></li>)}</ul></div>
      )}
      {state.message && <div className="note bad" role="alert">{state.message}</div>}
      <fieldset className="field">
        <legend>Paquete de interés <span className="req">*</span></legend>
        <div className="pkg-grid" id="s_paquete">
          {PACKAGE_CODES.map((k) => {
            const P = PACKAGES[k];
            return (
              <label key={k} className="pkg">
                <input type="radio" name="paquete" value={k} checked={plan === k} onChange={() => setPlan(k)} aria-label={`${P.name}, ${P.priceLabel}`} />
                <b>{P.name}</b>
                <span className="sub">{P.sub}</span>
                <span className="lim">{P.limitLabel}</span>
                <span className="price">{P.priceLabel}</span>
              </label>
            );
          })}
        </div>
        {err('paquete')}
        <p className="help">Precios de entrada del catálogo {CATALOG_VERSION}. La propuesta final depende del alcance.</p>
      </fieldset>
      <div className="fgrid">
        {([['nombre', 'Nombre', 'text', 'given-name'], ['apellidos', 'Apellidos', 'text', 'family-name'], ['empresa', 'Nombre de la empresa', 'text', 'organization'], ['telefono', 'Número de teléfono', 'tel', 'tel'], ['correo', 'Correo', 'email', 'email']] as const).map(([k, l, t, ac]) => (
          <div className="field" key={k}>
            <label htmlFor={`s_${k}`}>{l} <span className="req">*</span></label>
            <input id={`s_${k}`} name={k} type={t} autoComplete={ac} defaultValue={v[k]} required {...aria(k)} />
            {err(k)}
          </div>
        ))}
        <div className="field">
          <label htmlFor="s_sitio">URL del sitio web (opcional)</label>
          <input id="s_sitio" name="sitio" type="text" inputMode="url" autoComplete="url" placeholder="empresa.com.mx" defaultValue={v.sitio} maxLength={200} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="s_comentario">Comentario (opcional)</label>
        <textarea id="s_comentario" name="comentario" defaultValue={v.comentario} maxLength={2000} placeholder="Qué quieres lograr. No adjuntes información confidencial en este paso." />
      </div>
      <input type="text" name="website2" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} />
      <input type="hidden" name="t0" value={t0} />
      <input type="hidden" name="cta" value={v.cta ?? utm.cta ?? ''} />
      {Object.entries(utm).filter(([k]) => k.startsWith('utm_')).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <label className="check" htmlFor="s_privacidad">
        <input id="s_privacidad" type="checkbox" name="privacidad" defaultChecked={v.privacidad === 'on'} {...aria('privacidad')} />
        <span>Acepto el <a href="https://graphiquemarketing.com.mx/aviso-de-privacidad/" target="_blank" rel="noopener">Aviso de Privacidad</a>. Graphique usará estos datos para atender la solicitud y preparar la propuesta. <span className="req">*</span></span>
      </label>
      {err('privacidad')}
      <div className="row"><SubmitButton pending="Enviando…">Enviar solicitud</SubmitButton><span className="small muted">Solo pedimos lo necesario para contactarte.</span></div>
    </form>
  );
}
