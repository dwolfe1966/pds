// One-time: create the `leads` table on the SEO Neon DB.
//
// Usage (from repo root or seo/):
//   cd seo && node --env-file=.env.local scripts/init-leads-table.mjs
//   # or explicitly:  DATABASE_URL="postgres://…neon.tech/…" node seo/scripts/init-leads-table.mjs
//
// Reuses the SEO app's Neon connection (DATABASE_URL). Safe to re-run — the schema
// uses CREATE TABLE/INDEX IF NOT EXISTS.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
if (!url) {
  console.error('✗ Set DATABASE_URL (the SEO app\'s Neon connection string).');
  process.exit(1);
}

const sql = neon(url);
const ddl = readFileSync(new URL('../db/leads-schema.sql', import.meta.url), 'utf8');

// The Neon HTTP driver runs one statement per call — split the file on `;`.
const statements = ddl
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim()) // drop SQL line-comments
  .filter(Boolean);

// The Neon HTTP driver is a tagged-template fn (no .query in this version). Run each
// raw DDL statement by handing it a minimal TemplateStringsArray (no interpolation).
const asTemplate = (s) => Object.assign([s], { raw: [s] });
for (const stmt of statements) {
  await sql(asTemplate(stmt));
  console.log('✓', stmt.replace(/\s+/g, ' ').slice(0, 70));
}
console.log('\n✅ leads table ready.');
