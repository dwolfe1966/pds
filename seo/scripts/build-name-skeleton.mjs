#!/usr/bin/env node
/**
 * build-name-skeleton.mjs — Layer 1 of the SEO people-directory: the ranked
 * US name universe (the URL skeleton), from public-domain government data.
 *
 * Sources (public domain / US Government Work):
 *   - Last names:  US Census 2010 "Frequently Occurring Surnames" (clean CSV,
 *     name,rank,count,...). ~162k surnames occurring >=100x.
 *     https://www2.census.gov/topics/genealogy/2010surnames/names.zip
 *   - First names: US Census 2020 first names x sex (XLSX; first Census
 *     first-name data since 1990). ~53.6k first names occurring >=100x.
 *     https://www2.census.gov/topics/genealogy/2020surnames/Names2020_FirstNames_Sex.xlsx
 *
 * Output (seo/data/):
 *   - first-names.json / last-names.json — cleaned {name,count}, freq-desc.
 *   - name-skeleton-stats.json — universe sizing (the "how many pages" answer).
 *   - name-pairs.ndjson — top-N ranked candidate pairs = the BC/IDI query queue,
 *     scored by estPeople = firstCount*lastCount/POP (independence prior for how
 *     many real people carry that exact name ~= search demand). Big file, gitignored.
 *
 * Zero npm deps (uses `unzip` CLI + Node stdlib) so it runs reproducibly anywhere.
 * Usage: node seo/scripts/build-name-skeleton.mjs [--top N]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEO = path.resolve(HERE, '..');
const CACHE = path.join(SEO, '.cache', 'names');
const OUT = path.join(SEO, 'data');
mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const TOP_N = (() => {
  const i = process.argv.indexOf('--top');
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : 500_000;
})();

const SOURCES = {
  last2010: {
    url: 'https://www2.census.gov/topics/genealogy/2010surnames/names.zip',
    file: path.join(CACHE, 'names2010.zip'),
  },
  first2020: {
    url: 'https://www2.census.gov/topics/genealogy/2020surnames/Names2020_FirstNames_Sex.xlsx',
    file: path.join(CACHE, 'first2020.xlsx'),
  },
};

async function download(url, dest) {
  if (existsSync(dest)) { console.log(`  cached: ${path.basename(dest)}`); return; }
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log(`  saved ${path.basename(dest)} (${(buf.length / 1e6).toFixed(1)} MB)`);
}

// ── Parse the 2010 surnames CSV (last names) ──────────────────────────────────
function parseLastNames() {
  const dir = path.join(CACHE, 'unz2010');
  mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', SOURCES.last2010.file, '-d', dir]);
  const csvPath = path.join(dir, 'Names_2010Census.csv');
  const lines = readFileSync(csvPath, 'utf8').split('\n');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cols = row.split(',');
    const name = (cols[0] || '').trim();
    const count = parseInt(cols[2], 10);
    if (!name || name === 'ALL OTHER NAMES' || !Number.isFinite(count)) continue;
    out.push({ name, count });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

// ── Parse the 2020 first-names XLSX (zero-dep XML) ────────────────────────────
// Data starts at row 4: cell A = name (shared-string index), cell C = count.
function parseFirstNames() {
  const dir = path.join(CACHE, 'unz2020first');
  mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', SOURCES.first2020.file, '-d', dir]);

  // Shared strings: one entry per <si> (concat its <t> runs).
  const ssXml = readFileSync(path.join(dir, 'xl', 'sharedStrings.xml'), 'utf8');
  const strings = [];
  for (const si of ssXml.split('<si>').slice(1)) {
    const chunk = si.split('</si>')[0];
    let text = '';
    for (const m of chunk.matchAll(/<t[^>]*>([^<]*)<\/t>/g)) text += m[1];
    strings.push(decodeXml(text));
  }

  const sheet = readFileSync(path.join(dir, 'xl', 'worksheets', 'sheet1.xml'), 'utf8');
  const out = [];
  for (const rowChunk of sheet.split('<row ').slice(1)) {
    const rMatch = rowChunk.match(/^r="(\d+)"/);
    if (!rMatch || parseInt(rMatch[1], 10) < 4) continue; // rows 1-3 are titles/headers
    // Name = column-A cell (shared string). Count = column-C cell (numeric).
    const aMatch = rowChunk.match(/<c r="A\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v>/);
    const cMatch = rowChunk.match(/<c r="C\d+"[^>]*><v>([\d.]+)<\/v>/);
    if (!aMatch || !cMatch) continue;
    const name = (strings[parseInt(aMatch[1], 10)] || '').trim();
    const count = Math.round(parseFloat(cMatch[1]));
    // Census files carry an "ALL OTHER NAMES" catch-all aggregate — not a real name.
    if (!name || name === 'ALL OTHER NAMES' || !Number.isFinite(count)) continue;
    out.push({ name, count });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

function decodeXml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Downloading sources…');
  await download(SOURCES.last2010.url, SOURCES.last2010.file);
  await download(SOURCES.first2020.url, SOURCES.first2020.file);

  console.log('Parsing…');
  const last = parseLastNames();
  const first = parseFirstNames();
  console.log(`  first names: ${first.length.toLocaleString()}  ·  last names: ${last.length.toLocaleString()}`);

  const F = first.reduce((s, x) => s + x.count, 0);
  const L = last.reduce((s, x) => s + x.count, 0);
  const POP = L; // last-name occurrences ~= covered population base
  const estPeople = (fc, lc) => (fc * lc) / POP;

  writeFileSync(path.join(OUT, 'first-names.json'), JSON.stringify(first));
  writeFileSync(path.join(OUT, 'last-names.json'), JSON.stringify(last));

  // Universe sizing. Theoretical combos = |first| x |last|, but most are empty.
  // "Viable" = pairs where estPeople >= 1 (expected >=1 real person => a real page).
  // Count viable pairs + total addressable pages WITHOUT materializing billions:
  // for each first name, viable last names are those with lc >= POP/fc (binary search
  // on the count-desc last list). Sum estPeople over viable pairs too.
  const lastCounts = last.map((x) => x.count); // desc
  const firstViableThreshold = (fc) => POP / fc;
  let viablePairs = 0;
  let addressablePeople = 0;
  // prefix sums of last counts for fast "sum of lc for top-k"
  const lastPrefix = new Array(lastCounts.length + 1).fill(0);
  for (let i = 0; i < lastCounts.length; i++) lastPrefix[i + 1] = lastPrefix[i] + lastCounts[i];
  const upperBound = (minVal) => { // # of last names with count >= minVal (desc array)
    let lo = 0, hi = lastCounts.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (lastCounts[mid] >= minVal) lo = mid + 1; else hi = mid; }
    return lo;
  };
  for (const { count: fc } of first) {
    const k = upperBound(firstViableThreshold(fc)); // # viable last names for this first
    if (k === 0) continue;
    viablePairs += k;
    addressablePeople += (fc * lastPrefix[k]) / POP;
  }

  const stats = {
    generatedNote: 'US name skeleton — public-domain Census data. estPeople = firstCount*lastCount/POP (independence prior).',
    firstNames: first.length,
    lastNames: last.length,
    theoreticalCombos: first.length * last.length,
    firstNameOccurrences: F,
    lastNameOccurrences: L,
    populationBase: POP,
    viablePairs_estPeople_ge_1: viablePairs,
    addressableProfilePages_est: Math.round(addressablePeople),
    topN_written: TOP_N,
    sampleTopFirst: first.slice(0, 8).map((x) => `${x.name}(${x.count.toLocaleString()})`),
    sampleTopLast: last.slice(0, 8).map((x) => `${x.name}(${x.count.toLocaleString()})`),
  };
  writeFileSync(path.join(OUT, 'name-skeleton-stats.json'), JSON.stringify(stats, null, 2));

  // Ranked candidate pairs (the BC query queue). The top-N by estPeople come from
  // a bounded frontier of the highest-count first/last names — cross the top slices
  // (enough to cover N), score, keep top-N via a fixed-size min-heap.
  const FSLICE = Math.min(first.length, 4000);
  const LSLICE = Math.min(last.length, 12000);
  const heap = new MinHeap(TOP_N); // keeps the N largest by score
  for (let i = 0; i < FSLICE; i++) {
    const fc = first[i].count;
    // last names are desc; once fc*lc drops below the heap min, the rest are smaller too.
    for (let j = 0; j < LSLICE; j++) {
      const score = fc * last[j].count;
      if (heap.full() && score <= heap.min()) break; // rest of this row is smaller
      heap.push(score, i, j);
    }
  }
  const pairs = heap.drainSortedDesc(); // [{score,i,j}]
  const nd = createWriteStream(path.join(OUT, 'name-pairs.ndjson'));
  let rank = 0;
  for (const p of pairs) {
    rank++;
    nd.write(JSON.stringify({
      rank,
      first: first[p.i].name,
      last: last[p.j].name,
      estPeople: Math.round(p.score / POP),
    }) + '\n');
  }
  nd.end();

  console.log('\n── Universe sizing ─────────────────────────────');
  console.log(`  first names:              ${stats.firstNames.toLocaleString()}`);
  console.log(`  last names:               ${stats.lastNames.toLocaleString()}`);
  console.log(`  theoretical combos:       ${stats.theoreticalCombos.toLocaleString()}`);
  console.log(`  VIABLE pairs (>=1 person):${' '}${stats.viablePairs_estPeople_ge_1.toLocaleString()}  <- real page universe`);
  console.log(`  addressable profile pages:${' '}~${stats.addressableProfilePages_est.toLocaleString()}`);
  console.log(`  top-N pairs written:      ${TOP_N.toLocaleString()} -> data/name-pairs.ndjson`);
  console.log('  outputs -> seo/data/{first-names,last-names,name-skeleton-stats}.json');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

// Fixed-size min-heap keeping the N largest scores.
class MinHeap {
  constructor(cap) { this.cap = cap; this.a = []; }
  full() { return this.a.length >= this.cap; }
  min() { return this.a.length ? this.a[0].score : -Infinity; }
  push(score, i, j) {
    if (this.a.length < this.cap) { this.a.push({ score, i, j }); this._up(this.a.length - 1); }
    else if (score > this.a[0].score) { this.a[0] = { score, i, j }; this._down(0); }
  }
  _up(k) { while (k > 0) { const p = (k - 1) >> 1; if (this.a[p].score <= this.a[k].score) break; [this.a[p], this.a[k]] = [this.a[k], this.a[p]]; k = p; } }
  _down(k) { const n = this.a.length; for (;;) { let s = k, l = 2 * k + 1, r = l + 1; if (l < n && this.a[l].score < this.a[s].score) s = l; if (r < n && this.a[r].score < this.a[s].score) s = r; if (s === k) break; [this.a[s], this.a[k]] = [this.a[k], this.a[s]]; k = s; } }
  drainSortedDesc() { return this.a.slice().sort((a, b) => b.score - a.score); }
}
