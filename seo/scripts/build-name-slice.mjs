// Build the "name slice" — a measured set of top name-pairs turned into
// augmented, crawler-worthy skeleton pages (no real profiles required). All inputs
// are public-domain Census/SSA aggregates already in seo/data/.
//
//   node scripts/build-name-slice.mjs [N]      (default N = 25000)
//
// Output: seo/data/name-slice.json — a map { "<name-slug>": {augmented stats} }.
// The /people/[name] route reads this when a name has no real profile, so the page
// renders unique name statistics + geography + related-name links + a funnel CTA
// instead of 404ing.

import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');
const N = Number(process.argv[2]) || 25000;

const properCase = (s) => String(s).toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, sep, c) => sep + c.toUpperCase());
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

console.log(`Building name slice (top ${N.toLocaleString()} pairs)…`);

// ── first/last popularity → count + national rank ─────────────────────────────
const firstArr = JSON.parse(readFileSync(join(DATA, 'first-names.json'), 'utf8'));
const lastArr = JSON.parse(readFileSync(join(DATA, 'last-names.json'), 'utf8'));
const firstMap = new Map(firstArr.map((e, i) => [e.name, { count: e.count, rank: i + 1 }]));
const lastMap = new Map(lastArr.map((e, i) => [e.name, { count: e.count, rank: i + 1 }]));

// ── state population shares (from places.json) → generic geographic estimate ───
const places = JSON.parse(readFileSync(join(DATA, 'places.json'), 'utf8'));
const statePop = new Map();
const stateNameOf = new Map();
for (const p of places) {
  if (!p.state || !p.pop) continue;
  statePop.set(p.state, (statePop.get(p.state) || 0) + p.pop);
  if (p.stateName) stateNameOf.set(p.state, p.stateName);
}
const totalPop = [...statePop.values()].reduce((a, b) => a + b, 0);
const statesByPop = [...statePop.entries()].sort((a, b) => b[1] - a[1]);

// ── top-N pairs from name-pairs.ndjson (already ranked by estPeople) ───────────
const pairs = [];
const rl = createInterface({ input: createReadStream(join(DATA, 'name-pairs.ndjson')), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  pairs.push(JSON.parse(line));
  if (pairs.length >= N) break;
}
console.log(`  loaded ${pairs.length.toLocaleString()} pairs`);

// index by first / last (within the slice) for related-name links that resolve
const byFirst = new Map();
const byLast = new Map();
for (const p of pairs) {
  const s = slugify(`${p.first}-${p.last}`);
  p._slug = s;
  (byFirst.get(p.first) || byFirst.set(p.first, []).get(p.first)).push(p);
  (byLast.get(p.last) || byLast.set(p.last, []).get(p.last)).push(p);
}

const relatedFor = (p) => {
  const out = [];
  const seen = new Set([p._slug]);
  const push = (q) => { if (q && !seen.has(q._slug)) { seen.add(q._slug); out.push({ slug: q._slug, name: `${properCase(q.first)} ${properCase(q.last)}` }); } };
  const sameLast = (byLast.get(p.last) || []).filter((q) => q !== p).slice(0, 4);   // same surname
  const sameFirst = (byFirst.get(p.first) || []).filter((q) => q !== p).slice(0, 4); // same first name
  for (let i = 0; i < 4; i++) { push(sameLast[i]); push(sameFirst[i]); }
  return out.slice(0, 6);
};

const out = {};
for (const p of pairs) {
  const f = firstMap.get(p.first) || {};
  const l = lastMap.get(p.last) || {};
  const topStates = statesByPop.slice(0, 6).map(([st, pop]) => ({
    state: st,
    stateName: stateNameOf.get(st) || st,
    est: Math.max(1, Math.round(p.estPeople * (pop / totalPop))),
  }));
  out[p._slug] = {
    slug: p._slug,
    first: properCase(p.first),
    last: properCase(p.last),
    estPeople: p.estPeople,
    rank: p.rank,
    firstCount: f.count || null,
    firstRank: f.rank || null,
    lastCount: l.count || null,
    lastRank: l.rank || null,
    topStates,
    related: relatedFor(p),
  };
}

writeFileSync(join(DATA, 'name-slice.json'), JSON.stringify(out));
console.log(`✓ wrote data/name-slice.json — ${Object.keys(out).length.toLocaleString()} name pages`);
console.log(`  sample: ${Object.keys(out).slice(0, 3).join(', ')}`);
