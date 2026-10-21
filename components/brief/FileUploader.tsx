'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FILE_CATEGORIES, checkFile, sniff, extOf, ALLOWED } from '@/lib/files';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { confirmFileAction, registerFileAction } from '@/app/cliente/actions';

type Item = { name: string; state: 'subiendo' | 'listo' | 'error'; msg?: string };

/** Registra la ruta en el servidor, sube directo a Storage (RLS) y confirma tamaño. Nada se sobrescribe. */
export function FileUploader({ projectId, replaceKey, replaceName }: { projectId: string; replaceKey?: string; replaceName?: string }) {
  const router = useRouter();
  const [cat, setCat] = useState<string>(FILE_CATEGORIES[0]);
  const [items, setItems] = useState<Item[]>([]);
  const upd = (name: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.name === name ? { ...x, ...patch } : x)));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setItems(list.map((f) => ({ name: f.name, state: 'subiendo' })));
    const sb = supabaseBrowser();
    for (const f of list) {
      const c = checkFile(f.name, f.size, f.type);
      if (!c.ok) { upd(f.name, { state: 'error', msg: c.error }); continue; }
      const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
      if (!sniff(extOf(f.name), head)) { upd(f.name, { state: 'error', msg: `${f.name}: el contenido no corresponde a un archivo .${extOf(f.name)}.` }); continue; }
      const reg = await registerFileAction(projectId, { fileKey: replaceKey ?? null, category: cat, name: f.name, size: f.size, mime: f.type || c.mime });
      if (!reg.ok) { upd(f.name, { state: 'error', msg: reg.error }); continue; }
      const { error } = await sb.storage.from('expedientes').upload(reg.data!.path, f, { contentType: reg.data!.mime, upsert: false });
      if (error) { upd(f.name, { state: 'error', msg: `${f.name}: no terminó de subir. Revisa tu conexión e inténtalo de nuevo.` }); continue; }
      const conf = await confirmFileAction(projectId, reg.data!.fileId);
      upd(f.name, conf.ok ? { state: 'listo' } : { state: 'error', msg: conf.error });
    }
    router.refresh();
  }

  return (
    <div className="stack">
      {replaceName && <p className="small">Subirás una <b>nueva versión</b> de {replaceName}. La anterior se conserva en el historial.</p>}
      <div className="fgrid">
        {!replaceKey && (
          <div className="field"><label htmlFor="f_cat">Categoría</label>
            <select id="f_cat" value={cat} onChange={(e) => setCat(e.target.value)}>{FILE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        )}
        <div className="field"><label htmlFor={`f_in_${replaceKey ?? 'new'}`}>{replaceKey ? 'Archivo' : 'Archivos'}</label>
          <input id={`f_in_${replaceKey ?? 'new'}`} type="file" multiple={!replaceKey} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }}
            accept={Object.keys(ALLOWED).map((x) => `.${x}`).join(',')} aria-describedby="f_help" /></div>
      </div>
      <p className="help" id="f_help">PDF, Office, imágenes, Illustrator/Photoshop, video y ZIP. Límite por tipo: PDF y Office 25 MB, ZIP 200 MB, video 500 MB. No subas contraseñas.</p>
      {items.length > 0 && (
        <ul className="files" aria-live="polite">
          {items.map((i) => (
            <li key={i.name}><span>{i.name}{i.msg && <><br /><span className="err">{i.msg}</span></>}</span>
              <span className={`pill tone-${i.state === 'listo' ? 'ok' : i.state === 'error' ? 'bad' : 'lead'}`}>{i.state === 'listo' ? 'Recibido' : i.state === 'error' ? 'Rechazado' : 'Subiendo…'}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
