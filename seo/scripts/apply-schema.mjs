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
// The HTTP driver only runs tagged templates. Execute a raw (no-param) statement
// by handing it a synthetic template-strings array (.raw marks it as a literal).
const raw = (text) => sql(Object.assign([text], { raw: [text] }));

// Strip line comments (no string literals contain '--' in this DDL), then split.
const stmts = schema.replace(/--[^\n]*/g, '').split(';')
  .map((s) => s.trim())
  .filter(Boolean);

let n = 0;
for (const s of stmts) { await raw(s); n++; }
console.log(`✓ applied ${n} statements to ${URL.replace(/:[^:@/]+@/, ':****@')}`);
