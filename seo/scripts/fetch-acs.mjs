// Sweep ACS 5-year place demographics for the cities in state-slice.json and cache
// them to seo/data/city-acs.json (keyed "ST/city-slug"). These enrich the city and
// name-in-city pages with real, license-clean demographic content (public domain).
//
// Strategy: ONE API call per state pulls EVERY place (NAME + variables); we match
// those to our ~45-per-state slice cities by normalized name, disambiguating same-
// named places by a population sanity check. 52 calls total — not 2,070.
//
// ACS *5-year* on purpose: it covers every place regardless of size (1-year cuts off
// at 65k pop). Dataset path uses the END year: /2023/acs/acs5 = 2019–2023.
//
// Requires a free Census API key: https://api.census.gov/data/key_signup.html
// Run:  CENSUS_API_KEY=xxxx node seo/scripts/fetch-acs.mjs [--year 2023] [--state ca]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');

const KEY = process.env.CENSUS_API_KEY;
if (!KEY) {
  console.error('❌ Set CENSUS_API_KEY. Free key (instant, emailed): https://api.census.gov/data/key_signup.html');
  process.exit(1);
}

const argv = process.argv.slice(2);
const arg = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const YEAR = arg('--year', '2023');
const ONLY = arg('--state', null)?.toLowerCase() || null;

// USPS → state FIPS (50 states + DC). Territories omitted (ACS place coverage differs).
const FIPS = {
  al:'01', ak:'02', az:'04', ar:'05', ca:'06', co:'08', ct:'09', de:'10', dc:'11',
  fl:'12', ga:'13', hi:'15', id:'16', il:'17', in:'18', ia:'19', ks:'20', ky:'21',
  la:'22', me:'23', md:'24', ma:'25', mi:'26', mn:'27', ms:'28', mo:'29', mt:'30',
  ne:'31', nv:'32', nh:'33', nj:'34', nm:'35', ny:'36', nc:'37', nd:'38', oh:'39',
  ok:'40', or:'41', pa:'42', ri:'44', sc:'45', sd:'46', tn:'47', tx:'48', ut:'49',
  vt:'50', va:'51', wa:'53', wv:'54', wi:'55', wy:'56',
};

// Raw ACS variables → our field names. (Phase-b pins the full catalog; these are the
// high-value singles.) Education % is derived below from the B15003 breakdown.
const RAW = {
  B01003_001E: 'population',
  B01002_001E: 'medianAge',
  B19013_001E: 'medianHouseholdIncome',
  B25077_001E: 'medianHomeValue',
  B25064_001E: 'medianGrossRent',
  B11001_001E: 'households',
  B15003_001E: '_eduTotal',
  B15003_022E: '_bach', B15003_023E: '_mast', B15003_024E: '_prof', B15003_025E: '_doct',
};
const VAR_CODES = Object.keys(RAW);

// Normalize an ACS place NAME ("Los Angeles city, California") or our slice city name
// to a comparable slug. Strips the state suffix, the place-type word, and punctuation.
const norm = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')     // fold diacritics: Cañon→Canon
  .toLowerCase()
  .replace(/,.*/, '')                                   // drop ", California"
  .replace(/\([^)]*\)/g, ' ')                           // drop parentheticals "(balance)"
  .replace(/\b(city|town|village|borough|cdp|municipality|metropolitan government|urban county|balance)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); // "St. Louis"→"st-louis" (matches our slugs)

const num = (v) => { const n = Number(v); return (v == null || v === '' || Number.isNaN(n) || n < 0) ? null : n; };

async function fetchState(code) {
  const fips = FIPS[code];
  if (!fips) return null;
  const url = `https://api.census.gov/data/${YEAR}/acs/acs5?get=NAME,${VAR_CODES.join(',')}` +
              `&for=place:*&in=state:${fips}&key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${code.toUpperCase()} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  const head = rows[0];
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  // Build a lookup of normalized-name → array of place records (may collide; pop resolves).
  const byName = new Map();
  for (const r of rows.slice(1)) {
    const rec = { name: r[idx.NAME] };
    for (const code of VAR_CODES) rec[RAW[code]] = num(r[idx[code]]);
    const key = norm(rec.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(rec);
  }
  return byName;
}

function pick(records, cityPop) {
  if (!records || !records.length) return null;
  if (records.length === 1) return records[0];
  // Same normalized name → choose the place whose population is closest to our slice pop.
  return records.slice().sort((a, b) =>
    Math.abs((a.population ?? 0) - cityPop) - Math.abs((b.population ?? 0) - cityPop))[0];
}

function shape(rec) {
  const eduTop = ['_bach', '_mast', '_prof', '_doct'].reduce((a, k) => a + (rec[k] ?? 0), 0);
  const pctBachelorsPlus = rec._eduTotal ? Math.round((eduTop / rec._eduTotal) * 1000) / 10 : null;
  return {
    acsName: rec.name,
    population: rec.population,
    medianAge: rec.medianAge,
    medianHouseholdIncome: rec.medianHouseholdIncome,
    medianHomeValue: rec.medianHomeValue,
    medianGrossRent: rec.medianGrossRent,
    households: rec.households,
    pctBachelorsPlus,
  };
}

(async () => {
  const slice = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
  const states = Object.values(slice.states).filter((s) => !ONLY || s.code.toLowerCase() === ONLY);
  const out = {};
  let matched = 0, missed = 0;
  const misses = [];

  for (const st of states) {
    const code = st.code.toLowerCase();
    process.stdout.write(`${st.code} (${st.cities.length} cities)… `);
    let byName;
    try { byName = await fetchState(code); }
    catch (e) { console.log(`ERROR: ${e.message}`); continue; }
    if (!byName) { console.log('no FIPS, skip'); continue; }
    let m = 0;
    for (const c of st.cities) {
      const rec = pick(byName.get(norm(c.city)), c.pop);
      if (rec) { out[`${st.code}/${c.slug}`] = shape(rec); m++; matched++; }
      else { missed++; misses.push(`${st.code}/${c.city}`); }
    }
    console.log(`${m}/${st.cities.length} matched`);
  }

  fs.writeFileSync(path.join(DATA, 'city-acs.json'), JSON.stringify(out));
  const total = matched + missed;
  console.log(`\n✅ ${matched}/${total} cities enriched (${(matched / total * 100).toFixed(1)}%). Wrote data/city-acs.json`);
  if (misses.length) console.log(`⚠️  ${misses.length} unmatched (name edge-cases; phase-b lat/lng fallback):\n   ${misses.slice(0, 40).join(', ')}${misses.length > 40 ? ' …' : ''}`);
})();
