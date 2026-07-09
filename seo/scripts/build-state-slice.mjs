// Build the STATE slice for the state-first IA. Public-domain Census inputs.
//   node scripts/build-state-slice.mjs [TOP_NAMES]     (default 500)
//
// Output: seo/data/state-slice.json =
//   { states: { "tx": { code, name, pop, share, cities:[{city,slug,pop,lat,lng}] } },
//     topNames: ["michael-smith", ...] }   // shared, population-ordered
// The /people/[state] landing reads cities (for the dot-map) + topNames; the
// /people/[state]/[name] page composes state.share × name-slice estimate.

import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');
const TOP_NAMES = Number(process.argv[2]) || 500;
const CITIES_PER_STATE = 45;

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

// ── places → per-state population + top cities (with lat/lng for the map) ──────
const places = JSON.parse(readFileSync(join(DATA, 'places.json'), 'utf8'));
const byState = new Map();
for (const p of places) {
  if (!p.state) continue;
  if (!byState.has(p.state)) byState.set(p.state, { code: p.state, name: p.stateName || p.state, pop: 0, cities: [] });
  const s = byState.get(p.state);
  if (p.pop) s.pop += p.pop;
  if (p.pop && p.lat && p.lng) s.cities.push({ city: p.city, slug: slugify(p.city), pop: p.pop, lat: p.lat, lng: p.lng });
}
const totalPop = [...byState.values()].reduce((a, s) => a + s.pop, 0);

const states = {};
for (const [code, s] of byState) {
  s.cities.sort((a, b) => b.pop - a.pop);
  states[code.toLowerCase()] = {
    code,
    name: s.name,
    pop: s.pop,
    share: s.pop / totalPop,
    cities: s.cities.slice(0, CITIES_PER_STATE),
  };
}

// ── top name pairs → shared population-ordered slug list ───────────────────────
const topNames = [];
const rl = createInterface({ input: createReadStream(join(DATA, 'name-pairs.ndjson')), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const p = JSON.parse(line);
  topNames.push(slugify(`${p.first}-${p.last}`));
  if (topNames.length >= TOP_NAMES) break;
}

writeFileSync(join(DATA, 'state-slice.json'), JSON.stringify({ states, topNames }));
console.log(`✓ state-slice.json — ${Object.keys(states).length} states, ${topNames.length} top names, totalPop ${totalPop.toLocaleString()}`);
