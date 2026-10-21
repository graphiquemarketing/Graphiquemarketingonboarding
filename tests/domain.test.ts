import { describe, expect, it } from 'vitest';
import { PACKAGES, planFromParam } from '@/lib/catalog';
import { TRANSITIONS, genericActions, STATES } from '@/lib/states';
import { MODULES, QUESTIONS, UNKNOWN, isVisible, missingRequired, progress, sanitizeAnswer, labelFor } from '@/lib/questionnaire';
import { scopeItems, blocksApproval, classifyFunction } from '@/lib/scope';
import { briefJson, claudeKickoffMd, csvCell, inventoryCsv, canonicalJson, type ApprovalSnapshot } from '@/lib/export';
import { checkFile, storagePath, sniff } from '@/lib/files';
import { cleanParams } from '@/lib/analytics';
import { briefPdf, winAnsi } from '@/lib/pdf';

describe('catálogo (SEC-01)', () => {
  it('el parámetro plan solo mapea códigos conocidos', () => {
    expect(planFromParam('pyme')).toBe('PYME');
    expect(planFromParam('PyMe')).toBe('PYME');
    expect(planFromParam('gratis')).toBeNull();
    expect(planFromParam(undefined)).toBeNull();
  });
  it('precios del catálogo 2026-10-14', () => {
    expect(PACKAGES.PERSONAL.priceLabel).toBe('$9,900 MXN + IVA');
    expect(PACKAGES.TURNKEY.max).toBeNull();
  });
});

describe('máquina de estados', () => {
  it('el cliente nunca puede contratar ni aprobar', () => {
    for (const t of TRANSITIONS.filter((x) => ['CONTRATADO', 'BRIEF_APROBADO'].includes(x.to))) {
      expect(t.actors).not.toContain('responsable');
      expect(t.actors).not.toContain('colaborador');
    }
  });
  it('acciones genéricas excluyen las que tienen función propia', () => {
    expect(genericActions('CONTRATACION_PENDIENTE', 'comercial')).toEqual([]);
    expect(genericActions('BRIEF_ENVIADO', 'pm').map((t) => t.to)).toEqual(['EN_REVISION']);
  });
  it('todas las transiciones usan estados válidos', () => {
    for (const t of TRANSITIONS) { expect(STATES).toContain(t.from); expect(STATES).toContain(t.to); }
  });
});

describe('cuestionario (BRF-01)', () => {
  it('tiene 10 módulos con IDs estables y únicos', () => {
    expect(MODULES.map((m) => m.id)).toEqual(['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10']);
    const ids = MODULES.flatMap((m) => m.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^M\d{2}_Q\d{2}$/);
  });
  it('visibilidad por paquete y por respuesta', () => {
    expect(isVisible(QUESTIONS.M08_Q03, 'PERSONAL', {})).toBe(false);
    expect(isVisible(QUESTIONS.M08_Q03, 'CORPORATE', {})).toBe(true);
    expect(isVisible(QUESTIONS.M09_Q04, 'PERSONAL', {})).toBe(false);
    expect(isVisible(QUESTIONS.M01_Q07, 'PYME', { M01_Q06: 'No' })).toBe(false);
    expect(isVisible(QUESTIONS.M01_Q07, 'PYME', { M01_Q06: 'Sí' })).toBe(true);
    expect(isVisible(QUESTIONS.M10_Q04, 'PYME', { M10_Q03: '2027-01-15' })).toBe(true);
    expect(labelFor(QUESTIONS.M07_Q01, 'PERSONAL')).toMatch(/landing/);
  });
  it('faltantes incluye subcampos obligatorios y «No lo sé» no cuenta como respuesta obligatoria', () => {
    const a = { M01_Q01: 'Roble', M01_Q02: 'Industria', M01_Q05: { tel: '5555' }, M04_Q01: ['Ventas'], M10_Q01: { nombre: 'A', correo: 'a@b.mx' } };
    expect(missingRequired('PYME', a).map((m) => m.question.id)).toEqual(['M01_Q05']);
    expect(missingRequired('PYME', { ...a, M01_Q05: { correo: 'x@y.mx' } })).toEqual([]);
    expect(progress('PYME', {})).toBe(0);
  });
  it('sanitiza respuestas fuera de opciones o con tipos incorrectos', () => {
    expect(sanitizeAnswer(QUESTIONS.M01_Q02, 'Hackeo', {})).toBeNull();
    expect(sanitizeAnswer(QUESTIONS.M04_Q01, ['Ventas', 'Ventas', 'Nada'], {})).toEqual(['Ventas']);
    expect(sanitizeAnswer(QUESTIONS.M04_Q02, 'Ventas', { M04_Q01: ['Ventas'] })).toBe('Ventas');
    expect(sanitizeAnswer(QUESTIONS.M04_Q02, 'Citas', { M04_Q01: ['Ventas'] })).toBeNull();
    expect(sanitizeAnswer(QUESTIONS.M09_Q03, UNKNOWN, {})).toBe(UNKNOWN);
    expect(sanitizeAnswer(QUESTIONS.M01_Q01, UNKNOWN, {})).toBeNull();
    expect(sanitizeAnswer(QUESTIONS.M09_Q01, { Dominio: 'Sí', Hosting: 'Tal vez', X: 'Sí' }, {})).toEqual({ Dominio: 'Sí' });
    expect(sanitizeAnswer(QUESTIONS.M07_Q02, ['Blog', 'Inicio'], { M07_Q01: ['Inicio'] })).toEqual(['Inicio']);
  });
});

