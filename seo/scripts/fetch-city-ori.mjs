// Build data/city-ori.json — maps our city slugs → their primary police agency ORI, so the crime module can
// pull FBI UCR/NIBRS rates for the city's own department. Source: FBI CDE agencies endpoint (one call per
// state). Keyless of guesswork; needs FBI_CDE_KEY. Run: node scripts/fetch-city-ori.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');
const SLICE = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
const KEY = process.env.FBI_CDE_KEY;
if (!KEY) { console.error('FBI_CDE_KEY not set'); process.exit(1); }

const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Normalize an agency name to a city slug: drop the department boilerplate, keep the place.
const agencyToSlug = (name) => slugify(String(name || '').toUpperCase()
  .replace(/\bPOLICE DEPARTMENT\b|\bPOLICE DEPT\b|\bDEPARTMENT OF PUBLIC SAFETY\b|\bPUBLIC SAFETY\b|\bPOLICE\b|\bDEPARTMENT\b|\bDEPT\b|\bMETROPOLITAN\b|\bMETRO\b|\bCITY OF\b|\bTOWN OF\b|\bBOROUGH OF\b/g, '')
  .replace(/\bPD\b/g, '').trim());

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 600 * (i + 1)));
  }
  return null;
}

async function main() {
  const file = path.join(DATA, 'city-ori.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const lc of Object.keys(SLICE.states)) {
    const st = SLICE.states[lc];
    const known = new Map(st.cities.map((c) => [c.slug, c])); // slug → {city,pop}
    const d = await getJson(`https://api.usa.gov/crime/fbi/cde/agency/byStateAbbr/${st.code}?API_KEY=${KEY}`);
    if (!d) { console.error(`${st.code}: no agencies`); continue; }
    let wrote = 0;
    for (const county of Object.keys(d)) {
      for (const a of d[county]) {
        if (a.agency_type_name !== 'City') continue;
        const slug = agencyToSlug(a.agency_name);
        if (!known.has(slug)) continue;
        const key = `${st.code}/${slug}`;
        // keep the NIBRS agency if there's a choice (better data), else first match
        if (!out[key] || (a.is_nibrs && !out[key].nibrs)) { out[key] = { ori: a.ori, agency: a.agency_name, nibrs: !!a.is_nibrs }; wrote++; }
      }
    }
    fs.writeFileSync(file, JSON.stringify(out));
    console.error(`${st.code}: matched ${wrote} cities → ORIs (total ${Object.keys(out).length})`);
  }
  console.error(`Done: ${Object.keys(out).length} city→ORI mappings → ${path.relative(process.cwd(), file)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
