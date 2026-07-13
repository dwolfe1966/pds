// Apply an arbitrary .sql schema file to the SEO Neon DB (idempotent DDL).
//
// Usage:
//   cd seo && node --env-file=.env.local scripts/apply-sql.mjs db/abandoned-checkouts-schema.sql
//
// The Neon HTTP driver runs one statement per call and is a tagged-template fn (no .query),
// so we split on `;` and hand each raw statement a minimal TemplateStringsArray.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
if (!url) { console.error('✗ Set DATABASE_URL.'); process.exit(1); }

const file = process.argv[2];
if (!file) { console.error('✗ Usage: apply-sql.mjs <path-to.sql>'); process.exit(1); }

const sql = neon(url);
const ddl = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const statements = ddl
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter(Boolean);

const asTemplate = (s) => Object.assign([s], { raw: [s] });
for (const stmt of statements) {
  await sql(asTemplate(stmt));
  console.log('✓', stmt.replace(/\s+/g, ' ').slice(0, 72));
}
console.log(`\n✅ applied ${file}`);
