// HomeFacts search resolver — turns a ZIP or a street address into an area-profile URL. Keyless:
//  - bare ZIP  → Zippopotam (zip → lat/lng + place/state)
//  - address   → U.S. Census geocoder (onelineaddress → lat/lng + place/state)
// Then map the point to the best CURRENT profile: an exact covered-city match if the resolved place is one of
// our cities, else the NEAREST covered city (haversine), honestly labeled so a suburb ZIP never silently renders
// a different city's data as its own. (City-name queries are handled client-side by the typeahead.)
//
// This is the input layer for all four area-profile grains (city, county, ZIP, address). Real ZIP/county DATA
// pages come once CENSUS_API_KEY is in the env; today ZIP/address resolve to the covering city profile.
import STATE_SLICE from '../../../../data/state-slice.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const R = 3958.8; // mi
const rad = (d) => (d * Math.PI) / 180;
function miles(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Nearest covered city to a point (optionally biased to a state).
function nearestCity(lat, lng, stateLc) {
  let best = null;
  const states = stateLc && STATE_SLICE.states[stateLc] ? [stateLc] : Object.keys(STATE_SLICE.states);
  for (const lc of states) {
    for (const c of STATE_SLICE.states[lc].cities) {
      if (c.lat == null || c.lng == null) continue;
      const d = miles(lat, lng, c.lat, c.lng);
      if (!best || d < best.d) best = { d, lc, city: c.city, slug: c.slug };
    }
  }
  return best;
}
// Exact covered-city match by state + slug (the point's own town, when we cover it).
function coveredCity(stateLc, placeName) {
  const st = STATE_SLICE.states[stateLc];
  if (!st) return null;
  const want = slugify(placeName);
  const hit = st.cities.find((c) => c.slug === want);
  return hit ? { lc: stateLc, city: hit.city, slug: hit.slug } : null;
}

async function fromAddress(q) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) return null;
  const d = await r.json();
  const m = d.result && d.result.addressMatches && d.result.addressMatches[0];
  if (!m) return null;
  const c = m.coordinates, comp = m.addressComponents || {};
  return { lat: c.y, lng: c.x, place: comp.city, stateLc: String(comp.state || '').toLowerCase(), what: m.matchedAddress || q };
}

export async function GET(request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (!q) return Response.json({ error: 'empty query' }, { status: 400 });

  // Bare ZIP → the real ZIP area-profile page (ZCTA-grain).
  if (/^\d{5}$/.test(q)) return Response.json({ url: `/homefacts/zip/${q}`, label: `ZIP ${q}`, exact: true });

  // Street address → geocode → containing/nearest covered city profile (addresses aren't their own pages).
  let point = null;
  if (/\d/.test(q) && /\s/.test(q)) point = await fromAddress(q).catch(() => null);
  else return Response.json({ error: 'use a ZIP or a street address (city names use the list above)' }, { status: 422 });

  if (!point) return Response.json({ error: `couldn't locate “${q}”` }, { status: 404 });

  // Prefer the point's own town if we cover it; else nearest covered city (labeled).
  const exact = point.place ? coveredCity(point.stateLc, point.place) : null;
  const target = exact || nearestCity(point.lat, point.lng, point.stateLc) || nearestCity(point.lat, point.lng);
  if (!target) return Response.json({ error: 'no covered area found' }, { status: 404 });

  const url = `/homefacts/${target.lc}/${target.slug}?from=${encodeURIComponent(point.what)}`;
  const label = exact
    ? `${target.city}, ${target.lc.toUpperCase()}`
    : `${target.city}, ${target.lc.toUpperCase()} — the nearest area we cover for ${point.what}`;
  return Response.json({ url, label, exact: !!exact });
}
