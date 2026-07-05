#!/usr/bin/env node
/**
 * build-location-skeleton.mjs — Layer 1 (location dimension) of the SEO people-
 * directory: every US place (city/town/CDP), population-ranked, for the
 * `/{name}/{state}/{city}/` URL structure and the first-class location hubs.
 *
 * Sources (public domain / US Government Work; static files on www2.census.gov —
 * the api.census.gov data API 302-redirects in headless envs, so we use files):
 *   - Places + geo: Census 2023 Gazetteer place file (state, GEOID, name, lat/long).
 *     https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip
 *   - Population: Census Population Estimates SUB-EST 2024 (place populations).
 *     https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv
 *   Joined on GEOID = STATE(2)+PLACE(5).
 *
 * Output (seo/data/):
 *   - places.json — {city, state, stateName, geoid, pop, lat, lng, slug}, pop-desc.
 *   - location-skeleton-stats.json — # places, states, population coverage,
 *     and the location-hub surface sizing.
 *
 * Zero npm deps. Usage: node seo/scripts/build-location-skeleton.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEO = path.resolve(HERE, '..');
const CACHE = path.join(SEO, '.cache', 'geo');
const OUT = path.join(SEO, 'data');
mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const SRC = {
  gaz: { url: 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip', file: path.join(CACHE, 'gaz_place.zip') },
  pop: { url: 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv', file: path.join(CACHE, 'sub-est2024.csv') },
};

async function download(url, dest) {
  if (existsSync(dest)) { console.log(`  cached: ${path.basename(dest)}`); return; }
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// Strip the legal/statistical type suffix Census appends to place names.
const TYPE_SUFFIX = /\s+(city|town|village|borough|municipality|CDP|comunidad|zona urbana|\(balance\)|metro(politan)? government.*|consolidated government.*|unified government.*|urban county.*)$/i;
function cleanCityName(name) {
  let n = name.replace(TYPE_SUFFIX, '').trim();
  // A couple can have two suffixes ("Athens-Clarke County unified government (balance)").
  n = n.replace(TYPE_SUFFIX, '').trim();
  return n || name.trim();
}
function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

(async () => {
  console.log('Downloading sources…');
  await download(SRC.gaz.url, SRC.gaz.file);
  await download(SRC.pop.url, SRC.pop.file);

  // ── Population by GEOID (STATE+PLACE) from SUB-EST ──────────────────────────
  console.log('Parsing population…');
  const popCsv = readFileSync(SRC.pop.file, 'latin1').split('\n');
  const header = popCsv[0].split(',');
  const iSumlev = header.indexOf('SUMLEV'), iState = header.indexOf('STATE'),
        iPlace = header.indexOf('PLACE'), iStName = header.indexOf('STNAME');
  // latest population column
  const popCols = header.map((h, i) => /^POPESTIMATE\d{4}$/.test(h) ? i : -1).filter((i) => i >= 0);
  const iPop = popCols[popCols.length - 1];
  const popByGeoid = new Map();
  const stateNames = new Map(); // USPS not here; keyed by state FIPS -> name
  for (let i = 1; i < popCsv.length; i++) {
    const c = popCsv[i].split(',');
    if (c.length <= iPop) continue;
    const sumlev = c[iSumlev];
    if (sumlev === '040') stateNames.set(c[iState], c[iStName]); // state row
    // Place-level rows: incorporated place (162), CDP (157), consolidated city (170).
    if (!['162', '157', '170'].includes(sumlev)) continue;
    const place = c[iPlace];
    if (!place || place === '00000') continue;
    const geoid = c[iState] + place; // 2+5 = 7-digit GEOID
    const pop = parseInt(c[iPop], 10);
    // Same GEOID can appear as the whole incorporated place (162) AND as CDP
    // "(pt.)" borough splits (157) — keep the MAX so the whole-place total wins
    // (e.g. NYC 8.26M beats its 0.5M borough parts). Prevents part-rows clobbering.
    if (Number.isFinite(pop) && pop > (popByGeoid.get(geoid) ?? -1)) popByGeoid.set(geoid, pop);
  }

  // ── Gazetteer places, joined to population ─────────────────────────────────
  console.log('Parsing gazetteer + joining…');
  const dir = path.join(CACHE, 'gaz');
  mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', SRC.gaz.file, '-d', dir]);
  const gaz = readFileSync(path.join(dir, '2023_Gaz_place_national.txt'), 'utf8').split('\n');
  const gh = gaz[0].split('\t').map((s) => s.trim());
  const gi = (name) => gh.indexOf(name);
  const [iUsps, iGeoid, iName, iLat, iLng] = [gi('USPS'), gi('GEOID'), gi('NAME'), gi('INTPTLAT'), gi('INTPTLONG')];

  const places = [];
  for (let i = 1; i < gaz.length; i++) {
    const c = gaz[i].split('\t');
    if (c.length <= iLng) continue;
    const state = (c[iUsps] || '').trim();
    const geoid = (c[iGeoid] || '').trim();
    const rawName = (c[iName] || '').trim();
    if (!state || !geoid || !rawName) continue;
    const city = cleanCityName(rawName);
    const pop = popByGeoid.get(geoid) ?? null;
    places.push({
      city,
      state,
      stateName: stateNames.get(geoid.slice(0, 2)) || null,
      geoid,
      pop,
      lat: parseFloat(c[iLat]),
      lng: parseFloat(c[iLng]),
      slug: `${slugify(city)}/${state.toLowerCase()}`,
    });
  }
  // Population-desc (null pop last), then name.
  places.sort((a, b) => (b.pop ?? -1) - (a.pop ?? -1) || a.city.localeCompare(b.city));
  writeFileSync(path.join(OUT, 'places.json'), JSON.stringify(places));

  // ── Sizing ─────────────────────────────────────────────────────────────────
  const withPop = places.filter((p) => p.pop != null);
  const totalPop = withPop.reduce((s, p) => s + p.pop, 0);
  const byThreshold = (t) => withPop.filter((p) => p.pop >= t).length;
  const states = new Set(places.map((p) => p.state));
  const stats = {
    generatedNote: 'US location skeleton — Census 2023 Gazetteer joined to SUB-EST 2024 population.',
    totalPlaces: places.length,
    placesWithPopulation: withPop.length,
    states: states.size,
    totalPopulationCovered: totalPop,
    placesOver: {
      '100k': byThreshold(100000), '50k': byThreshold(50000), '25k': byThreshold(25000),
      '10k': byThreshold(10000), '5k': byThreshold(5000), '1k': byThreshold(1000),
    },
    top10: withPop.slice(0, 10).map((p) => `${p.city}, ${p.state} (${p.pop.toLocaleString()})`),
    note_nameLocationSurface: 'Name×location hub pages (/name/state/city) are derived from BC/IDI at mint time (where a name\'s people actually live) — not pre-computed from Census. Location-only hubs (decision #6) = one per place = totalPlaces.',
  };
  writeFileSync(path.join(OUT, 'location-skeleton-stats.json'), JSON.stringify(stats, null, 2));

  console.log('\n── Location sizing ─────────────────────────────');
  console.log(`  total places:            ${stats.totalPlaces.toLocaleString()}`);
  console.log(`  with population:         ${stats.placesWithPopulation.toLocaleString()}  across ${stats.states} states`);
  console.log(`  population covered:      ${stats.totalPopulationCovered.toLocaleString()}`);
  console.log(`  places >=100k / >=25k / >=10k / >=1k:  ${stats.placesOver['100k'].toLocaleString()} / ${stats.placesOver['25k'].toLocaleString()} / ${stats.placesOver['10k'].toLocaleString()} / ${stats.placesOver['1k'].toLocaleString()}`);
  console.log(`  top: ${stats.top10.slice(0, 3).join(' · ')}`);
  console.log('  outputs -> seo/data/{places.json,location-skeleton-stats.json}');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
