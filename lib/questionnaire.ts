/**
 * Cuestionario de onboarding · versión Q-2026-10-21.1 (M01–M10 del brief GM-ONB-3.0).
 * Definición declarativa (sin funciones) para poder guardarse en public.questionnaire_versions.definition
 * y reproducir exactamente la misma lógica en cualquier versión histórica.
 */
import type { FunctionKey, PackageCode } from './catalog';
import { PACKAGES } from './catalog';

export const QUESTIONNAIRE_VERSION = 'Q-2026-10-21.1';

export type QType = 'text' | 'area' | 'url' | 'date' | 'single' | 'multi' | 'fields' | 'list' | 'tri' | 'order';

export type Condition =
  | { q: string; eq: string }
  | { q: string; ne: string }
  | { q: string; filled: true };

export interface SubField {
  key: string;
  label: string;
  input?: 'text' | 'email' | 'tel' | 'url';
  options?: string[];
  required?: boolean;
}

export interface Question {
  id: string;
  module: string;
  label: string;
  /** Etiqueta alternativa por paquete. */
  labelByPackage?: Partial<Record<PackageCode, string>>;
  type: QType;
  required?: boolean;
  help?: string;
  options?: string[];
  /** Opciones con clave y etiqueta (funciones del sitio). */
  keyedOptions?: { key: FunctionKey; label: string }[];
  /** Opciones tomadas de otra respuesta: de una lista (field) o de una selección múltiple. */
  optionsFrom?: { q: string; field?: string };
  emptyText?: string;
  fields?: SubField[];
  items?: string[];
  /** Para type=order: pregunta cuyas opciones se ordenan. */
  orderOf?: string;
  /** Si aplica el contador de páginas/secciones contra el límite del paquete. */
  countsPages?: boolean;
  /** Si las opciones se clasifican contra el alcance del paquete. */
  scoped?: boolean;
  /** Paquetes en los que se muestra (por omisión, todos). */
  packages?: PackageCode[];
  when?: Condition;
  /** Respuesta que no se exporta al expediente para IA. */
  sensitive?: boolean;
  /** Permite «No lo sé» (preguntas técnicas). */
  allowUnknown?: boolean;
}

export interface Module {
  id: string;
  title: string;
  questions: Question[];
}

const YN = ['Sí', 'No', 'No lo sé'];
export const UNKNOWN = '__no_lo_se__';

const M = (id: string, title: string, questions: Omit<Question, 'module'>[]): Module => ({
  id, title, questions: questions.map((q) => ({ ...q, module: id })),
});

