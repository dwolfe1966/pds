#!/usr/bin/env node
/**
 * fetch-profiles.mjs — populate the SEO app with REAL people from BC's existing
 * name teaser (no BC ask; the prod teaser is live + captcha-free). Reads the
 * Layer-1 ranked name queue, calls searchTeaser per name, adapts the response,
 * and writes seo/data/profiles.json (keyed by our public id) — which lib/data.js
 * serves in place of fixtures.
 *
 * Modes:
 *   --sample <file>   adapt ONE captured teaser payload (offline test of the pipeline).
 *   --names <N>       fetch the top-N names from data/name-pairs.ndjson via the live
 *                     teaser client (lib/teaser-client.mjs). READ-only; be polite.
 *
 * Usage:
 *   node seo/scripts/fetch-profiles.mjs --sample seo/scripts/.sample-teaser.json
 *   node seo/scripts/fetch-profiles.mjs --names 200
 */
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adaptTeaserResponse } from './lib/adapt-teaser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEO = path.resolve(HERE, '..');
const OUT = path.join(SEO, 'data', 'profiles.json');

const arg = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };

async function fromSample(file) {
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  const { profiles, total } = adaptTeaserResponse(payload, {});
  console.log(`  sample → ${profiles.length} profiles (teaser reported total ${total})`);
  return profiles;
}

async function* topNames(n) {
  const file = path.join(SEO, 'data', 'name-pairs.ndjson');
  if (!existsSync(file)) throw new Error('data/name-pairs.ndjson missing — run build-name-skeleton.mjs first');
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (!line.trim() || count >= n) break;
    const { first, last } = JSON.parse(line);
    yield { first, last };
    count++;
  }
}

async function fromLive(n) {
  const { searchTeaser } = await import('./lib/teaser-client.mjs');
  const all = [];
  let done = 0;
  for await (const { first, last } of topNames(n)) {
    try {
      const payload = await searchTeaser(first, last);
      const { profiles } = adaptTeaserResponse(payload, { first, last });
      all.push(...profiles);
      done++;
      if (done % 10 === 0) console.log(`  ${done}/${n} names · ${all.length} profiles`);
      await new Promise((r) => setTimeout(r, 400)); // politeness between prod calls
    } catch (e) {
      console.warn(`  skip ${first} ${last}: ${e.message}`);
    }
  }
  return all;
}

// --batch: adapt a captured batch file = [{first,last,state,identities:[...],total}]
// (produced by the headless name×state sweep). Each entry → one teaser payload.
async function fromBatch(file) {
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  const all = [];
  for (const r of rows) {
    const payload = { commerceContent: { raws: [{ transient: { identities: r.identities || [], total: r.total } }] } };
    const { profiles } = adaptTeaserResponse(payload, { first: r.first, last: r.last, state: r.state });
    all.push(...profiles);
  }
  console.log(`  batch → ${rows.length} searches → ${all.length} profiles`);
  return all;
}

(async () => {
  const sample = arg('--sample');
  const batch = arg('--batch');
  const namesN = arg('--names');
  const merge = process.argv.includes('--merge');
  let profiles;
  if (sample) profiles = await fromSample(sample);
  else if (batch) profiles = await fromBatch(batch);
  else if (namesN) profiles = await fromLive(parseInt(namesN, 10));
  else { console.error('Usage: --sample <file> | --batch <file> [--merge] | --names <N>'); process.exit(1); }

  // Key by public id; last-writer-wins on dupes (stable id → idempotent). --merge
  // keeps existing profiles (accumulate across batches).
  const byId = merge && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  for (const p of profiles) byId[p.id] = p;
  writeFileSync(OUT, JSON.stringify(byId, null, 0));
  console.log(`\n✓ wrote ${Object.keys(byId).length} real profiles → seo/data/profiles.json`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
