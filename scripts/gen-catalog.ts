/** Genera la migración del catálogo y del cuestionario a partir de lib/ (una sola fuente de verdad). */
import { writeFileSync } from 'node:fs';
import { PACKAGES, CATALOG_VERSION } from '../lib/catalog';
import { MODULES, QUESTIONNAIRE_VERSION } from '../lib/questionnaire';

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (o: unknown) => `${lit(JSON.stringify(o))}::jsonb`;
let sql = `-- GM-ONB-3.0 · 0005 Catálogo ${CATALOG_VERSION} y cuestionario ${QUESTIONNAIRE_VERSION}.
-- GENERADO por scripts/gen-catalog.ts desde lib/catalog.ts y lib/questionnaire.ts. No editar a mano.
-- Para un cambio de precios o preguntas: nueva versión en lib/ y nueva migración (las versiones anteriores se conservan).

insert into public.package_versions (code, version, name, data) values\n`;
sql += Object.values(PACKAGES).map((p) => `  (${lit(p.code)}, ${lit(CATALOG_VERSION)}, ${lit(p.name)}, ${j(p)})`).join(',\n') + `\non conflict (code, version) do nothing;\n\n`;
sql += `insert into public.questionnaire_versions (id, definition) values (${lit(QUESTIONNAIRE_VERSION)}, ${j({ version: QUESTIONNAIRE_VERSION, modules: MODULES })})\non conflict (id) do nothing;\n\n`;
sql += `insert into public.questions (version_id, id, module, type, label, required, sensitive, packages, has_condition, definition) values\n`;
sql += MODULES.flatMap((m) => m.questions).map((q) => `  (${lit(QUESTIONNAIRE_VERSION)}, ${lit(q.id)}, ${lit(q.module)}, ${lit(q.type)}, ${lit(q.label)}, ${!!q.required}, ${!!q.sensitive}, ${q.packages ? `array[${q.packages.map(lit).join(',')}]` : 'null'}, ${!!q.when}, ${j(q)})`).join(',\n') + `\non conflict do nothing;\n`;
writeFileSync(new URL('../supabase/migrations/20261021000005_catalogo.sql', import.meta.url), sql);
console.log('Migración de catálogo generada');
