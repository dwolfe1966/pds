#!/usr/bin/env node
// Seed the Neon `profiles` table from seo/data/profiles.json (the 604 real
// profiles already captured). Idempotent upsert on the stable public id, so
// re-running is safe. After this, the app reads from Postgres.
//   DATABASE_URL=postgres://... node seo/scripts/seed-db.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hasDb, dbUpsertProfile, dbCount } from '../lib/db.mjs';

if (!hasDb) { console.error('✗ Set DATABASE_URL (the Neon connection string) first.'); process.exit(1); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(HERE, '..', 'data', 'profiles.json');
const profiles = Object.values(JSON.parse(readFileSync(file, 'utf8')));

let n = 0;
for (const p of profiles) {
  await dbUpsertProfile(p);
  if (++n % 100 === 0) console.log(`  ${n}/${profiles.length}`);
}
console.log(`✓ seeded ${n} profiles · db now holds ${await dbCount()}`);
