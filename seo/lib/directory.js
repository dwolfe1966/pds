// DB-FREE data for the state-first directory surface (/people, /people/[state],
// /people/[state]/[name]). Kept separate from lib/data.js on purpose: these pages
// only need the public-domain JSON slices, so importing them here means the routes
// never pull in db.mjs / @neondatabase. (That import is also what triggers the Next
// dev "Cannot find module './vendor-chunks/@neondatabase.js'" flake.)

import NAME_SLICE from '../data/name-slice.json';
import STATE_SLICE from '../data/state-slice.json';
import { statePath, cityPath, cityNamePath } from './ids';

const ROUND = (n) => Math.max(1, Math.round(n));

// ⚠️ OLD CALIBRATION INVALIDATED 2026-07-13. The prior ceiling ("IDI refuses once a
// name has >~1,000 people in the state") was measured while our IDI account was BLOCKED
// for non-payment — so common names thin-matched for an EXTERNAL reason, and the whole
// gate optimized against bad data. Live re-test after the block lifted inverts it:
//   Michael Smith / CA  estInState 4,938 → 30+ results (WORKS)
//   James Johnson / NY   1,288 → WORKS      Robert Williams / FL   904 → WORKS
//   Maria Garcia / TX      758 → TooManyMatches  (name-specific; NOT predicted by estInState)
// So: (1) common names now resolve richly — the low ceiling would DROP the winners
// (Michael Smith 4,938) and KEEP a loser (Maria Garcia 758); (2) estInState no longer
// predicts TM. New strategy (owner 2026-07-13): FOCUS the directory on COMMON names
// (high match presumption) and drop the invalid low ceiling. The numbers below are a
// STARTING band — RE-CALIBRATE with a fresh headed sweep now that the account is live.
export const EST_IN_STATE_MIN = 5;         // still skip "~1 in Wyoming" thin/404 pages
export const EST_IN_STATE_MAX = 10000;     // was 1,000 (block-polluted). Raised to keep the
                                           // common names that now resolve (Michael Smith/CA 4,938).
export const EST_IN_STATE_COMMON_MIN = 200; // city-page focus: only genuinely common names
                                           // (rich name+state teaser results). STARTING value — tune.

// States with real first-party incarceration roster coverage — the only ones whose name-in-state pages
// carry combo-unique content and so belong in the sitemap (Step 2, SEO recovery). Measured 2026-07-20:
// FL 670k rows (fl_inmates) + NC 448k, IL/PA ~1k each (inmates). Everything else is sparse → those
// name-in-state pages serve robots:noindex (see name-in-state.js) and are omitted here. GROW this set
// as more state rosters are bulk-ingested — pages auto-flip to indexable when their roster fills in.
export const ROSTER_STATES = new Set(['fl', 'nc', 'il', 'pa']);

// Population base (sum of state pops) for the per-place share.
const POP_BASE = Object.values(STATE_SLICE.states).reduce((a, s) => a + s.pop, 0);
const estInCityOf = (est, cityPop) => Math.max(1, Math.round(est * (cityPop / POP_BASE)));

// The (state, city, name) page gate — REWRITTEN 2026-07-13 (owner: focus on common names).
// The teaser search STRIPS city → runs on name+STATE, so what actually resolves is the
// STATE-grain volume. So a name earns a city page when it is COMMON in the state (rich
// name+state teaser results) AND plausibly present in the city (a light presence floor).
// The old estInCity band favored RARE-in-city names on the premise that BC would forward
// city to IDI — verified 2026-07-13 that it does NOT narrow reliably — so it selected thin
// pages. estInCity is now just a presence floor, not the selector.
export const EST_IN_CITY_MIN = 2; // presence floor: name genuinely appears in the city (drops
                                  // tiny-town near-duplicate pages; ~335k pages / 1,509 cities)
const cityNameOk = (est, cityPop, stateShare) => {
  const estInState = ROUND(est * stateShare);
  const estInCity = estInCityOf(est, cityPop);
  return estInState >= EST_IN_STATE_COMMON_MIN && estInState <= EST_IN_STATE_MAX
    && estInCity >= EST_IN_CITY_MIN;
};

