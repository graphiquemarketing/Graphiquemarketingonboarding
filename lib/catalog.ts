/**
 * Catálogo comercial de referencia · edición 14/10/2026.
 * Debe coincidir con la tabla public.package_versions (supabase/seed.sql).
 * La selección de un paquete en la URL solo preselecciona: nunca fija precio ni contratación.
 */
export const CATALOG_VERSION = '2026-10-14';

export type PackageCode = 'PERSONAL' | 'PYME' | 'CORPORATE' | 'TURNKEY';

export type FunctionKey =
  | 'formulario' | 'whatsapp' | 'cotizar' | 'agendar' | 'descargar' | 'catalogo' | 'buscador'
  | 'pagos' | 'area' | 'crm' | 'erp' | 'idiomas' | 'otro';

export interface PackageDef {
  code: PackageCode;
  name: string;
  sub: string;
  priceLabel: string;
  limitLabel: string;
  /** Máximo de páginas o secciones; null = según contrato. */
  max: number | null;
  unit: string;
  warrantyDays: number;
  rounds: string;
  discovery: string;
  seo: string;
  analytics: string;
  /** Funciones incluidas en el paquete. */
  included: FunctionKey[];
  /** Funciones que solo aplican si se contrataron expresamente; '*' = todo según contrato. */
  conditional: FunctionKey[] | '*';
}

export const PACKAGES: Record<PackageCode, PackageDef> = {
  PERSONAL: {
    code: 'PERSONAL', name: 'Personal', sub: 'Professional', priceLabel: '$9,900 MXN + IVA',
    limitLabel: '1 landing · hasta 6 secciones', max: 6, unit: 'secciones', warrantyDays: 15, rounds: '2 rondas',
    discovery: 'Esencial', seo: 'SEO inicial', analytics: 'GA4 / GSC',
    included: ['formulario', 'whatsapp'], conditional: [],
  },
  PYME: {
    code: 'PYME', name: 'PyME Growth', sub: 'Business Growth', priceLabel: '$21,900 MXN + IVA',
    limitLabel: 'Hasta 8 páginas', max: 8, unit: 'páginas', warrantyDays: 30, rounds: '3 rondas',
    discovery: 'Completo', seo: 'SEO + AEO básico', analytics: 'Eventos contratados',
    included: ['formulario', 'whatsapp', 'cotizar'], conditional: [],
  },
  CORPORATE: {
    code: 'CORPORATE', name: 'Corporate B2B', sub: 'B2B Performance', priceLabel: 'Desde $49,900 MXN + IVA',
    limitLabel: 'Hasta 15 páginas/plantillas', max: 15, unit: 'páginas/plantillas', warrantyDays: 45, rounds: 'Según propuesta',
    discovery: 'Corporativo', seo: 'SEO técnico', analytics: 'Conversiones',
    included: ['formulario', 'whatsapp', 'cotizar', 'catalogo', 'descargar'], conditional: ['crm'],
  },
  TURNKEY: {
    code: 'TURNKEY', name: 'Turn Key', sub: 'Enterprise', priceLabel: 'Desde $149,900 MXN + IVA',
    limitLabel: 'Según contrato', max: null, unit: 'páginas', warrantyDays: 60, rounds: 'Según contrato',
    discovery: 'Profundo', seo: 'Especificado', analytics: 'A medida',
    included: [], conditional: '*',
  },
};

export const PACKAGE_CODES = Object.keys(PACKAGES) as PackageCode[];

/** ?plan=pyme → 'PYME'. Cualquier otro valor se ignora. */
export function planFromParam(v: string | null | undefined): PackageCode | null {
  const map: Record<string, PackageCode> = { personal: 'PERSONAL', pyme: 'PYME', corporate: 'CORPORATE', turnkey: 'TURNKEY' };
  return v ? map[v.toLowerCase()] ?? null : null;
}

export function isPackageCode(v: unknown): v is PackageCode {
  return typeof v === 'string' && v in PACKAGES;
}
