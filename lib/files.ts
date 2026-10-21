/** Reglas de archivos (sección 09 del brief). Los límites se validan aquí, en el bucket y al confirmar la carga. */
export const FILE_CATEGORIES = [
  'Identidad', 'Fotografías', 'Videos', 'Textos', 'Catálogos', 'Presentaciones', 'Casos', 'Referencias', 'Documentos técnicos', 'Otros',
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** Extensión → { MB máximos, tipos MIME aceptados }. Lo que no está aquí se rechaza (incluye ejecutables). */
export const ALLOWED: Record<string, { mb: number; mime: string[] }> = {
  pdf: { mb: 25, mime: ['application/pdf'] },
  doc: { mb: 25, mime: ['application/msword'] },
  docx: { mb: 25, mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  xls: { mb: 25, mime: ['application/vnd.ms-excel'] },
  xlsx: { mb: 25, mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  ppt: { mb: 50, mime: ['application/vnd.ms-powerpoint'] },
  pptx: { mb: 50, mime: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'] },
  txt: { mb: 5, mime: ['text/plain'] },
  csv: { mb: 10, mime: ['text/csv', 'text/plain', 'application/vnd.ms-excel'] },
  jpg: { mb: 25, mime: ['image/jpeg'] },
  jpeg: { mb: 25, mime: ['image/jpeg'] },
  png: { mb: 25, mime: ['image/png'] },
  webp: { mb: 25, mime: ['image/webp'] },
  svg: { mb: 5, mime: ['image/svg+xml'] },
  ai: { mb: 100, mime: ['application/postscript', 'application/pdf', 'application/illustrator'] },
  eps: { mb: 100, mime: ['application/postscript'] },
  psd: { mb: 200, mime: ['image/vnd.adobe.photoshop', 'application/octet-stream'] },
  mp4: { mb: 500, mime: ['video/mp4'] },
  mov: { mb: 500, mime: ['video/quicktime'] },
  zip: { mb: 200, mime: ['application/zip', 'application/x-zip-compressed'] },
};

/** Cuota total por proyecto (pendiente de confirmar por Graphique). */
export const PROJECT_QUOTA_MB = 2048;

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export type FileCheck = { ok: true; ext: string; mime: string } | { ok: false; error: string };

export function checkFile(name: string, size: number, mime: string): FileCheck {
  const ext = extOf(name);
  const rule = ALLOWED[ext];
  if (!rule) return { ok: false, error: `${name}: el tipo .${ext || '?'} no está permitido. Formatos aceptados: ${Object.keys(ALLOWED).join(', ')}.` };
  if (size <= 0) return { ok: false, error: `${name}: el archivo está vacío.` };
  if (size > rule.mb * 1048576) return { ok: false, error: `${name}: pesa ${(size / 1048576).toFixed(1)} MB y el límite para .${ext} es ${rule.mb} MB.` };
  const m = (mime || '').toLowerCase();
  if (m && !rule.mime.includes(m) && m !== 'application/octet-stream') return { ok: false, error: `${name}: el contenido (${m}) no coincide con la extensión .${ext}.` };
  return { ok: true, ext, mime: rule.mime[0] };
}

/** Nombre de almacenamiento seguro: conserva el original en la base de datos, nunca en la ruta. */
export function storagePath(projectId: string, fileKey: string, version: number, ext: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[0-9a-f-]{36}$/i.test(fileKey)) throw new Error('Identificador inválido');
  return `${projectId}/${fileKey}/v${version}.${ext.replace(/[^a-z0-9]/g, '')}`;
}

/** Comprueba la firma real de los formatos más comunes (primeros bytes). */
export function sniff(ext: string, head: Uint8Array): boolean {
  const b = (...xs: number[]) => xs.every((x, i) => head[i] === x);
  switch (ext) {
    case 'pdf': case 'ai': return b(0x25, 0x50, 0x44, 0x46) || (ext === 'ai' && b(0x25, 0x21));
    case 'png': return b(0x89, 0x50, 0x4e, 0x47);
    case 'jpg': case 'jpeg': return b(0xff, 0xd8, 0xff);
    case 'webp': return b(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57;
    case 'zip': case 'docx': case 'xlsx': case 'pptx': return b(0x50, 0x4b);
    case 'psd': return b(0x38, 0x42, 0x50, 0x53);
    case 'exe': return false;
    default: return !(b(0x4d, 0x5a)); // rechaza binarios ejecutables Windows (MZ) disfrazados
  }
}
