// Build data/city-school-ratings.json — a city-level school proficiency rating (% of grade-8 students at/above
// proficient in reading & math), keyed "ST/slug". Source: U.S. Dept. of Education EDFacts assessments via the
// Urban Institute API (KEYLESS, same source as the schools directory). For each state: map schools→city from
// the CCD directory, join grade-8 proficiency, and average across each city's schools. Real test data — no
// modeled "rating". Run: node scripts/fetch-school-ratings.mjs [--year 2018] [--state tx]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');
const SLICE = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const YEAR = argVal('--year', '2018');
const ONE = (argVal('--state', '') || '').toLowerCase();

const FIPS = { AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56' };
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(45000) }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 600 * (i + 1)));
  }
  return null;
}
async function pageAll(url0) {
  const rows = []; let url = url0;
  while (url) { const d = await getJson(url); if (!d) break; for (const x of d.results || []) rows.push(x); url = d.next || null; }
  return rows;
}

async function main() {
  const file = path.join(DATA, 'city-school-ratings.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const states = Object.keys(SLICE.states).map((lc) => ({ lc, abbr: SLICE.states[lc].code, fips: FIPS[SLICE.states[lc].code], cities: SLICE.states[lc].cities })).filter((s) => s.fips && (!ONE || s.lc === ONE));

  for (const st of states) {
    const known = new Set(st.cities.map((c) => c.slug));
    // ncessch(num) → city slug (only our known cities)
    const dir = await pageAll(`https://educationdata.urban.org/api/v1/schools/ccd/directory/2022/?state_location=${st.abbr}`);
    const schoolCity = new Map();
    for (const s of dir) { const slug = slugify(s.city_location); if (known.has(slug) && s.ncessch) schoolCity.set(String(s.ncessch), slug); }
    // grade-8 proficiency (all-students totals) → join to city
    const asmt = await pageAll(`https://educationdata.urban.org/api/v1/schools/edfacts/assessments/${YEAR}/grade-8/?fips=${st.fips}`);
    const byCity = {};
    for (const a of asmt) {
      const id = String(a.ncessch || a.ncessch_num || '');
      const slug = schoolCity.get(id);
      if (!slug) continue;
      const read = Number(a.read_test_pct_prof_midpt), math = Number(a.math_test_pct_prof_midpt);
      const b = (byCity[slug] ||= { read: [], math: [] });
      if (Number.isFinite(read)) b.read.push(read);
      if (Number.isFinite(math)) b.math.push(math);
    }
    let wrote = 0;
    for (const [slug, b] of Object.entries(byCity)) {
      const n = Math.max(b.read.length, b.math.length);
      if (n < 1) continue;
      const avg = (arr) => (arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : null);
      out[`${st.abbr}/${slug}`] = { readPct: avg(b.read), mathPct: avg(b.math), schoolsRated: n, grade: 8, year: Number(YEAR) };
      wrote++;
    }
    fs.writeFileSync(file, JSON.stringify(out));
    console.error(`${st.abbr}: ${dir.length} schools · ${asmt.length} assessments → ${wrote} cities rated (total ${Object.keys(out).length})`);
  }
  console.error(`Done: ${Object.keys(out).length} city school ratings → ${path.relative(process.cwd(), file)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