describe('alcance (SCP-01)', () => {
  it('clasifica funciones por paquete', () => {
    expect(classifyFunction('PERSONAL', 'pagos')).toBe('ADICIONAL');
    expect(classifyFunction('CORPORATE', 'crm')).toBe('PENDIENTE');
    expect(classifyFunction('TURNKEY', 'erp')).toBe('PENDIENTE');
    expect(classifyFunction('PYME', 'cotizar')).toBe('INCLUIDA');
  });
  it('separa páginas excedentes y bloquea aprobación hasta decidir', () => {
    const a = { M07_Q01: ['Inicio', 'Nosotros', 'Servicios', 'FAQ', 'Blog', 'Contacto', 'Casos'], M08_Q01: ['formulario', 'pagos'] };
    const items = scopeItems('PERSONAL', a);
    expect(items.map((i) => i.key)).toEqual(['pages:included', 'pages:extra', 'fn:formulario', 'fn:pagos']);
    expect(blocksApproval(items)).toBe(true);
    const ok = scopeItems('PERSONAL', a, [
      { item_key: 'pages:extra', classification: 'ADICIONAL_APROBADA', note: 'Orden de cambio OC-1' },
      { item_key: 'fn:pagos', classification: 'NO_INCLUIDA', note: null }]);
    expect(blocksApproval(ok)).toBe(false);
    expect(ok[1].note).toBe('Orden de cambio OC-1');
  });
});

const snap: ApprovalSnapshot = {
  project_id: '00000000-0000-0000-0000-000000000001', folio: 'GM-2026-0003', version: 1, approved_at: '2026-10-21T12:00:00Z',
  approved_by_label: 'PM de prueba', package_code: 'PERSONAL', package_version: '2026-10-14', questionnaire_version: 'Q-2026-10-21.1',
  answers: { M01_Q01: 'Lince', M01_Q05: { correo: 'secreto@lince.mx' }, M02_Q05: 'No publicar precios', M09_Q03: UNKNOWN, M10_Q01: { nombre: 'Ana', correo: 'ana@lince.mx' } },
  scope: scopeItems('PERSONAL', { M08_Q01: ['formulario'] }), files: [{ file_key: 'k1', version: 2, category: 'Identidad', original_name: '=HYPERLINK("x")', mime: 'image/png', size_bytes: 2048, status: 'APROBADO' }],
  hash: 'abc123',
};

describe('exportación (EXP-01)', () => {
  it('el JSON excluye contacto e información confidencial', () => {
    const j = briefJson(snap);
    expect(j).not.toContain('secreto@lince.mx');
    expect(j).not.toContain('ana@lince.mx');
    expect(j).not.toContain('No publicar precios');
    const o = JSON.parse(j);
    expect(o.excluded.sort()).toEqual(['M01_Q05', 'M02_Q05', 'M10_Q01']);
    expect(o.answers.find((x: { question_id: string }) => x.question_id === 'M09_Q03').value).toBe('NO_LO_SE');
  });
  it('el CSV neutraliza fórmulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(inventoryCsv(snap)).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('el arranque de Claude lista pendientes «No lo sé» y no incluye contacto', () => {
    const md = claudeKickoffMd(snap);
    expect(md).toContain('- M09_Q03');
    expect(md).not.toContain('ana@lince.mx');
  });
  it('JSON canónico estable', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 0 }] })).toBe('{"a":[2,{"c":0,"d":1}],"b":1}');
  });
  it('genera un PDF válido con acentos', async () => {
    const bytes = await briefPdf(snap);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(winAnsi('A → B • ñ')).toBe('A -> B - ñ');
  });
});

describe('archivos (FIL-01)', () => {
  it('rechaza ejecutables, excesos de tamaño y MIME inconsistente', () => {
    expect(checkFile('setup.exe', 100, 'application/x-msdownload').ok).toBe(false);
    expect(checkFile('cat.pdf', 26 * 1048576, 'application/pdf').ok).toBe(false);
    expect(checkFile('logo.png', 1000, 'application/pdf').ok).toBe(false);
    expect(checkFile('logo.PNG', 1000, 'image/png').ok).toBe(true);
  });
  it('rutas de almacenamiento sin nombre original ni traversal', () => {
    const p = storagePath('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 3, 'pdf');
    expect(p).toBe('11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/v3.pdf');
    expect(() => storagePath('../x', '22222222-2222-2222-2222-222222222222', 1, 'pdf')).toThrow();
  });
  it('detecta firmas reales', () => {
    expect(sniff('pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
    expect(sniff('png', new Uint8Array([0x4d, 0x5a, 0, 0]))).toBe(false);
    expect(sniff('txt', new Uint8Array([0x4d, 0x5a, 0, 0]))).toBe(false);
  });
});

describe('analítica (ANA-01)', () => {
  it('descarta parámetros con datos personales', () => {
    expect(cleanParams({ paquete: 'PYME', email: 'a@b.mx', modulo: 'M04', nombre: 'Ana' })).toEqual({ paquete: 'PYME', modulo: 'M04' });
    expect(cleanParams({ paquete: 'a@b.mx' })).toEqual({});
    expect(cleanParams({ modulo: '5512345678' })).toEqual({});
  });
});
