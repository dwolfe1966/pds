// Historic places per city from the NPS National Register of Historic Places (public
// domain), via the NPS ArcGIS MapServer. Per-state paginated query → match listings to
// our slice cities by normalized City name → keep the top ~8 (National Historic
// Landmarks first). Writes seo/data/city-historic.json ("ST/slug" → { count, nhl,
// places:[{name, nhl, url}] }) where count = total listings in that city.
//
// Public domain (US gov). Run: node scripts/fetch-nps-historic.mjs [--state ca]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const LAYER = 'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query';

const argv = process.argv.slice(2);
const ONLY = (argv.includes('--state') ? argv[argv.indexOf('--state') + 1] : '')?.toLowerCase() || null;

const norm = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/,.*/, '').replace(/\([^)]*\)/g, ' ')
  .replace(/\b(city|town|village|borough|cdp|municipality|metropolitan government|urban county|balance)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch every NRHP listing in a state (paginated), grouped by normalized city.
async function fetchState(stateNameUpper) {
  const byCity = new Map();
  let offset = 0;
  for (let guard = 0; guard < 40; guard++) {
    const url = `${LAYER}?where=${encodeURIComponent(`State='${stateNameUpper}'`)}` +
      `&outFields=RESNAME,City,Is_NHL,NARA_URL&returnGeometry=false&f=json` +
      `&resultRecordCount=2000&resultOffset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const feats = j.features || [];
    for (const f of feats) {
      const a = f.attributes;
      if (!a.RESNAME || !a.City) continue;
      const key = norm(a.City);
      if (!key) continue;
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key).push({ name: a.RESNAME, nhl: a.Is_NHL === 'X', url: a.NARA_URL || null });
    }
    if (feats.length < 2000 || !j.exceededTransferLimit) break;
    offset += 2000;
    await sleep(300);
  }
  return byCity;
}

(async () => {
  const slice = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
  const states = Object.values(slice.states).filter((s) => !ONLY || s.code.toLowerCase() === ONLY);
  const out = {};
  let matched = 0, total = 0;

  for (const st of states) {
    const stateName = (st.code === 'DC' ? 'District of Columbia' : st.name).toUpperCase();
    process.stdout.write(`${st.code}… `);
    let byCity;
    try { byCity = await fetchState(stateName); }
    catch (e) { console.log(`ERROR ${e.message}`); await sleep(1000); continue; }
    let m = 0;
    for (const c of st.cities) {
      total++;
      const list = byCity.get(norm(c.city));
      if (!list || !list.length) continue;
      // NHL first, then keep the top 8 for display; record the full count.
      const ranked = list.slice().sort((a, b) => (b.nhl - a.nhl));
      out[`${st.code}/${c.slug}`] = {
        count: list.length,
        nhl: list.filter((p) => p.nhl).length,
        places: ranked.slice(0, 8).map((p) => ({ name: p.name, nhl: p.nhl, url: p.url })),
      };
      m++; matched++;
    }
    console.log(`${m}/${st.cities.length}`);
    await sleep(500);
  }

  fs.writeFileSync(path.join(DATA, 'city-historic.json'), JSON.stringify(out));
  console.log(`\n✅ ${matched}/${total} cities have NRHP listings. Wrote data/city-historic.json`);
})();
