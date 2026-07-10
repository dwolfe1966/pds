// Historical population per city from Wikidata (CC0), for the "population trend"
// chart. Uses the QIDs already resolved in city-wiki.json to query P1082 (population)
// statements with their P585 (point-in-time) qualifiers → [{ year, pop }]. Coverage
// is rich for major cities (NYC 1698→2020), sparse for small towns; the page anchors
// with the current ACS population and only renders a chart when there are ≥4 points.
//
// One query per city, throttled — run in the background after other Wikidata sweeps
// finish (avoid concurrent load). Writes seo/data/city-pophistory.json ("ST/slug" →
// [{ year, pop }]).
//
// Run:  node scripts/fetch-wikidata-pophistory.mjs [--only CA/los-angeles]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const UA = 'idlookup-seo/1.0 (https://idlookup.me; davidw@peopledatasystems.ai)';
const ENDPOINT = 'https://query.wikidata.org/sparql';

const argv = process.argv.slice(2);
const ONLY = (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '')?.split(',').filter(Boolean) || [];

const query = (qid) => `SELECT ?pop ?date WHERE {
  wd:${qid} p:P1082 ?st. ?st ps:P1082 ?pop.
  OPTIONAL { ?st pq:P585 ?date. }
} ORDER BY ?date`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function historyFor(qid) {
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query(qid))}&format=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()).results.bindings;
  // Keep only dated points; dedupe by year (max pop for that year); sort ascending.
  const byYear = new Map();
  for (const r of rows) {
    if (!r.date) continue;
    const year = Number(r.date.value.slice(0, 4));
    const pop = Number(r.pop.value);
    if (!year || !pop) continue;
    if (!byYear.has(year) || pop > byYear.get(year)) byYear.set(year, pop);
  }
  return [...byYear.entries()].map(([year, pop]) => ({ year, pop })).sort((a, b) => a.year - b.year);
}

(async () => {
  const wiki = JSON.parse(fs.readFileSync(path.join(DATA, 'city-wiki.json'), 'utf8'));
  const outPath = path.join(DATA, 'city-pophistory.json');
  const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  const entries = Object.entries(wiki).filter(([k, v]) => v.qid && (!ONLY.length || ONLY.includes(k)));

  let done = 0, kept = 0, fails = 0;
  for (const [key, v] of entries) {
    try {
      const hist = await historyFor(v.qid);
      if (hist.length >= 2) { out[key] = hist; kept++; } // <2 wiki pts → not chartable even with ACS anchor
    } catch (e) { fails++; if (fails <= 5) console.error(`  ${key}: ${e.message}`); }
    done++;
    if (done % 100 === 0) { fs.writeFileSync(outPath, JSON.stringify(out)); console.log(`${done}/${entries.length} (${kept} charted, ${fails} fails)`); }
    await sleep(900);
  }
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`\n✅ ${kept}/${entries.length} cities have ≥2 historical points (${fails} fails). Wrote data/city-pophistory.json`);
})();
