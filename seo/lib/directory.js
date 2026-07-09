// DB-FREE data for the state-first directory surface (/people, /people/[state],
// /people/[state]/[name]). Kept separate from lib/data.js on purpose: these pages
// only need the public-domain JSON slices, so importing them here means the routes
// never pull in db.mjs / @neondatabase. (That import is also what triggers the Next
// dev "Cannot find module './vendor-chunks/@neondatabase.js'" flake.)

import NAME_SLICE from '../data/name-slice.json';
import STATE_SLICE from '../data/state-slice.json';

const ROUND = (n) => Math.max(1, Math.round(n));

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
    out.push({ slug, name: `${nm.first} ${nm.last}`, estInState: ROUND(nm.estPeople * st.share) });
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
  return { ...nm, state: st.code, stateName: st.name, estInState: ROUND(nm.estPeople * st.share) };
}

// Re-exported so the sitemap (in data.js) can iterate the slices without importing
// the JSON a second time.
export { NAME_SLICE, STATE_SLICE };
