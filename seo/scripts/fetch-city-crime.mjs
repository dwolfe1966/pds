// Build data/city-crime.json — FBI UCR/NIBRS crime (agency vs state vs U.S.) per city, keyed "ST/slug".
// Pre-caching removes the runtime FBI dependency (was fetch-at-generation, which needs the key in the hosting
// env and can time out). Reads data/city-ori.json (city → police ORI). Sweeps top cities by population first.
// Rate limit: api.data.gov allows ~1,000/hr; each city = 2 calls. Run: FBI_CDE_KEY=... node scripts/fetch-city-crime.mjs [--limit 500]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, '..', 'data');
const SLICE = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
const ORI = JSON.parse(fs.readFileSync(path.join(DATA, 'city-ori.json'), 'utf8'));
const KEY = process.env.FBI_CDE_KEY;
if (!KEY) { console.error('FBI_CDE_KEY not set'); process.exit(1); }
const args = process.argv.slice(2);
const LIMIT = parseInt((args.indexOf('--limit') >= 0 ? args[args.indexOf('--limit') + 1] : '0'), 10) || 0;

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (r.ok) return await r.json(); if (r.status === 429) await new Promise((s) => setTimeout(s, 3000)); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  return null;
}
function annualize(series) {
  if (!series) return null;
  const years = [...new Set(Object.keys(series).map((k) => k.split('-')[1]))].sort();
  const yr = years[years.length - 1];
  const vals = Object.entries(series).filter(([k, v]) => k.endsWith(`-${yr}`) && v != null).map(([, v]) => v);
  if (!vals.length) return null;
  return { year: yr, rate: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 12) };
}
// 5-year yearly trend (per-100k/yr) from a monthly-rate series → [{year, rate}] sorted ascending.
function yearlyTrend(series) {
  if (!series) return [];
  const byYear = {};
  for (const [mk, v] of Object.entries(series)) {
    if (v == null) continue;
    const y = mk.split('-')[1];
    (byYear[y] ||= []).push(v);
  }
  return Object.entries(byYear).map(([year, vs]) => ({ year, rate: Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 12) })).sort((a, b) => a.year.localeCompare(b.year));
}
async function series(ori, offense) {
  const d = await getJson(`https://api.usa.gov/crime/fbi/sapi/summarized/agency/${ori}/${offense}?from=01-2019&to=12-2023&api_key=${KEY}`);
  return (d && d.offenses && d.offenses.rates) || null;
}
function pick(rates, agency, kind) {
  if (!rates) return null;
  const agencyKey = Object.keys(rates).find((k) => k.startsWith(agency) && k.endsWith('Offenses'));
  const usKey = 'United States Offenses';
  const stateKey = Object.keys(rates).find((k) => k.endsWith('Offenses') && k !== usKey && k !== agencyKey);
  const a = agencyKey && annualize(rates[agencyKey]);
  return a ? { kind, year: a.year, place: a.rate, state: (stateKey && annualize(rates[stateKey])?.rate) ?? null, us: annualize(rates[usKey])?.rate ?? null, trend: yearlyTrend(rates[agencyKey]) } : null;
}

async function main() {
  // Order cities by population (top first) so the demo/major cities cache first.
  const cities = [];
  for (const lc of Object.keys(SLICE.states)) {
    const st = SLICE.states[lc];
    for (const c of st.cities) { const m = ORI[`${st.code}/${c.slug}`]; if (m) cities.push({ key: `${st.code}/${c.slug}`, ori: m.ori, agency: m.agency, pop: c.pop || 0 }); }
  }
  cities.sort((a, b) => b.pop - a.pop);
  const work = LIMIT ? cities.slice(0, LIMIT) : cities;

  const file = path.join(DATA, 'city-crime.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  let done = 0;
  for (const c of work) {
    // resume-friendly — but re-fetch entries that predate the yearly trend so a re-run backfills it.
    if (out[c.key] && out[c.key].violent && Array.isArray(out[c.key].violent.trend)) { done++; continue; }
    const [vR, pR] = await Promise.all([series(c.ori, 'violent-crime'), series(c.ori, 'property-crime')]);
    const violent = pick(vR, c.agency, 'violent');
    const property = pick(pR, c.agency, 'property');
    if (violent || property) out[c.key] = { agency: c.agency, year: (violent || property).year, violent, property };
    if (++done % 25 === 0) { fs.writeFileSync(file, JSON.stringify(out)); console.error(`  ${done}/${work.length} (cached ${Object.keys(out).length})`); }
  }
  fs.writeFileSync(file, JSON.stringify(out));
  console.error(`Done: ${Object.keys(out).length} city crime profiles → ${path.relative(process.cwd(), file)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
