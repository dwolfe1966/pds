// Build data/city-schools.json — public schools per city, keyed "ST/slug". Source: NCES Common Core of Data
// via the Urban Institute Education Data API (educationdata.urban.org) — free, KEYLESS.
//
// The CCD directory endpoint only honors the `state_location` filter (city/county filters are ignored), so we
// pull one state at a time (paginated) and bucket schools by normalized city into our known city slugs. Output
// per city: total count, a breakdown by level, and a sample list (name, level, grade span, charter/magnet).
// Real directory data only — NO ratings (NCES has none; ratings are a paid GreatSchools product we won't fake).
//
// Run: node scripts/fetch-schools.mjs [--year 2022] [--state tx]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');
const SLICE = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const YEAR = argVal('--year', '2022');
const ONE_STATE = argVal('--state', '');

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const LEVEL = { '1': 'Elementary', '2': 'Middle', '3': 'High', '4': 'Other' };

// NB: the Urban Institute API 403s node's default fetch UA — send a browser UA.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(45000) }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  return null;
}

async function fetchState(stAbbr) {
  const rows = [];
  let url = `https://educationdata.urban.org/api/v1/schools/ccd/directory/${YEAR}/?state_location=${stAbbr}`;
  while (url) {
    const d = await getJson(url);
    if (!d) break;
    for (const s of d.results || []) rows.push(s);
    url = d.next || null;
  }
  return rows;
}

async function main() {
  const file = path.join(DATA, 'city-schools.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};

  const states = Object.keys(SLICE.states)
    .map((lc) => ({ lc, abbr: SLICE.states[lc].code, cities: SLICE.states[lc].cities }))
    .filter((s) => !ONE_STATE || s.lc === ONE_STATE.toLowerCase());

  for (const st of states) {
    const knownSlugs = new Set(st.cities.map((c) => c.slug));
    const rows = await fetchState(st.abbr);
    // bucket schools by normalized city → only keep buckets that match a known city slug
    const byCity = {};
    for (const s of rows) {
      const slug = slugify(s.city_location);
      if (!knownSlugs.has(slug)) continue;
      (byCity[slug] ||= []).push(s);
    }
    let wrote = 0;
    for (const [slug, schools] of Object.entries(byCity)) {
      const byLevel = { Elementary: 0, Middle: 0, High: 0, Other: 0 };
      for (const s of schools) byLevel[LEVEL[String(s.school_level)] || 'Other']++;
      // sample: prefer High → Middle → Elementary, then alphabetical; cap 14
      const rank = { '3': 0, '2': 1, '1': 2, '4': 3 };
      const sample = schools.slice()
        .sort((a, b) => (rank[String(a.school_level)] ?? 9) - (rank[String(b.school_level)] ?? 9) || String(a.school_name).localeCompare(String(b.school_name)))
        .slice(0, 14)
        .map((s) => ({
          name: String(s.school_name || '').replace(/\s+/g, ' ').trim(),
          level: LEVEL[String(s.school_level)] || null,
          lo: s.lowest_grade_offered || null, hi: s.highest_grade_offered || null,
          charter: s.charter === 1, magnet: s.magnet === 1,
          lat: Number.isFinite(s.latitude) ? s.latitude : null, lng: Number.isFinite(s.longitude) ? s.longitude : null,
        }))
        .filter((s) => s.name);
      out[`${st.abbr}/${slug}`] = { count: schools.length, byLevel, sample };
      wrote++;
    }
    fs.writeFileSync(file, JSON.stringify(out));
    console.error(`${st.abbr}: ${rows.length} schools → ${wrote} cities matched (total cached ${Object.keys(out).length})`);
  }
  console.error(`Done: ${Object.keys(out).length} city school profiles → ${path.relative(process.cwd(), file)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
