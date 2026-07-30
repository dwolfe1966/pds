// Build data/city-fema.json — FEMA National Risk Index (natural-disaster risk) per city, keyed "ST/slug".
//
// Pipeline (all free/keyless): (1) pull the full NRI COUNTY table from FEMA's ArcGIS FeatureServer (overall
// risk rating + 18 per-hazard ratings, ~3,235 counties); (2) resolve every city in data/state-slice.json to its
// county FIPS via the FCC block API (lat/lng → county); (3) join and write the per-city risk profile. Pages read
// the cached JSON at render (no runtime API), same ISR-safe pattern as fetch-acs.
//
// Run: node scripts/fetch-fema-nri.mjs [--limit N] [--concurrency 8]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');
const SLICE = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));

const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const LIMIT = parseInt(argVal('--limit', '0'), 10) || 0;
const CONC = parseInt(argVal('--concurrency', '8'), 10);

const NRI = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query';
const HAZARDS = {
  AVLN: 'Avalanche', CFLD: 'Coastal flooding', CWAV: 'Cold wave', DRGT: 'Drought', ERQK: 'Earthquake',
  HAIL: 'Hail', HWAV: 'Heat wave', HRCN: 'Hurricane', ISTM: 'Ice storm', LNDS: 'Landslide', LTNG: 'Lightning',
  IFLD: 'Riverine flooding', SWND: 'Strong wind', TRND: 'Tornado', TSUN: 'Tsunami', VLCN: 'Volcano',
  WFIR: 'Wildfire', WNTW: 'Winter weather',
};
const SEVERITY = { 'Very Low': 1, 'Relatively Low': 2, 'Relatively Moderate': 3, 'Relatively High': 4, 'Very High': 5 };

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  return null;
}

// 1. Full NRI county table → { STCOFIPS: {rating, score, county, hazards:[{label,rating,sev}]} }
async function loadCounties() {
  const out = {};
  const fields = ['STCOFIPS', 'COUNTY', 'STATEABBRV', 'RISK_RATNG', 'RISK_SCORE', ...Object.keys(HAZARDS).map((h) => `${h}_RISKR`)];
  let offset = 0;
  for (;;) {
    const url = `${NRI}?where=1%3D1&outFields=${fields.join(',')}&returnGeometry=false&resultOffset=${offset}&resultRecordCount=2000&f=json`;
    const d = await getJson(url);
    const feats = (d && d.features) || [];
    for (const f of feats) {
      const a = f.attributes;
      const hazards = Object.entries(HAZARDS)
        .map(([k, label]) => ({ label, rating: a[`${k}_RISKR`], sev: SEVERITY[a[`${k}_RISKR`]] || 0 }))
        .filter((h) => h.sev > 0)
        .sort((x, y) => y.sev - x.sev);
      out[String(a.STCOFIPS)] = {
        rating: a.RISK_RATNG || null,
        score: a.RISK_SCORE != null ? Math.round(a.RISK_SCORE * 10) / 10 : null,
        county: a.COUNTY, state: a.STATEABBRV, hazards,
      };
    }
    if (!d || !d.exceededTransferLimit || feats.length === 0) break;
    offset += feats.length;
  }
  return out;
}

// FCC block API: lat/lng → county FIPS (STCOFIPS = state+county).
async function countyFips(lat, lng) {
  const d = await getJson(`https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&format=json`);
  return d && d.County && d.County.FIPS ? String(d.County.FIPS) : null;
}

async function pool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0, done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
      if (++done % 100 === 0) process.stderr.write(`  …${done}/${items.length}\n`);
    }
  }));
  return results;
}

async function main() {
  console.error('Loading FEMA NRI county table…');
  const counties = await loadCounties();
  console.error(`  ${Object.keys(counties).length} counties loaded.`);
  if (Object.keys(counties).length < 3000) { console.error('NRI county load looks short — aborting to avoid a bad cache.'); process.exit(1); }

  const cities = [];
  for (const lc of Object.keys(SLICE.states)) {
    const st = SLICE.states[lc];
    for (const c of st.cities) if (c.lat != null && c.lng != null) cities.push({ lc, slug: c.slug, city: c.city, lat: c.lat, lng: c.lng });
  }
  const work = LIMIT ? cities.slice(0, LIMIT) : cities;
  console.error(`Resolving ${work.length} cities → county (FCC), concurrency ${CONC}…`);

  const file = path.join(DATA, 'city-fema.json');
  const out = {};
  const save = () => fs.writeFileSync(file, JSON.stringify(out));

  // Batch so partial progress persists (the FCC sweep is long; a single end-of-run write loses everything on
  // early exit — the bug in the first attempt).
  const BATCH = 250;
  for (let b = 0; b < work.length; b += BATCH) {
    const chunk = work.slice(b, b + BATCH);
    await pool(chunk, async (c) => {
      const fips = await countyFips(c.lat, c.lng);
      const nri = fips && counties[fips];
      if (!nri) return null;
      out[`${c.lc.toUpperCase()}/${c.slug}`] = { rating: nri.rating, score: nri.score, county: nri.county, hazards: nri.hazards.slice(0, 6) };
      return true;
    }, CONC);
    save();
    console.error(`  saved ${Object.keys(out).length} profiles (through ${Math.min(b + BATCH, work.length)}/${work.length})`);
  }
  console.error(`Done: ${Object.keys(out).length} city risk profiles → ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
