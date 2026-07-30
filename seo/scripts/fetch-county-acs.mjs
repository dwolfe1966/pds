// Build data/county-acs.json — ACS demographics/property for every US county, keyed by 5-digit STCOFIPS.
// Source: Census ACS 5-year, one batch call per state (for=county:*). Pre-caching removes the runtime Census
// dependency for county pages (was fetch-at-generation). Run: CENSUS_API_KEY set → node scripts/fetch-county-acs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');
const KEY = process.env.CENSUS_API_KEY;
if (!KEY) { console.error('CENSUS_API_KEY not set'); process.exit(1); }
const YEAR = 2023;

// State FIPS list (50 + DC).
const STATE_FIPS = ['01', '02', '04', '05', '06', '08', '09', '10', '11', '12', '13', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '44', '45', '46', '47', '48', '49', '50', '51', '53', '54', '55', '56'];
const VARS = ['B01003_001E', 'B01002_001E', 'B19013_001E', 'B19301_001E', 'B25077_001E', 'B25064_001E', 'B25003_001E', 'B25003_002E'];

const g = (row, header, code) => { const n = Number(row[header.indexOf(code)]); return Number.isFinite(n) && n > -1e6 ? n : null; };
async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  return null;
}

async function main() {
  const out = {};
  for (const fips of STATE_FIPS) {
    const url = `https://api.census.gov/data/${YEAR}/acs/acs5?get=NAME,${VARS.join(',')}&for=county:*&in=state:${fips}&key=${KEY}`;
    const d = await getJson(url);
    if (!d || d.length < 2) { console.error(`state ${fips}: no data`); continue; }
    const h = d[0];
    for (const row of d.slice(1)) {
      const stco = `${row[h.indexOf('state')]}${row[h.indexOf('county')]}`;
      const ownTot = g(row, h, 'B25003_001E'), ownOcc = g(row, h, 'B25003_002E');
      out[stco] = {
        population: g(row, h, 'B01003_001E'), medianAge: g(row, h, 'B01002_001E'),
        medianHouseholdIncome: g(row, h, 'B19013_001E'), perCapitaIncome: g(row, h, 'B19301_001E'),
        medianHomeValue: g(row, h, 'B25077_001E'), medianGrossRent: g(row, h, 'B25064_001E'),
        pctOwnerOccupied: ownTot && ownOcc != null ? Math.round((ownOcc / ownTot) * 100) : null,
      };
    }
  }
  if (Object.keys(out).length < 3000) { console.error(`Only ${Object.keys(out).length} counties — aborting.`); process.exit(1); }
  const file = path.join(DATA, 'county-acs.json');
  fs.writeFileSync(file, JSON.stringify(out));
  console.error(`Wrote ${Object.keys(out).length} county ACS profiles → ${path.relative(process.cwd(), file)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