export const MODULES: Module[] = [
  M('M01', 'Tu empresa', [
    { id: 'M01_Q01', label: '¿Cómo se llama tu empresa o marca?', type: 'text', required: true },
    { id: 'M01_Q02', label: '¿A qué se dedica?', type: 'single', required: true, options: ['Servicios profesionales', 'Comercio', 'Industria', 'Construcción e inmobiliario', 'Salud', 'Educación', 'Tecnología', 'Hospitalidad', 'Otro'] },
    { id: 'M01_Q03', label: 'Cuéntanos brevemente qué hace tu empresa.', type: 'area' },
    { id: 'M01_Q04', label: '¿Dónde atiendes?', type: 'multi', options: ['Una ciudad', 'Varias ciudades', 'Todo México', 'Otros países', 'Solo en línea'] },
    { id: 'M01_Q05', label: '¿Cuáles son tus datos oficiales de contacto?', type: 'fields', required: true, sensitive: true, fields: [
      { key: 'tel', label: 'Teléfono', input: 'tel' }, { key: 'correo', label: 'Correo', input: 'email', required: true },
      { key: 'whatsapp', label: 'WhatsApp', input: 'tel' }, { key: 'ciudad', label: 'Ciudad', input: 'text' }] },
    { id: 'M01_Q06', label: '¿Tienes sitio web?', type: 'single', options: YN },
    { id: 'M01_Q07', label: 'Dirección de tu sitio actual', type: 'url', when: { q: 'M01_Q06', eq: 'Sí' } },
  ]),
  M('M02', 'Servicios y diferenciadores', [
    { id: 'M02_Q01', label: '¿Qué productos o servicios ofreces?', type: 'list', fields: [
      { key: 'nombre', label: 'Nombre' }, { key: 'descripcion', label: 'Descripción' },
      { key: 'prioridad', label: 'Prioridad', options: ['Alta', 'Media', 'Baja'] }, { key: 'publico', label: 'Público' },
      { key: 'material', label: '¿Tienes material?', options: ['Sí', 'No'] }] },
    { id: 'M02_Q02', label: '¿Por qué te eligen tus clientes?', type: 'area' },
    { id: 'M02_Q03', label: '¿Qué servicios quieres promover primero?', type: 'multi', optionsFrom: { q: 'M02_Q01', field: 'nombre' }, emptyText: 'Agrega primero tus servicios en la pregunta anterior.' },
    { id: 'M02_Q04', label: '¿Qué empresas consideras competencia?', type: 'list', fields: [{ key: 'nombre', label: 'Empresa' }, { key: 'url', label: 'Sitio web', input: 'url' }] },
    { id: 'M02_Q05', label: '¿Qué información no debemos publicar?', type: 'area', sensitive: true },
  ]),
  M('M03', 'Clientes y mercado', [
    { id: 'M03_Q01', label: '¿A quién quieres llegar?', type: 'multi', options: ['Personas', 'Microempresas', 'PyME', 'Corporativos', 'Distribuidores', 'Gobierno', 'Otros'] },
    { id: 'M03_Q02', label: '¿En qué ciudades o países buscas clientes?', type: 'text' },
    { id: 'M03_Q03', label: '¿Qué problema solucionas?', type: 'area' },
    { id: 'M03_Q04', label: '¿Qué preguntas u objeciones recibes?', type: 'area' },
  ]),
  M('M04', 'Objetivos y conversiones', [
    { id: 'M04_Q01', label: '¿Qué quieres conseguir con tu web?', type: 'multi', required: true, options: ['Cotizaciones', 'Contactos', 'Presentación', 'Proyectos', 'Ventas', 'Citas', 'Llamadas', 'Descargas', 'Otro'] },
    { id: 'M04_Q02', label: '¿Cuál es el objetivo principal?', type: 'single', optionsFrom: { q: 'M04_Q01' }, emptyText: 'Elige primero qué quieres conseguir.' },
    { id: 'M04_Q03', label: '¿Qué datos necesitas de un prospecto?', type: 'multi', options: ['Nombre', 'Empresa', 'Correo', 'Teléfono', 'Ciudad', 'Presupuesto', 'Mensaje'] },
    { id: 'M04_Q04', label: '¿Quién recibirá y atenderá los mensajes?', type: 'text', allowUnknown: true },
  ]),
  M('M05', 'Identidad y referencias', [
    { id: 'M05_Q01', label: '¿Tienes logotipo?', type: 'single', options: ['Sí', 'No', 'En desarrollo'] },
    { id: 'M05_Q02', label: '¿Tienes manual de marca?', type: 'single', options: YN },
    { id: 'M05_Q03', label: '¿Qué estilo prefieres?', type: 'multi', options: ['Corporativo', 'Minimalista', 'Elegante', 'Creativo', 'Tecnológico', 'Cálido', 'Sobrio', 'Otro'] },
    { id: 'M05_Q04', label: '¿Qué sitios web te inspiran?', type: 'list', fields: [{ key: 'url', label: 'Sitio', input: 'url' }, { key: 'gusta', label: 'Qué te gusta' }, { key: 'no_gusta', label: 'Qué no te gusta' }] },
    { id: 'M05_Q05', label: '¿Qué elementos de tu imagen actual debemos conservar?', type: 'area' },
  ]),
  M('M06', 'Contenidos', [
    { id: 'M06_Q01', label: '¿Qué materiales tienes?', type: 'multi', options: ['Textos', 'Fotos', 'Videos', 'Logo', 'Catálogos', 'Presentaciones', 'Casos', 'Testimonios', 'Ninguno', 'Otros'] },
    { id: 'M06_Q02', label: '¿Quién prepara y aprueba los textos?', type: 'text', help: 'La redacción especializada no está incluida en ningún paquete; se cotiza aparte.', allowUnknown: true },
    { id: 'M06_Q03', label: '¿Tienes derechos o autorización para publicar fotos, logos y testimonios?', type: 'single', options: ['Sí', 'No', 'Pendiente'] },
    { id: 'M06_Q04', label: '¿Qué materiales te faltan?', type: 'area' },
  ]),
  M('M07', 'Páginas y secciones', [
    { id: 'M07_Q01', label: '¿Qué apartados necesitas?', labelByPackage: { PERSONAL: '¿Qué secciones necesita tu landing?' }, type: 'multi', countsPages: true,
      options: ['Inicio', 'Nosotros', 'Servicios', 'Productos', 'Proyectos', 'Casos', 'Blog', 'FAQ', 'Contacto', 'Sucursales', 'Catálogo', 'Otros'] },
    { id: 'M07_Q02', label: '¿Qué secciones son prioritarias?', type: 'order', orderOf: 'M07_Q01', help: 'Ordena de mayor a menor prioridad.' },
    { id: 'M07_Q03', label: '¿Hay información que debamos trasladar de una web anterior?', type: 'single', options: YN, when: { q: 'M01_Q06', ne: 'No' } },
    { id: 'M07_Q04', label: 'Detalle de lo que hay que trasladar', type: 'area', when: { q: 'M07_Q03', eq: 'Sí' } },
  ]),
  M('M08', 'Funciones', [
    { id: 'M08_Q01', label: '¿Qué quieres que hagan tus visitantes?', type: 'multi', scoped: true, keyedOptions: [
      { key: 'formulario', label: 'Enviar un formulario' }, { key: 'whatsapp', label: 'Escribir por WhatsApp' }, { key: 'cotizar', label: 'Cotizar' },
      { key: 'agendar', label: 'Agendar' }, { key: 'descargar', label: 'Descargar' }, { key: 'catalogo', label: 'Ver un catálogo' },
      { key: 'buscador', label: 'Usar un buscador' }, { key: 'pagos', label: 'Pagar en línea' }, { key: 'area', label: 'Entrar a un área privada' },
      { key: 'crm', label: 'Conectar con mi CRM' }, { key: 'erp', label: 'Conectar con mi ERP' }, { key: 'idiomas', label: 'Ver el sitio en otros idiomas' },
      { key: 'otro', label: 'Otro' }] },
    { id: 'M08_Q02', label: '¿Hay herramientas externas que ya utilizas?', type: 'text', help: 'Nombre y, si quieres, su dirección web.' },
    { id: 'M08_Q03', label: '¿Necesitas algún proceso especial?', type: 'area', help: 'Graphique lo clasificará como incluido, pendiente o adicional.', packages: ['CORPORATE', 'TURNKEY'] },
  ]),
  M('M09', 'Presencia digital', [
    { id: 'M09_Q01', label: '¿Tienes dominio, hosting y correo corporativo?', type: 'tri', items: ['Dominio', 'Hosting', 'Correo corporativo'] },
    { id: 'M09_Q02', label: '¿Utilizas estas herramientas?', type: 'tri', items: ['Google Analytics 4', 'Google Search Console', 'Google Ads', 'CRM'] },
    { id: 'M09_Q03', label: '¿Quién administra esas herramientas?', type: 'text', help: 'Escribe solo nombres o puestos. Nunca compartas contraseñas en este portal.', allowUnknown: true },
    { id: 'M09_Q04', label: '¿Hay que migrar datos o contenidos?', type: 'single', options: YN, packages: ['PYME', 'CORPORATE', 'TURNKEY'] },
    { id: 'M09_Q05', label: 'Describe qué hay que migrar', type: 'area', when: { q: 'M09_Q04', eq: 'Sí' } },
  ]),
  M('M10', 'Responsables y cierre', [
    { id: 'M10_Q01', label: '¿Quién enviará información y resolverá dudas?', type: 'fields', required: true, sensitive: true, fields: [
      { key: 'nombre', label: 'Nombre', required: true }, { key: 'correo', label: 'Correo', input: 'email', required: true }, { key: 'tel', label: 'Teléfono', input: 'tel' }] },
    { id: 'M10_Q02', label: '¿Quién aprobará diseño, textos y publicación?', type: 'list', fields: [{ key: 'nombre', label: 'Nombre' }, { key: 'rol', label: 'Qué aprueba', options: ['Diseño', 'Textos', 'Publicación', 'Todo'] }] },
    { id: 'M10_Q03', label: '¿Tienes una fecha objetivo o evento importante?', type: 'date' },
    { id: 'M10_Q04', label: '¿Por qué esa fecha?', type: 'text', when: { q: 'M10_Q03', filled: true } },
    { id: 'M10_Q05', label: '¿Hay restricciones o instrucciones adicionales?', type: 'area' },
  ]),
];

