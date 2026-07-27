// Enrich an abandoned-checkout target with the SAME teaser data our funnels show, so the recovery email
// leans hard into data (owner 2026-07-27: the more data, the higher the conversion). Self-gating: any lookup
// that returns nothing/errors just drops out — the email shows whatever we DO have. Never throws.
//   • Locations — FREE, already on the row (multi-city, ';'-joined).
//   • Booking/court — FIRST-PARTY (reliable), via rosterByNameState.
//   • Marriage/divorce — Enformion (cached; may be 0 if keys unset in prod).
import { rosterByNameState } from './incarceration.mjs';
import { findLifeEvents } from './lifeEvents.mjs';

const titleCase = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function parseLocations(loc) {
  const parts = String(loc || '').split(';').map((s) => s.trim()).filter(Boolean);
  const cities = [];
  let state = null;
  for (const p of parts) {
    const m = p.match(/^(.*?),\s*([A-Za-z]{2})$/);
    if (m) { cities.push(titleCase(m[1])); if (!state) state = m[2].toUpperCase(); }
    else if (p) cities.push(titleCase(p.replace(/,\s*[A-Za-z]{2}$/, '')));
  }
  const uniq = [...new Set(cities.filter(Boolean))];
  return { cities: uniq, cityCount: uniq.length, state };
}

function nameParts(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: p[0] || '', lastName: p.length > 1 ? p[p.length - 1] : '' };
}

/** @returns {Promise<{cities:string[],cityCount:number,state:string|null,bookingCount:number,courtCount:number,charges:string[],marriageCount:number,divorceCount:number}>} */
export async function enrichAbandonTarget(target) {
  const loc = parseLocations(target && target.location);
  const { firstName, lastName } = nameParts(target && target.name);
  const out = { cities: loc.cities, cityCount: loc.cityCount, state: loc.state, bookingCount: 0, courtCount: 0, charges: [], marriageCount: 0, divorceCount: 0 };
  if (!lastName || !loc.state) return out;

  try {
    const bookings = await rosterByNameState({ state: loc.state, firstName, lastName, limit: 12 }).catch(() => []);
    const list = bookings || [];
    out.bookingCount = list.filter((r) => r.recordType !== 'court').length;
    out.courtCount = list.filter((r) => r.recordType === 'court').length;
    out.charges = [...new Set(list.flatMap((r) => r.charges || []).filter(Boolean))].slice(0, 3);
  } catch { /* skip */ }

  try {
    const le = await findLifeEvents({ firstName, lastName, state: loc.state }).catch(() => ({ records: [] }));
    const recs = (le && le.records) || [];
    out.marriageCount = recs.filter((r) => r.recordType === 'marriage').length;
    out.divorceCount = recs.filter((r) => r.recordType === 'divorce').length;
  } catch { /* skip */ }

  return out;
}
