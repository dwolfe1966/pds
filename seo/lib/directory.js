// DB-FREE data for the state-first directory surface (/people, /people/[state],
// /people/[state]/[name]). Kept separate from lib/data.js on purpose: these pages
// only need the public-domain JSON slices, so importing them here means the routes
// never pull in db.mjs / @neondatabase. (That import is also what triggers the Next
// dev "Cannot find module './vendor-chunks/@neondatabase.js'" flake.)

import NAME_SLICE from '../data/name-slice.json';
import STATE_SLICE from '../data/state-slice.json';

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

export function getStateList() {
  return Object.values(STATE_SLICE.states).sort((a, b) => b.pop - a.pop);
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

// Re-exported so the sitemap (in data.js) can iterate the slices without importing
// the JSON a second time.
export { NAME_SLICE, STATE_SLICE };
