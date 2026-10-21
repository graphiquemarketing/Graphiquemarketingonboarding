import { requireStaff } from '@/lib/server/session';
import { PACKAGES, PACKAGE_CODES } from '@/lib/catalog';
import { Back, Note } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionForm } from '../../ActionForm';
import { createManualAction } from '../../actions';

export const metadata = { title: 'Alta de proyecto' };

/** Coexistencia de CTA: el lead llega por el brief comercial del sitio a HubSpot y aquí se da de alta en el portal. */
export default async function Nuevo() {
  await requireStaff(['comercial']);
  return (
    <div className="narrow stack">
      <Back href="/admin">Proyectos</Back>
      <h1>Alta de proyecto desde HubSpot</h1>
      <Note>Los CTA del sitio siguen enviando leads a HubSpot. Copia aquí los datos del contacto para abrir su expediente. Si el correo ya tiene una solicitud abierta, se unirá a ella.</Note>
      <div className="panel">
        <ActionForm action={createManualAction}>
          <div className="fgrid">
            <div className="field"><label htmlFor="n_nombre">Nombre del contacto</label><input id="n_nombre" name="nombre" required /></div>
            <div className="field"><label htmlFor="n_empresa">Empresa</label><input id="n_empresa" name="empresa" required /></div>
            <div className="field"><label htmlFor="n_correo">Correo</label><input id="n_correo" name="correo" type="email" required /></div>
            <div className="field"><label htmlFor="n_tel">Teléfono</label><input id="n_tel" name="telefono" type="tel" required /></div>
            <div className="field"><label htmlFor="n_pkg">Paquete</label><select id="n_pkg" name="package">{PACKAGE_CODES.map((k) => <option key={k} value={k}>{PACKAGES[k].name} · {PACKAGES[k].priceLabel}</option>)}</select></div>
            <div className="field"><label htmlFor="n_origen">Origen</label><select id="n_origen" name="origen"><option value="hubspot">HubSpot (brief del sitio)</option><option value="manual">Otro (llamada, referido)</option></select></div>
          </div>
          <div className="field"><label htmlFor="n_com">Comentario</label><textarea id="n_com" name="comentario" maxLength={2000} /></div>
          <div><SubmitButton pending="Creando…">Crear expediente</SubmitButton></div>
        </ActionForm>
      </div>
    </div>
  );
}
