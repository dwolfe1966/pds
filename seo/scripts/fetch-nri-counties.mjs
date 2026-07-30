// Build data/counties.json — the canonical US county list (all ~3,235 counties), grouped by lowercase state,
// each with FIPS + FEMA National Risk Index disaster data. Source: FEMA NRI county FeatureServer (keyless).
//
// This is the routing + disasters backbone for the /homefacts county grain (independent of the incarceration
// roster, which only covers a few states). ACS county demographics attach at render time when CENSUS_API_KEY is
// set. Run: node scripts/fetch-nri-counties.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');

const NRI = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query';
const HAZARDS = {
  AVLN: 'Avalanche', CFLD: 'Coastal flooding', CWAV: 'Cold wave', DRGT: 'Drought', ERQK: 'Earthquake',
  HAIL: 'Hail', HWAV: 'Heat wave', HRCN: 'Hurricane', ISTM: 'Ice storm', LNDS: 'Landslide', LTNG: 'Lightning',
  IFLD: 'Riverine flooding', SWND: 'Strong wind', TRND: 'Tornado', TSUN: 'Tsunami', VLCN: 'Volcano',
  WFIR: 'Wildfire', WNTW: 'Winter weather',
};
const SEVERITY = { 'Very Low': 1, 'Relatively Low': 2, 'Relatively Moderate': 3, 'Relatively High': 4, 'Very High': 5 };
const slugify = (s) => String(s || '').toLowerCase().replace(/\bcounty\b|\bparish\b|\bborough\b|\bcensus area\b/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  return null;
}

async function main() {
  const fields = ['STCOFIPS', 'COUNTY', 'STATEABBRV', 'RISK_RATNG', 'RISK_SCORE', ...Object.keys(HAZARDS).map((h) => `${h}_RISKR`)];
  const byState = {};
  let offset = 0, total = 0;
  for (;;) {
    const url = `${NRI}?where=1%3D1&outFields=${fields.join(',')}&returnGeometry=false&resultOffset=${offset}&resultRecordCount=2000&f=json`;
    const d = await getJson(url);
    const feats = (d && d.features) || [];
    for (const f of feats) {
      const a = f.attributes;
      const st = String(a.STATEABBRV || '').toLowerCase();
      if (!st) continue;
      const hazards = Object.entries(HAZARDS)
        .map(([k, label]) => ({ label, rating: a[`${k}_RISKR`], sev: SEVERITY[a[`${k}_RISKR`]] || 0 }))
        .filter((h) => h.sev > 0).sort((x, y) => y.sev - x.sev).slice(0, 6);
      (byState[st] ||= []).push({
        name: String(a.COUNTY || '').replace(/\s+/g, ' ').trim(),
        slug: slugify(a.COUNTY),
        fips: String(a.STCOFIPS),
        rating: a.RISK_RATNG || null,
        score: a.RISK_SCORE != null ? Math.round(a.RISK_SCORE * 10) / 10 : null,
        hazards,
      });
      total++;
    }
    if (!d || !d.exceededTransferLimit || feats.length === 0) break;
    offset += feats.length;
  }
  for (const st of Object.keys(byState)) byState[st].sort((a, b) => a.name.localeCompare(b.name));
  if (total < 3000) { console.error(`Only ${total} counties — aborting (bad load).`); process.exit(1); }
  const file = path.join(DATA, 'counties.json');
  fs.writeFileSync(file, JSON.stringify(byState));
  console.error(`Wrote ${total} counties across ${Object.keys(byState).length} states → ${path.relative(process.cwd(), file)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
