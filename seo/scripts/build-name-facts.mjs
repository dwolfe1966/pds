// Build seo/data/name-facts.json — the facts that enrich name-in-city LEAF pages,
// for just the ~192 first names + ~126 surnames in name-slice.json.
//
// Adds what the slice doesn't already carry (it has firstCount/rank, lastCount/rank):
//   • surnames  → race/ethnicity distribution (2010 Census "Frequently Occurring Surnames")
//   • first names → gender lean + peak decade (SSA-derived baby-name year data)
//
// Sources (public domain). Download once, then run:
//   Census 2010 surnames:  https://www2.census.gov/topics/genealogy/2010surnames/names.zip
//        → unzip Names_2010Census.csv
//   Baby names (SSA-derived, hadley mirror — ssa.gov blocks datacenter IPs):
//        https://raw.githubusercontent.com/hadley/data-baby-names/master/baby-names.csv
//        → save as babynames_mirror.csv
//   Place both under $NAME_SRC (default /private/tmp/seo-probe/names), then:
//        node scripts/build-name-facts.mjs
//
// NOTE: the baby-name mirror is 1880–2008 top-1000/year — fine for classic common names
// (their popularity peaks are historical); phase-b can swap in the SSA 2024 files if we
// want post-2008 accuracy or the 2020 Census xlsx for name-level ethnicity.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC = process.env.NAME_SRC || '/private/tmp/seo-probe/names';

const slice = JSON.parse(fs.readFileSync(path.join(DATA, 'name-slice.json'), 'utf8'));
const firsts = new Set(), lasts = new Set();
for (const n of Object.values(slice)) { firsts.add(n.first.toLowerCase()); lasts.add(n.last.toLowerCase()); }

// ── surnames → race/ethnicity ──────────────────────────────────────────────
const num = (v) => { const n = Number(v); return (v === '(S)' || v == null || v === '' || Number.isNaN(n)) ? null : n; };
const lastsOut = {};
for (const line of fs.readFileSync(path.join(SRC, 'Names_2010Census.csv'), 'utf8').split(/\r?\n/).slice(1)) {
  if (!line) continue;
  const [name, rank, count, , , white, black, api, aian, two, hisp] = line.split(',');
  const key = name.toLowerCase();
  if (!lasts.has(key) || lastsOut[key]) continue;
  lastsOut[key] = {
    rank: num(rank), count: num(count),
    pctWhite: num(white), pctBlack: num(black), pctApi: num(api),
    pctAian: num(aian), pct2race: num(two), pctHispanic: num(hisp),
  };
}

// ── first names → gender lean + peak decade ────────────────────────────────
// mirror rows: year,"name",percent,"boy"|"girl"
const agg = new Map();
for (const line of fs.readFileSync(path.join(SRC, 'babynames_mirror.csv'), 'utf8').split(/\r?\n/).slice(1)) {
  const m = line.match(/^(\d+),"([^"]+)",([\d.]+),"(boy|girl)"/);
  if (!m) continue;
  const [, year, name, percent, sex] = m;
  const key = name.toLowerCase();
  if (!firsts.has(key)) continue;
  if (!agg.has(key)) agg.set(key, { boy: { sum: 0, peakYear: 0, peakPct: 0 }, girl: { sum: 0, peakYear: 0, peakPct: 0 } });
  const a = agg.get(key)[sex === 'boy' ? 'boy' : 'girl'];
  const p = Number(percent);
  a.sum += p;
  if (p > a.peakPct) { a.peakPct = p; a.peakYear = Number(year); }
}
const firstsOut = {};
for (const [key, a] of agg) {
  const total = a.boy.sum + a.girl.sum;
  const pctMale = total ? Math.round((a.boy.sum / total) * 100) : null;
  const gender = pctMale == null ? null : pctMale >= 85 ? 'male' : pctMale <= 15 ? 'female' : 'unisex';
  const dom = a.boy.sum >= a.girl.sum ? a.boy : a.girl;
  const peakDecade = dom.peakYear ? `${Math.floor(dom.peakYear / 10) * 10}s` : null;
  firstsOut[key] = { gender, pctMale, peakDecade };
}

fs.writeFileSync(path.join(DATA, 'name-facts.json'), JSON.stringify({ firsts: firstsOut, lasts: lastsOut }));
const missF = [...firsts].filter((f) => !firstsOut[f]);
const missL = [...lasts].filter((l) => !lastsOut[l]);
console.log(`✅ firsts ${Object.keys(firstsOut).length}/${firsts.size}, lasts ${Object.keys(lastsOut).length}/${lasts.size} → data/name-facts.json`);
if (missF.length) console.log(`  first misses: ${missF.join(', ')}`);
if (missL.length) console.log(`  last misses: ${missL.join(', ')}`);
