// Sweep Wikidata (CC0 — public domain, no attribution required) for city facts that
// ACS doesn't carry: founded/incorporated year, county, elevation, nickname. Matches
// to our slice cities by normalized label and writes seo/data/city-wiki.json
// (keyed "ST/city-slug", each { qid, founded, county, elevationM, nickname }).
//
// Strategy: ONE SPARQL query per state pulls every settlement in that state with its
// facts — 51 queries, not 2,070. A later phase (fetch-wikidata-people.mjs) uses the
// resolved qids for "Notable people from [City]" (P19).
//
// Run:  node scripts/fetch-wikidata.mjs [--state ca]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const UA = 'idlookup-seo/1.0 (https://idlookup.me; davidw@peopledatasystems.ai)';
const ENDPOINT = 'https://query.wikidata.org/sparql';

const argv = process.argv.slice(2);
const ONLY = (argv.includes('--state') ? argv[argv.indexOf('--state') + 1] : '')?.toLowerCase() || null;

// USPS → Wikidata state QID (50 + DC).
const QID = {
  al:'Q173', ak:'Q797', az:'Q816', ar:'Q1612', ca:'Q99', co:'Q1261', ct:'Q779',
  de:'Q1393', dc:'Q61', fl:'Q812', ga:'Q1428', hi:'Q782', id:'Q1221', il:'Q1204',
  in:'Q1415', ia:'Q1546', ks:'Q1558', ky:'Q1603', la:'Q1588', me:'Q724', md:'Q1391',
  ma:'Q771', mi:'Q1166', mn:'Q1527', ms:'Q1494', mo:'Q1581', mt:'Q1212', ne:'Q1553',
  nv:'Q1227', nh:'Q759', nj:'Q1408', nm:'Q1522', ny:'Q1384', nc:'Q1454', nd:'Q1207',
  oh:'Q1397', ok:'Q1649', or:'Q824', pa:'Q1400', ri:'Q1387', sc:'Q1456', sd:'Q1211',
  tn:'Q1509', tx:'Q1439', ut:'Q829', vt:'Q16551', va:'Q1370', wa:'Q1223', wv:'Q1371',
  wi:'Q1537', wy:'Q1214',
};

const norm = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/,.*/, '').replace(/\([^)]*\)/g, ' ')
  .replace(/\b(city|town|village|borough|cdp|municipality|metropolitan government|urban county|balance)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const qidOf = (uri) => uri.replace('http://www.wikidata.org/entity/', '');
const yearOf = (iso) => { const m = /^-?(\d{1,4})/.exec(String(iso).replace(/^\+/, '')); return m ? Number(m[1]) : null; };

// Selective query: lead with counties-in-state (small set) → places in those counties,
// UNION places whose parent is the state directly (independent / consolidated cities).
// Avoids the recursive P131* / P279* walks that time out (504) on big states.
function sparql(stateQid) {
  return `SELECT ?city ?cityLabel ?pop ?founded ?countyLabel ?elevation ?nickname WHERE {
  { ?county wdt:P131 wd:${stateQid} . ?city wdt:P131 ?county . }
  UNION
  { ?city wdt:P131 wd:${stateQid} . }
  OPTIONAL { ?city wdt:P1082 ?pop. }
  OPTIONAL { ?city wdt:P571 ?founded. }
  OPTIONAL { ?city wdt:P2044 ?elevation. }
  OPTIONAL { ?city wdt:P1449 ?nickname. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

async function fetchState(code) {
  const q = sparql(QID[code]);
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(q)}&format=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const rows = (await res.json()).results.bindings;
  // Fold multiple rows per city (founded/nickname/county can multiply) into one record.
  const byQid = new Map();
  for (const r of rows) {
    const qid = qidOf(r.city.value);
    const label = r.cityLabel?.value || '';
    if (label === qid) continue; // unlabeled entity
    if (!byQid.has(qid)) byQid.set(qid, { qid, label, pop: 0, foundedYears: [], county: null, elevationM: null, nickname: null });
    const rec = byQid.get(qid);
    if (r.pop) rec.pop = Math.max(rec.pop, Number(r.pop.value) || 0);
    if (r.founded) { const y = yearOf(r.founded.value); if (y) rec.foundedYears.push(y); }
    if (r.countyLabel && !rec.county && !/^Q\d+$/.test(r.countyLabel.value)) rec.county = r.countyLabel.value;
    if (r.elevation && rec.elevationM == null) rec.elevationM = Math.round(Number(r.elevation.value));
    if (r.nickname && !rec.nickname) rec.nickname = r.nickname.value;
  }
  // Index by normalized label; on a name collision keep the highest-population
  // entity (the actual city, not a same-named neighborhood/township).
  const byName = new Map();
  for (const rec of byQid.values()) {
    const key = norm(rec.label);
    const cur = byName.get(key);
    if (!cur || rec.pop > cur.pop) byName.set(key, rec);
  }
  return byName;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const slice = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
  const states = Object.values(slice.states).filter((s) => !ONLY || s.code.toLowerCase() === ONLY);
  const out = {};
  let matched = 0, total = 0;

  for (const st of states) {
    const code = st.code.toLowerCase();
    if (!QID[code]) { console.log(`${st.code}: no QID, skip`); continue; }
    process.stdout.write(`${st.code}… `);
    let byName;
    try { byName = await fetchState(code); }
    catch (e) { console.log(`ERROR ${e.message}`); await sleep(1500); continue; }
    let m = 0;
    for (const c of st.cities) {
      total++;
      const rec = byName.get(norm(c.city));
      if (!rec) continue;
      const founded = rec.foundedYears.length ? Math.min(...rec.foundedYears) : null;
      const entry = {};
      if (rec.qid) entry.qid = rec.qid;
      if (founded) entry.founded = founded;
      if (rec.county) entry.county = rec.county;
      if (rec.elevationM != null) entry.elevationM = rec.elevationM;
      if (rec.nickname) entry.nickname = rec.nickname;
      out[`${st.code}/${c.slug}`] = entry;
      m++; matched++;
    }
    console.log(`${m}/${st.cities.length}`);
    await sleep(1200); // be a good SPARQL citizen
  }

  fs.writeFileSync(path.join(DATA, 'city-wiki.json'), JSON.stringify(out));
  console.log(`\n✅ ${matched}/${total} cities matched (${(matched / total * 100).toFixed(1)}%). Wrote data/city-wiki.json`);
})();
