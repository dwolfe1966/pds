#!/usr/bin/env node
// Apply seo/db/schema.sql to the Neon database in DATABASE_URL. Idempotent
// (all CREATE ... IF NOT EXISTS). Run once after provisioning Neon, and again
// after any schema change.
//   DATABASE_URL=postgres://... node seo/scripts/apply-schema.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
if (!URL) { console.error('✗ Set DATABASE_URL (the Neon connection string) first.'); process.exit(1); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.join(HERE, '..', 'db', 'schema.sql'), 'utf8');
const sql = neon(URL);

// Split into statements; drop chunks that are only comments/whitespace.
const stmts = schema.split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--.*$/gm, '').trim().length > 0);

let n = 0;
for (const s of stmts) { await sql.query(s); n++; }
console.log(`✓ applied ${n} statements to ${URL.replace(/:[^:@/]+@/, ':****@')}`);
