// Build data/city-epa.json — environmental-hazard signal per city, keyed "ST/slug". Source: EPA Toxics Release
// Inventory (TRI) via the Envirofacts efservice REST API — free, KEYLESS. TRI facilities are sites that report
// releasing toxic chemicals; a far more meaningful "hazard" signal than the all-registered FRS list.
//
// efservice honors state + city filters, but per-state pulls (paginated) are far fewer requests than per-city,
// so we sweep by state and bucket facilities into known city slugs. Output per city: facility count + a sample
// list (name, county). Real data only. Run: node scripts/fetch-epa-tri.mjs [--state tx]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');
const SLICE = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
const args = process.argv.slice(2);
const ONE_STATE = (args.indexOf('--state') >= 0 ? args[args.indexOf('--state') + 1] : '').toLowerCase();

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(45000) }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  return null;
}

async function fetchStateTri(stAbbr) {
  const rows = [];
  const CHUNK = 1000;
  for (let start = 0; ; start += CHUNK) {
    const url = `https://data.epa.gov/efservice/TRI_FACILITY/STATE_ABBR/=/${stAbbr}/rows/${start}:${start + CHUNK - 1}/JSON`;
    const d = await getJson(url);
    if (!Array.isArray(d) || d.length === 0) break;
    rows.push(...d);
    if (d.length < CHUNK) break;
  }
  return rows;
}

async function main() {
  const file = path.join(DATA, 'city-epa.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const states = Object.keys(SLICE.states)
    .map((lc) => ({ lc, abbr: SLICE.states[lc].code, cities: SLICE.states[lc].cities }))
    .filter((s) => !ONE_STATE || s.lc === ONE_STATE);

  for (const st of states) {
    const knownSlugs = new Set(st.cities.map((c) => c.slug));
    const rows = await fetchStateTri(st.abbr);
    const byCity = {};
    for (const r of rows) {
      if (String(r.fac_closed_ind || '').toUpperCase() === 'Y') continue; // drop closed sites
      const slug = slugify(r.city_name);
      if (!knownSlugs.has(slug)) continue;
      (byCity[slug] ||= []).push(r);
    }
    let wrote = 0;
    for (const [slug, facs] of Object.entries(byCity)) {
      const seen = new Set();
      const sample = [];
      for (const f of facs) {
        const name = titleCase(f.facility_name);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        sample.push({ name, county: f.county_name ? titleCase(f.county_name) : null });
        if (sample.length >= 12) break;
      }
      out[`${st.abbr}/${slug}`] = { count: facs.length, sample };
      wrote++;
    }
    fs.writeFileSync(file, JSON.stringify(out));
    console.error(`${st.abbr}: ${rows.length} TRI facilities → ${wrote} cities (total cached ${Object.keys(out).length})`);
  }
  console.error(`Done: ${Object.keys(out).length} city environmental profiles → ${path.relative(process.cwd(), file)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