export const QUESTIONS: Record<string, Question> = Object.fromEntries(MODULES.flatMap((m) => m.questions.map((q) => [q.id, q])));

export type Answers = Record<string, unknown>;

export function filled(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some((x) => x !== '' && x != null);
  return true;
}

function meets(c: Condition | undefined, a: Answers): boolean {
  if (!c) return true;
  const v = a[c.q];
  if ('eq' in c) return v === c.eq;
  if ('ne' in c) return v !== c.ne;
  return filled(v);
}

export function isVisible(q: Question, pkg: PackageCode, a: Answers): boolean {
  if (q.packages && !q.packages.includes(pkg)) return false;
  return meets(q.when, a);
}

export function labelFor(q: Question, pkg: PackageCode): string {
  return q.labelByPackage?.[pkg] ?? q.label;
}

/** Opciones efectivas (estáticas, con clave o dinámicas). */
export function optionsFor(q: Question, a: Answers): { value: string; label: string }[] {
  if (q.keyedOptions) return q.keyedOptions.map((o) => ({ value: o.key, label: o.label }));
  if (q.optionsFrom) {
    const src = a[q.optionsFrom.q];
    const field = q.optionsFrom.field;
    const vals = Array.isArray(src)
      ? src.map((x) => (field ? String((x as Record<string, unknown>)?.[field] ?? '') : String(x))).filter(Boolean)
      : [];
    return [...new Set(vals)].map((v) => ({ value: v, label: v }));
  }
  return (q.options ?? []).map((o) => ({ value: o, label: o }));
}