export function getStateList() {
  return Object.values(STATE_SLICE.states).sort((a, b) => b.pop - a.pop);
}

export function getStateCities(code) {
  const st = getStateSlice(code);
  return st ? st.cities : [];
}

// Nearest cities (great-circle miles) among the state's slice cities — for the
// "nearby cities" module. Uses the lat/lng we already carry; no geo data needed.
const haversineMi = (a, b) => {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};
export function getNearbyCities(code, citySlug, limit = 6) {
  const st = getStateSlice(code);
  if (!st) return [];
  const here = st.cities.find((c) => c.slug === citySlug);
  if (!here || here.lat == null) return [];
  return st.cities
    .filter((c) => c.slug !== citySlug && c.lat != null)
    .map((c) => ({ city: c.city, slug: c.slug, miles: haversineMi(here, c) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit);
}

export function getCitySlice(code, citySlug) {
  const st = getStateSlice(code);
  if (!st) return null;
  const city = st.cities.find((c) => c.slug === citySlug);
  if (!city) return null;
  return { ...city, stateCode: st.code, stateName: st.name, stateShare: st.share };
}

// One name in one city — name stats + in-city estimate. null (→404) when the name
// can't resolve at state level or is too sparse in the city.
export function getNameInCity(code, citySlug, nameSlug) {
  const st = getStateSlice(code);
  const nm = NAME_SLICE[nameSlug];
  if (!st || !nm) return null;
  const city = st.cities.find((c) => c.slug === citySlug);
  if (!city) return null;
  if (!cityNameOk(nm.estPeople, city.pop, st.share)) return null;
  const estInCity = estInCityOf(nm.estPeople, city.pop);
  return {
    ...nm,
    state: st.code, stateName: st.name,
    city: city.city, citySlug: city.slug,
    estInState: ROUND(nm.estPeople * st.share), estInCity,
  };
}

// Top names in a city (resolvable + present enough), for the city landing.
export function getCityTopNames(code, citySlug, limit = 60) {
  const st = getStateSlice(code);
  if (!st) return [];
  const city = st.cities.find((c) => c.slug === citySlug);
  if (!city) return [];
  const out = [];
  for (const slug of STATE_SLICE.topNames) {
    const nm = NAME_SLICE[slug];
    if (!nm) continue;
    if (!cityNameOk(nm.estPeople, city.pop, st.share)) continue;
    const estInCity = estInCityOf(nm.estPeople, city.pop);
    out.push({ slug, name: `${nm.first} ${nm.last}`, estInCity });
    if (out.length >= limit) break;
  }
  return out;
}

export function getStateSlice(code) {
  return STATE_SLICE.states[String(code || '').toLowerCase()] || null;
}

// Top names in a state (shared population order) with an in-state estimate.
export function getStateTopNames(code, limit = 60) {
  const st = getStateSlice(code);
  if (!st) return [];
  const out = [];
  for (const slug of STATE_SLICE.topNames) {
    const nm = NAME_SLICE[slug];
    if (!nm) continue;
    const est = ROUND(nm.estPeople * st.share);
    if (est < EST_IN_STATE_MIN || est > EST_IN_STATE_MAX) continue; // skip names that would thin-match
    out.push({ slug, name: `${nm.first} ${nm.last}`, estInState: est });
    if (out.length >= limit) break;
  }
  return out;
}

// One name in one state — name stats × state population share. null when either
// side is missing from the slice (route 404s).
export function getNameInState(code, slug) {
  const st = getStateSlice(code);
  const nm = NAME_SLICE[slug];
  if (!st || !nm) return null;
  const estInState = ROUND(nm.estPeople * st.share);
  // Prune (404) name×state pages that would dead-end into a thin-match — too common
  // for IDI's teaser (over the ceiling) or too rare (under the floor).
  if (estInState < EST_IN_STATE_MIN || estInState > EST_IN_STATE_MAX) return null;
  return { ...nm, state: st.code, stateName: st.name, estInState };
}

// Every viable directory URL (state → city → name-in-city), computed once and
// memoized — the sitemap chunks this. ~866k under the estInCity∈[2,750) gate, so
// this iterates once per server instance. City landings are emitted only when
// they have ≥1 viable name.
let _taxonomyUrls;
export function getTaxonomyUrls() {
  if (_taxonomyUrls) return _taxonomyUrls;
  const urls = ['/people'];
  for (const st of Object.values(STATE_SLICE.states)) {
    urls.push(statePath(st.code));
    for (const c of st.cities) {
      let cityAdded = false;
      for (const slug of STATE_SLICE.topNames) {
        const nm = NAME_SLICE[slug];
        if (!nm || !cityNameOk(nm.estPeople, c.pop, st.share)) continue;
        if (!cityAdded) { urls.push(cityPath(st.code, c.slug)); cityAdded = true; }
        urls.push(cityNamePath(st.code, c.slug, slug));
      }
    }
  }
  _taxonomyUrls = urls;
  return urls;
}

// Canonical DIRECTORY sitemap set (SEO recovery 2026-07-18). The full taxonomy is ~335k name-in-city
// pages — the thin-page volume that tanked the domain on 7/13 and that Google has already declined
// ("discovered – not indexed"). So we DON'T re-dump it. We submit a population-prioritized QUALITY core:
// every state + every city (real ACS content) + the top `maxNamePages` name-in-city pages (biggest cities
// first). Stays under Google's 50k-URL/urlset limit and re-crawls the pages that can actually rank,
// without re-flooding a recovering young domain. cityNameOk still gates each name page to content-bearing.
export function getDirectoryUrls({ maxNamePages = 45000, includeNameStates = true } = {}) {
  const states = getStateList(); // population desc
  const core = ['/people'];
  const cityRefs = [];
  for (const st of states) {
    core.push(statePath(st.code));
    for (const c of st.cities) cityRefs.push({ st, c });
  }
  cityRefs.sort((a, b) => (b.c.pop || 0) - (a.c.pop || 0)); // biggest cities first
  const cityUrls = [];
  const nameUrls = [];
  const nameStateUrls = [];
  let capped = 0;
  // Name-in-state pages (/people/{state}/{name}) carry the first-party incarceration differentiation
  // (NameInStateView). They MUST be in the sitemap or Googlebot never discovers our one genuinely
  // unique, non-boilerplate page type. Step 2 (SEO recovery): only EMIT the states with real roster
  // coverage — elsewhere the page is boilerplate and now serves robots:noindex (page-level, in
  // name-in-state.js), so listing it here would just mix a noindex URL into the sitemap. Grow this set
  // as more state rosters are bulk-ingested (fl_inmates=FL deep, inmates=NC deep + IL/PA light).
  if (includeNameStates) {
    for (const st of states) {
      if (!ROSTER_STATES.has(st.code.toLowerCase())) continue;
      for (const n of getStateTopNames(st.code, 100)) {
        nameStateUrls.push(`/people/${st.code.toLowerCase()}/${n.slug}`);
      }
    }
  }
  for (const { st, c } of cityRefs) {
    let cityAdded = false;
    for (const slug of STATE_SLICE.topNames) {
      const nm = NAME_SLICE[slug];
      if (!nm || !cityNameOk(nm.estPeople, c.pop, st.share)) continue;
      if (!cityAdded) { cityUrls.push(cityPath(st.code, c.slug)); cityAdded = true; }
      if (nameUrls.length < maxNamePages) nameUrls.push(cityNamePath(st.code, c.slug, slug));
      else capped++;
    }
  }
  return { all: [...core, ...cityUrls, ...nameStateUrls, ...nameUrls], counts: { core: core.length, cities: cityUrls.length, nameStates: nameStateUrls.length, names: nameUrls.length, droppedNames: capped } };
}

// Re-exported so the sitemap (in data.js) can iterate the slices without importing
// the JSON a second time.
export { NAME_SLICE, STATE_SLICE };
