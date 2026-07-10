// DB-FREE data for the state-first directory surface (/people, /people/[state],
// /people/[state]/[name]). Kept separate from lib/data.js on purpose: these pages
// only need the public-domain JSON slices, so importing them here means the routes
// never pull in db.mjs / @neondatabase. (That import is also what triggers the Next
// dev "Cannot find module './vendor-chunks/@neondatabase.js'" flake.)

import NAME_SLICE from '../data/name-slice.json';
import STATE_SLICE from '../data/state-slice.json';
import { statePath, cityPath, cityNamePath } from './ids';

const ROUND = (n) => Math.max(1, Math.round(n));

// IDI's name teaser REFUSES (status:failed, 0 results) once a name has roughly more
// than ~1,000 people in the searched state. Calibrated on live tests, in this file's
// estInState units (name-slice est × state-slice share): Patricia Garcia / CA (807)
// returns records; David Thomas / CA (1,237) and everything above thin-matched
// (Michael Thomas 1,529, William Jones 1,857, Robert Brown 2,306, John Smith / CA
// 4,439 — all thin). So a name×state page above this ceiling would dead-end. We prune
// those (keep the ≥5 floor to skip "~1 in Wyoming" thin pages). Per-state, so
// "John Smith / WY" (55) survives while "John Smith / CA" (4,439) is dropped.
// Heuristic — revisit if BC returns a capped sample (then the ceiling can lift).
export const EST_IN_STATE_MIN = 5;
export const EST_IN_STATE_MAX = 1000;

// Population base (sum of state pops) for the per-place share.
const POP_BASE = Object.values(STATE_SLICE.states).reduce((a, s) => a + s.pop, 0);
const estInCityOf = (est, cityPop) => Math.max(1, Math.round(est * (cityPop / POP_BASE)));

// The (state, city, name) page gate. We build a name-in-city page only when the
// name's ESTIMATED in-city population lands in this band:
//   floor  — skip "~1 person in this town" thin/404 pages.
//   ceiling — the pivot (owner 2026-07-10): a name is treated as resolvable at the
//   CITY grain when its in-city volume is low, REGARDLESS of how common it is
//   statewide. Replaces the old state-level ceiling (nameStateOk). So "John Smith"
//   now earns pages in small cities (low in-city volume) but not in LA/NYC (over
//   the ceiling) — the long-tail IDI is most likely to resolve.
// NOTE: until BC forwards city to IDI, a common-name-in-small-city SERP still
// teasers on name+state and may thin; ThinMatchPreview covers that, and the page
// self-heals the moment city-forwarding ships.
export const EST_IN_CITY_MIN = 2;
export const EST_IN_CITY_MAX = 750;
const cityNameOk = (est, cityPop) => {
  const eic = estInCityOf(est, cityPop);
  return eic >= EST_IN_CITY_MIN && eic < EST_IN_CITY_MAX;
};

export function getStateList() {
  return Object.values(STATE_SLICE.states).sort((a, b) => b.pop - a.pop);
}

export function getStateCities(code) {
  const st = getStateSlice(code);
  return st ? st.cities : [];
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
  const estInCity = estInCityOf(nm.estPeople, city.pop);
  if (estInCity < EST_IN_CITY_MIN || estInCity >= EST_IN_CITY_MAX) return null;
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
    const estInCity = estInCityOf(nm.estPeople, city.pop);
    if (estInCity < EST_IN_CITY_MIN || estInCity >= EST_IN_CITY_MAX) continue;
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
        if (!nm || !cityNameOk(nm.estPeople, c.pop)) continue;
        if (!cityAdded) { urls.push(cityPath(st.code, c.slug)); cityAdded = true; }
        urls.push(cityNamePath(st.code, c.slug, slug));
      }
    }
  }
  _taxonomyUrls = urls;
  return urls;
}

// Re-exported so the sitemap (in data.js) can iterate the slices without importing
// the JSON a second time.
export { NAME_SLICE, STATE_SLICE };