export interface Missing { module: Module; question: Question; field?: string }

/** Obligatorias visibles sin responder (incluye subcampos obligatorios). */
export function missingRequired(pkg: PackageCode, a: Answers): Missing[] {
  const out: Missing[] = [];
  for (const m of MODULES) for (const q of m.questions) {
    if (!isVisible(q, pkg, a)) continue;
    const v = a[q.id];
    if (q.required && (!filled(v) || v === UNKNOWN)) { out.push({ module: m, question: q }); continue; }
    if (q.type === 'fields' && q.fields) {
      const o = (v ?? {}) as Record<string, unknown>;
      const f = q.fields.find((sf) => sf.required && !filled(o[sf.key]));
      if (f) out.push({ module: m, question: q, field: f.key });
    }
  }
  return out;
}

export function moduleProgress(m: Module, pkg: PackageCode, a: Answers): { done: number; total: number } {
  const vis = m.questions.filter((q) => isVisible(q, pkg, a));
  return { done: vis.filter((q) => filled(a[q.id])).length, total: vis.length };
}

export function progress(pkg: PackageCode, a: Answers): number {
  let d = 0, t = 0;
  for (const m of MODULES) { const p = moduleProgress(m, pkg, a); d += p.done; t += p.total; }
  return t ? Math.round((d * 100) / t) : 0;
}

/** Limpia una respuesta para guardarla: tipos correctos, longitudes máximas y opciones válidas. */
export function sanitizeAnswer(q: Question, value: unknown, a: Answers): unknown {
  const str = (x: unknown, max = 4000) => String(x ?? '').slice(0, max);
  if (value === UNKNOWN) return q.allowUnknown ? UNKNOWN : null;
  if (value === null || value === '') return null;
  switch (q.type) {
    case 'text': case 'url': return str(value, q.type === 'url' ? 500 : 1000);
    case 'area': return str(value, 4000);
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
    case 'single': {
      const allowed = optionsFor(q, a).map((o) => o.value);
      return allowed.includes(String(value)) ? String(value) : null;
    }
    case 'multi': case 'order': {
      if (!Array.isArray(value)) return null;
      const allowed = q.type === 'order' ? optionsFor(QUESTIONS[q.orderOf!], a).map((o) => o.value)
        .filter((v) => (Array.isArray(a[q.orderOf!]) ? (a[q.orderOf!] as string[]).includes(v) : false)) : optionsFor(q, a).map((o) => o.value);
      return [...new Set(value.map(String))].filter((v) => allowed.includes(v));
    }
    case 'fields': case 'tri': {
      if (typeof value !== 'object' || Array.isArray(value)) return null;
      const keys = q.type === 'fields' ? q.fields!.map((f) => f.key) : q.items!;
      const o: Record<string, string> = {};
      for (const k of keys) {
        const v = (value as Record<string, unknown>)[k];
        if (v == null || v === '') continue;
        if (q.type === 'tri' && !YN.includes(String(v))) continue;
        o[k] = str(v, 300);
      }
      return o;
    }
    case 'list': {
      if (!Array.isArray(value)) return null;
      return value.slice(0, 50).map((row) => {
        const o: Record<string, string> = {};
        for (const f of q.fields!) {
          const v = (row as Record<string, unknown>)?.[f.key];
          if (v == null || v === '') continue;
          if (f.options && !f.options.includes(String(v))) continue;
          o[f.key] = str(v, 500);
        }
        return o;
      });
    }
  }
}

/** Texto plano de una respuesta (exportaciones y vistas de revisión). */
export function plainAnswer(q: Question, v: unknown): string {
  if (v === UNKNOWN) return 'No lo sé';
  if (!filled(v)) return '';
  if (q.keyedOptions && Array.isArray(v)) return v.map((k) => q.keyedOptions!.find((o) => o.key === k)?.label ?? k).join(', ');
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? Object.values(x as object).filter(Boolean).join(' · ') : String(x))).join('; ');
  if (typeof v === 'object') return Object.entries(v as object).filter(([, x]) => x).map(([k, x]) => `${k}: ${x}`).join(' · ');
  return String(v);
}

/** Recuento de páginas contra el límite del paquete. */
export function pagesOver(pkg: PackageCode, a: Answers): number {
  const max = PACKAGES[pkg].max;
  const n = Array.isArray(a.M07_Q01) ? (a.M07_Q01 as unknown[]).length : 0;
  return max ? Math.max(0, n - max) : 0;
}
