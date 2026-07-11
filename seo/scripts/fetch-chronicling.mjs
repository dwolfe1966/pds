// Historic newspapers per city from the Library of Congress "Chronicling America"
// title directory (public domain — pre-1963 papers, no API key). BULK approach: the
// titles collection (~4,600 papers) paginates in a handful of pulls, so we group by
// (state, city) once instead of querying 2,000 cities. Writes seo/data/city-
// newspapers.json ("ST/slug" → [{ name, years }]) for cities in our slice.
//
// Run: node scripts/fetch-chronicling.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const UA = 'idlookup-seo/1.0 (https://idlookup.me; davidw@peopledatasystems.ai)';
const BASE = 'https://www.loc.gov/collections/chronicling-america/titles/';

const norm = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/,.*/, '').replace(/\([^)]*\)/g, ' ')
  .replace(/\b(city|town|village|borough|cdp|municipality|metropolitan government|urban county|balance)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "The Abbeville Banner (Abbeville, S.C.) 1847-1869" → { name, years }
function parseTitle(t) {
  const name = t.replace(/\s*\([^)]*\)\s*[\d?].*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim() || t;
  const tail = t.split(')').pop().trim();
  const ym = tail.match(/[\d?]{3,4}\s*-\s*(?:[\d?]{3,4}|current|ongoing)?/i);
  const years = ym ? ym[0].replace(/\s+/g, '') : null;
  const start = (t.match(/([\d]{4})\s*-/) || [])[1];
  return { name, years, start: start ? Number(start) : 9999 };
}

(async () => {
  const slice = JSON.parse(fs.readFileSync(path.join(DATA, 'state-slice.json'), 'utf8'));
  const stateName2Code = {};
  const validKeys = new Set();
  for (const st of Object.values(slice.states)) {
    stateName2Code[(st.code === 'DC' ? 'district of columbia' : st.name).toLowerCase()] = st.code;
    for (const c of st.cities) validKeys.add(`${st.code}/${c.slug}`);
  }

  const byKey = new Map();
  let sp = 1, total = 0, seenTitles = 0;
  for (; sp <= 20; sp++) {
    const res = await fetch(`${BASE}?fo=json&c=1000&sp=${sp}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) { console.error(`page ${sp}: HTTP ${res.status}`); break; }
    const d = await res.json();
    const arr = (d.content && d.content.results) || d.results || [];
    if (!arr.length) break;
    total = (d.pagination && d.pagination.of) || total;
    for (const r of arr) {
      seenTitles++;
      const stateVal = r.location_state && (r.location_state.value || r.location_state.label);
      const code = stateVal ? stateName2Code[String(stateVal).toLowerCase()] : null;
      const cityRaw = Array.isArray(r.location_city) ? r.location_city[0] : r.location_city;
      if (!code || !cityRaw || !r.title) continue;
      const key = `${code}/${norm(cityRaw)}`;
      if (!validKeys.has(key)) continue;
      const p = parseTitle(r.title);
      if (!p.name) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(p);
    }
    console.log(`page ${sp}: +${arr.length} (matched cities so far: ${byKey.size})`);
    if (arr.length < 1000) break;
    await sleep(600);
  }

  const out = {};
  for (const [key, list] of byKey) {
    // de-dupe by name, oldest first, keep 8
    const seen = new Set();
    const uniq = list.sort((a, b) => a.start - b.start).filter((p) => (seen.has(p.name) ? false : seen.add(p.name)));
    out[key] = uniq.slice(0, 8).map((p) => ({ name: p.name, years: p.years }));
  }
  fs.writeFileSync(path.join(DATA, 'city-newspapers.json'), JSON.stringify(out));
  console.log(`\n✅ scanned ${seenTitles} titles (of ~${total}); ${Object.keys(out).length} of our cities have historic newspapers. Wrote data/city-newspapers.json`);
})();
