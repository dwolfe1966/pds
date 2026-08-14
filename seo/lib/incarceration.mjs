// Incarceration / booking data layer — first-party, on the idlookup.me Vercel server (the proven
// pattern), independent of BC. Provider-abstracted so we can add/swap sources without touching callers.
// Powers the inmate (/name/landing/v3) experience with mugshots, charges, facility, and booking dates.
//
// ⚠️ POC status (2026-07-17): field shapes for JailBase are from published docs; UCC is env-configured
// and its exact response must be finalized in the trial. LICENSING: only display UCC data once consumer-
// display permission is confirmed IN WRITING (owner is securing it). JailBase is a public scraper-
// aggregate — patchy coverage, non-authoritative; it may also rate-limit/block datacenter IPs, so a
// residential proxy or their paid/RapidAPI tier may be needed for reliable server-side calls.

import { neon } from '@neondatabase/serverless';
import { findStateInmates, STATE_ADAPTERS } from './stateInmates.mjs';
import { queryInmates, upsertInmates, hasInmatesDb } from './inmatesDb.mjs';
import { suppressPublicRecords } from './search-activity-db.mjs';

const num = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isNaN(n) ? null : n; };
const clean = (s) => (s == null ? '' : String(s).trim());
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Florida OBIS lives in our own Neon (ingested via scripts/ingest-florida-obis.mjs) — free, reliable,
// no external key. Queried directly.
const FL_URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const flSql = FL_URL ? neon(FL_URL) : null;

// FL DOC public offender photo — sharded by the FIRST char of the DC number (verified). Not every
// inmate has one (released/offenders often don't); the client <img> falls back to a placeholder on error.
const flPhoto = (dc) => { const s = String(dc || '').trim(); return s ? `https://pubapps.fdc.myflorida.com/inmatephotos/${s[0]}/${s}.jpg` : null; };

async function floridaObis(query) {
  if (!flSql || !query.lastName) return [];
  const ln = norm(query.lastName); const fn = norm(query.firstName);
  const cty = query.county ? String(query.county).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null;
  const lim = query.limit || 20;
  // county-scoped (name-in-county page) vs name-only (name-in-state). county_norm was backfilled from the
  // OBIS charge-text county; slugify it the same way as the URL key to match.
  let rows;
  if (cty) {
    rows = fn
      ? await flSql`SELECT * FROM fl_inmates WHERE last_norm=${ln} AND first_norm=${fn} AND regexp_replace(coalesce(county_norm,''),${'[^a-z0-9]+'},${'-'},${'g'})=${cty} LIMIT ${lim}`
      : await flSql`SELECT * FROM fl_inmates WHERE last_norm=${ln} AND regexp_replace(coalesce(county_norm,''),${'[^a-z0-9]+'},${'-'},${'g'})=${cty} LIMIT ${lim}`;
  } else {
    rows = fn
      ? await flSql`SELECT * FROM fl_inmates WHERE last_norm=${ln} AND first_norm=${fn} LIMIT ${lim}`
      : await flSql`SELECT * FROM fl_inmates WHERE last_norm=${ln} LIMIT ${lim}`;
  }
  return rows.map((r) => {
    let age = null;
    const y = String(r.birth_date || '').match(/(19|20)\d\d/);
    if (y) age = new Date().getUTCFullYear() - Number(y[0]);
    return {
      source: 'florida-obis', sourceName: 'FL DOC',
      firstName: clean(r.first_name), lastName: clean(r.last_name),
      name: [r.first_name, r.last_name].map(clean).filter(Boolean).join(' '),
      age, gender: clean(r.sex) || null, race: clean(r.race) || null,
      charges: Array.isArray(r.offenses) ? r.offenses.map(clean).filter(Boolean) : [],
      mugshotUrl: flPhoto(r.dc_number), bookingDate: null, releaseStatus: clean(r.custody_status) || null,
      facility: clean(r.facility) || null, county: clean(r.county) || null, state: 'FL',
    };
  });
}

/**
 * DB-ONLY roster lookup for a name+state — for SEO pages (ISR-safe: reads our own Neon, no live scraping).
 * Combines fl_inmates (Florida, via floridaObis) + the general `inmates` roster (queryInmates), deduped.
 * Returns the standard normalized booking-record shape. Empty where we have no coverage (self-gating).
 */
const titleCase = (s) => String(s || '').split(/[-\s]+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' ').trim();
// Counties keep their internal punctuation (Miami-Dade, St. Lucie, Palm Beach) — capitalize each word in place.
const countyTitle = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());

/** Top names (ranked by record count) that ACTUALLY have incarceration records in a state, from our own
 *  roster. Powers the state-hub "Incarceration & inmate records in {state}" section. DATA-DRIVEN, not the
 *  Census name slice — so (a) it self-gates to empty where a state has no coverage, and (b) every name it
 *  lists links to a name-in-state page that carries real records → indexable (Step 2). This fixes the CA
 *  bug where getStateTopNames applied the consumer-search est cap (EST_IN_STATE_MAX) and excluded exactly
 *  the common names that have the most records. FL reads fl_inmates; all states read the `inmates` table. */
export async function rosterTopNamesByState({ state, limit = 30 }) {
  const st = String(state || '').toUpperCase();
  if (!flSql || !st) return [];
  const NAME_RE = '^[a-z]+$';                          // single alpha token → forms a valid name slug
  const SUFFIX = ['jr', 'sr', 'ii', 'iii', 'iv', 'v']; // drop suffix-as-surname junk (e.g. "smith jr")
  const lim = limit * 2;
  const [flRows, genRows] = await Promise.all([
    st === 'FL'
      ? flSql`SELECT first_norm, last_norm, count(*)::int n FROM fl_inmates
              WHERE first_norm ~ ${NAME_RE} AND last_norm ~ ${NAME_RE} AND last_norm <> ALL(${SUFFIX})
              GROUP BY first_norm, last_norm ORDER BY n DESC LIMIT ${lim}`.catch(() => [])
      : Promise.resolve([]),
    // removed = FALSE mirrors queryInmates (the name-in-state page's own index predicate) so this
    // top-names set aligns with which pages actually render index — a name whose only records are
    // removed shows 0 on the page (→ noindex) and must NOT be counted here (else the state-hub links
    // + the sitemap would point at a noindex page). See sitemap-directory.xml/route.js.
    flSql`SELECT first_norm, last_norm, count(*)::int n FROM inmates
           WHERE upper(state)=${st} AND removed = FALSE AND first_norm ~ ${NAME_RE} AND last_norm ~ ${NAME_RE} AND last_norm <> ALL(${SUFFIX})
           GROUP BY first_norm, last_norm ORDER BY n DESC LIMIT ${lim}`.catch(() => []),
  ]);
  const counts = new Map();
  for (const r of [...flRows, ...genRows]) {
    if (!r.first_norm || !r.last_norm) continue;
    const slug = `${r.first_norm}-${r.last_norm}`;
    counts.set(slug, (counts.get(slug) || 0) + Number(r.n || 0));
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, n]) => ({ slug, name: titleCase(slug), count: n }));
}

export async function rosterByNameState({ state, firstName, lastName, limit = 12 }) {
  if (!lastName || !state) return [];
  const st = String(state).toUpperCase();
  const [fl, gen] = await Promise.all([
    st === 'FL' ? floridaObis({ firstName, lastName }) : Promise.resolve([]),
    queryInmates({ state: st, firstName, lastName, limit }),
  ]);
  const seen = new Set();
  const out = [];
  for (const r of [...fl, ...gen]) {
    const k = `${norm(r.name)}|${r.age || ''}|${r.facility || ''}`;
    if (seen.has(k)) { continue; }
    seen.add(k);
    out.push(r);
  }
  // Identity Management "Hide me": drop records a claimed member has suppressed from OUR public directory
  // (matched name+state+age±1). Applied at the roster source so both generateMetadata (robots) and the page
  // body see the filtered set — a fully-suppressed name auto-noindexes via the existing recs.length check.
  return (await suppressPublicRecords(out, { firstName, lastName, state })).slice(0, limit);
}

// County-hub taxonomy (/people/{state}/county/{county}/...) — incarceration data's natural finest grain
// (records carry county, NOT city), so a county URL has combo-unique content with no cross-city dup.
// A URL-safe county key: "MIAMI-DADE" / "PALM BEACH" / "ST. LUCIE" → "miami-dade" / "palm-beach" / "st-lucie".
export const countySlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The county of a record: fl_inmates carries it in charge text (recordCounty extracts), the `inmates`
// table has a county column (PA/CA/GA/…).
function recordCounty(rec) {
  if (rec.county) return String(rec.county).trim();
  for (const c of rec.charges || []) {
    const m = String(c).match(/\(([A-Z][A-Z .'-]+)\)\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

/** County-scoped roster for a name (name-in-county page): the state roster filtered to one county.
 *  Combo-unique first-party content → indexable, no cross-city dup. Self-gates to [] where no match. */
export async function rosterByNameCounty({ state, county, firstName, lastName, limit = 12 }) {
  if (!county || !lastName || !state) return [];
  const st = String(state).toUpperCase();
  const [fl, gen] = await Promise.all([
    st === 'FL' ? floridaObis({ firstName, lastName, county, limit }) : Promise.resolve([]),
    queryInmates({ state: st, firstName, lastName, county, limit }),
  ]);
  const seen = new Set();
  const out = [];
  for (const r of [...fl, ...gen]) {
    const k = `${norm(r.name)}|${r.age || ''}|${r.facility || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  // Identity Management "Hide me": drop records a claimed member has suppressed from OUR public directory
  // (matched name+state+age±1). Applied at the roster source so both generateMetadata (robots) and the page
  // body see the filtered set — a fully-suppressed name auto-noindexes via the existing recs.length check.
  return (await suppressPublicRecords(out, { firstName, lastName, state })).slice(0, limit);
}

/** Counties in a state that actually have incarceration records, ranked by count (county-hub index +
 *  the "by county" links on name-in-state). FL reads fl_inmates.county_norm; others read inmates.county. */
export async function countiesByState({ state, limit = 120 }) {
  const st = String(state || '').toUpperCase();
  if (!flSql || !st) return [];
  const [fl, gen] = await Promise.all([
    st === 'FL'
      ? flSql`SELECT county_norm k, max(county) nm, count(*)::int n FROM fl_inmates
              WHERE county_norm IS NOT NULL AND county_norm ~ ${'^[a-z]'} GROUP BY county_norm ORDER BY n DESC LIMIT ${limit}`.catch(() => [])
      : Promise.resolve([]),
    flSql`SELECT lower(trim(county)) k, max(county) nm, count(*)::int n FROM inmates
           WHERE upper(state)=${st} AND county IS NOT NULL AND county <> '' GROUP BY lower(trim(county)) ORDER BY n DESC LIMIT ${limit}`.catch(() => []),
  ]);
  const m = new Map();
  for (const r of [...fl, ...gen]) {
    const slug = countySlug(r.k);
    if (!slug) continue;
    const e = m.get(slug) || { slug, name: countyTitle(r.nm || r.k), count: 0 };
    e.count += Number(r.n || 0);
    m.set(slug, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Top names (by record count) with records in a specific county — powers the county-hub name list. */
export async function rosterTopNamesByCounty({ state, county, limit = 40 }) {
  const st = String(state || '').toUpperCase();
  const slug = countySlug(county);
  if (!flSql || !st || !slug) return [];
  const NAME_RE = '^[a-z]+$';
  const SUFFIX = ['jr', 'sr', 'ii', 'iii', 'iv', 'v'];
  const [fl, gen] = await Promise.all([
    st === 'FL'
      ? flSql`SELECT first_norm, last_norm, count(*)::int n FROM fl_inmates
              WHERE regexp_replace(coalesce(county_norm,''), ${'[^a-z0-9]+'}, ${'-'}, ${'g'})=${slug}
                AND first_norm ~ ${NAME_RE} AND last_norm ~ ${NAME_RE} AND last_norm <> ALL(${SUFFIX})
              GROUP BY first_norm, last_norm ORDER BY n DESC LIMIT ${limit * 2}`.catch(() => [])
      : Promise.resolve([]),
    flSql`SELECT first_norm, last_norm, count(*)::int n FROM inmates
           WHERE upper(state)=${st} AND regexp_replace(lower(trim(coalesce(county,''))), ${'[^a-z0-9]+'}, ${'-'}, ${'g'})=${slug}
             AND first_norm ~ ${NAME_RE} AND last_norm ~ ${NAME_RE} AND last_norm <> ALL(${SUFFIX})
           GROUP BY first_norm, last_norm ORDER BY n DESC LIMIT ${limit * 2}`.catch(() => []),
  ]);
  const counts = new Map();
  for (const r of [...fl, ...gen]) {
    if (!r.first_norm || !r.last_norm) continue;
    const key = `${r.first_norm}-${r.last_norm}`;
    counts.set(key, (counts.get(key) || 0) + Number(r.n || 0));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([s, n]) => ({ slug: s, name: titleCase(s), count: n }));
}

/** All county-hub URLs for the given states — for the directory sitemap. County hubs are differentiated
 *  (one URL/county, real records), so they belong in the sitemap; name-in-county leaves are discoverable
 *  from each hub's name list. States with no county coverage (e.g. NC null county) yield nothing. */
export async function allCountyHubUrls(stateCodes) {
  const urls = [];
  for (const st of stateCodes) {
    const cs = await countiesByState({ state: st, limit: 120 });
    for (const c of cs) urls.push(`/people/${String(st).toLowerCase()}/county/${c.slug}`);
  }
  return urls;
}

/** Resolve a county slug back to its display name for a state (or null). Uses the ranked county list. */
export async function countyFromSlug(state, slug) {
  const s = countySlug(slug);
  if (!s) return null;
  const list = await countiesByState({ state, limit: 200 });
  return list.find((c) => c.slug === s) || null;
}

/**
 * Normalized booking record — the single shape every provider maps into (callers depend on THIS,
 * never a provider's raw shape).
 * @typedef {{ source:string, sourceName?:string, firstName?:string, lastName?:string, name?:string,
 *   age?:number|null, gender?:string, race?:string, charges:string[], mugshotUrl?:string|null,
 *   bookingDate?:string|null, releaseStatus?:string|null, facility?:string|null, county?:string|null,
 *   state?:string|null, details?:Array<[string,string]> }} BookingRecord
 */

// ── JailBase (free, no key; per published API: records[] with first/last/age/gender/race, booking_date,
//    source_id/source_name, state/county, charges, mugshot, details[[label,value]]). Search is BY SOURCE
//    (jail) — nationwide-by-state needs the sources list first; for the POC we pass an optional sourceId. ──
async function jailbase(query, opts) {
  // Prefer the RapidAPI host — direct jailbase.com 503s datacenter IPs (Vercel), RapidAPI is the reliable
  // path. RapidAPI wrapper uses /search/ (NOT /search_records/, which 404s there). Endpoint/params are
  // env-overridable so we can adjust once JailBase's upstream is up to confirm the live shape.
  const rapid = !!opts.jailbaseRapidKey;
  const base = (opts.jailbaseUrl || (rapid ? `https://${opts.jailbaseRapidHost}` : 'https://www.jailbase.com/api/1')).replace(/\/$/, '');
  const searchPath = opts.jailbaseSearchPath || (rapid ? '/search/' : '/search_records/');
  const p = new URLSearchParams();
  if (query.firstName) p.set('first_name', query.firstName);
  if (query.lastName) p.set('last_name', query.lastName);
  if (query.sourceId) p.set('source_id', String(query.sourceId));
  p.set('json', '1');
  const url = `${base}${searchPath}?${p.toString()}`;
  const headers = { 'User-Agent': 'idlookup/1.0', Accept: 'application/json' };
  if (rapid) { headers['x-rapidapi-host'] = opts.jailbaseRapidHost; headers['x-rapidapi-key'] = opts.jailbaseRapidKey; }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`jailbase ${res.status}`);
  const data = await res.json().catch(() => null);
  const records = (data && (data.records || (data.data && data.data.records))) || [];
  return records.map((r) => ({
    source: 'jailbase', sourceName: clean(r.source_name) || null,
    firstName: clean(r.first_name), lastName: clean(r.last_name),
    name: [r.first_name, r.last_name].map(clean).filter(Boolean).join(' ') || clean(r.name),
    age: num(r.age), gender: clean(r.gender) || null, race: clean(r.race) || null,
    charges: Array.isArray(r.charges) ? r.charges.map(clean).filter(Boolean)
      : (clean(r.charges) ? [clean(r.charges)] : []),
    mugshotUrl: clean(r.mugshot) || null,
    bookingDate: clean(r.booking_date) || null, releaseStatus: null,
    facility: clean(r.source_name) || null, county: clean(r.county) || null,
    state: (clean(r.state) || query.state || '').toUpperCase() || null,
    details: Array.isArray(r.details) ? r.details : undefined,
  }));
}

// ── UnlimitedCriminalChecks — VERIFIED spec (2026-07-18, from unlimitedcriminalchecks.com/Developers/):
//    GET {base}/search.php, auth = X-API-Key + X-API-Secret headers, query params first_name/last_name/
//    state/city/age/limit/feeds. Response: { success, results: { total, sor|doc|arrest|court: {count,
//    records[]} }, credits }. Bundles sex-offender + DOC/inmate + arrest/warrant + court + mugshots.
//    Only enabled when BOTH keys are set AND consumer-display permission is confirmed in writing.
//    Record field names beyond NAME/AGE/STATE/CITY/ADDRESS/OFFENSE aren't documented — mapped defensively
//    (multiple candidates via g()); confirm from a live sample once a key is in hand (one-spot edit). ──
const UCC_FEEDS = { sor: 'Sex Offender Registry', doc: 'Dept. of Corrections', arrest: 'Arrest & Warrant', court: 'Court Records' };
async function ucc(query, opts) {
  if (!opts.uccKey || !opts.uccSecret) return [];
  const g = (o, ...keys) => { if (!o) return ''; for (const k of keys) { if (o[k] != null && o[k] !== '') return o[k]; } return ''; };
  const base = (opts.uccUrl || 'https://unlimitedcriminalchecks.com/api-2.0').replace(/\/$/, '');
  const qs = new URLSearchParams();
  if (query.firstName) qs.set('first_name', query.firstName);
  if (query.lastName) qs.set('last_name', query.lastName);
  if (query.state) qs.set('state', query.state);
  if (query.city) qs.set('city', query.city);
  if (query.age) qs.set('age', String(query.age));
  qs.set('limit', String(opts.limit || 12));
  const res = await fetch(`${base}/search.php?${qs.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'X-API-Key': opts.uccKey, 'X-API-Secret': opts.uccSecret },
  });
  if (res.status === 429) throw new Error('ucc 429 rate-limited');
  if (!res.ok) throw new Error(`ucc ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data || data.success === false) throw new Error(`ucc ${(data && data.error) || 'no results object'}`);
  const results = (data && data.results) || {};
  // Flatten every feed (sex-offender / DOC / arrest / court) into one normalized list.
  const out = [];
  for (const feed of Object.keys(UCC_FEEDS)) {
    const recs = (results[feed] && Array.isArray(results[feed].records)) ? results[feed].records : [];
    for (const r of recs) {
      const first = clean(g(r, 'FIRST_NAME', 'first_name', 'firstName', 'First'));
      const last = clean(g(r, 'LAST_NAME', 'last_name', 'lastName', 'Last'));
      const full = clean(g(r, 'NAME', 'name', 'full_name', 'fullName')) || [first, last].filter(Boolean).join(' ');
      const offenseRaw = g(r, 'OFFENSE', 'offense', 'charges', 'charge', 'CHARGE');
      const charges = Array.isArray(offenseRaw)
        ? offenseRaw.map((c) => clean(typeof c === 'object' ? g(c, 'description', 'charge', 'name') : c)).filter(Boolean)
        : (clean(offenseRaw) ? [clean(offenseRaw)] : []);
      out.push({
        source: 'ucc', sourceName: UCC_FEEDS[feed],
        firstName: first, lastName: last, name: full,
        age: num(g(r, 'AGE', 'age')), gender: clean(g(r, 'GENDER', 'gender', 'SEX', 'sex')) || null,
        race: clean(g(r, 'RACE', 'race')) || null,
        charges,
        mugshotUrl: clean(g(r, 'MUGSHOT', 'mugshot', 'mugshot_url', 'MUGSHOT_URL', 'PHOTO', 'photo', 'photo_url', 'IMAGE', 'image')) || null,
        bookingDate: clean(g(r, 'BOOKING_DATE', 'booking_date', 'ARREST_DATE', 'arrest_date', 'DATE', 'date')) || null,
        releaseStatus: clean(g(r, 'STATUS', 'status', 'CUSTODY_STATUS', 'custody_status')) || null,
        facility: clean(g(r, 'FACILITY', 'facility', 'JAIL', 'jail', 'AGENCY', 'agency', 'SOURCE', 'source')) || null,
        county: clean(g(r, 'COUNTY', 'county')) || null,
        state: (clean(g(r, 'STATE', 'state')) || query.state || '').toUpperCase() || null,
      });
    }
  }
  return out;
}

// ── Enformion / Endato Criminal Search — the nationwide self-serve source (600M+ records, mugshots).
//    Auth = galaxy-ap-name / galaxy-ap-password headers (AccessProfile creds). Env-configured; enabled
//    only when creds are present AND consumer-display permission is confirmed. Response field names are
//    best-effort (PascalCase + camelCase variants) — finalize in the trial from a live sample. ──
async function enformion(query, opts) {
  if (!opts.enformionName || !opts.enformionPass) return [];
  // Confirmed live (2026-07-17): POST /CriminalSearch/v2 + galaxy-search-type: CriminalV2; auth =
  // galaxy-ap-name/password. Request uses OffenseState; response records carry FullName/First/Last,
  // Photos[].ImageUrl/ThumbUrl (mugshot), Offenses[].OffenseDescription/OffenseDate, Addresses[].County/State.
  // (Requires the AccessProfile to have the Criminal Search V2 product enabled — else "Access denied".)
  const base = (opts.enformionUrl || 'https://devapi.endato.com').replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json', Accept: 'application/json',
    'galaxy-ap-name': opts.enformionName, 'galaxy-ap-password': opts.enformionPass,
    'galaxy-search-type': opts.enformionSearchType || 'CriminalV2',
  };
  if (opts.enformionClient) headers['galaxy-client-type'] = opts.enformionClient;
  const res = await fetch(`${base}/CriminalSearch/v2`, {
    method: 'POST', headers,
    body: JSON.stringify({ FirstName: query.firstName, LastName: query.lastName, OffenseState: query.state, Page: 1, ResultsPerPage: 20 }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.isError)) throw new Error(`enformion ${res.status}: ${data && data.error && data.error.message || ''}`.trim());
  const g = (o, ...keys) => { if (!o) return ''; for (const k of keys) { if (o[k] != null && o[k] !== '') return o[k]; } return ''; };
  const records = (data && (data.criminalRecords || data.records || data.Records || data.persons || data.results)) || [];
  return records.map((r) => {
    const nm = r.name && typeof r.name === 'object' ? r.name : r; // person-style nested name{} or flat
    const photos = Array.isArray(r.Photos || r.photos) ? (r.Photos || r.photos) : [];
    const offenses = Array.isArray(r.Offenses || r.offenses) ? (r.Offenses || r.offenses) : [];
    const addr = Array.isArray(r.Addresses || r.addresses) ? (r.Addresses || r.addresses)[0] : (r.address || {});
    return {
      source: 'enformion', sourceName: clean(g(r, 'Source', 'source')) || 'Enformion',
      firstName: clean(g(nm, 'FirstName', 'firstName')), lastName: clean(g(nm, 'LastName', 'lastName')),
      name: clean(g(nm, 'FullName', 'fullName')) || [g(nm, 'FirstName', 'firstName'), g(nm, 'LastName', 'lastName')].map(clean).filter(Boolean).join(' '),
      age: num(g(r, 'Age', 'age')), gender: clean(g(r, 'Sex', 'sex', 'Gender', 'gender')) || null, race: clean(g(r, 'Race', 'race')) || null,
      charges: offenses.map((o) => clean(g(o, 'OffenseDescription', 'offenseDescription', 'Description', 'description'))).filter(Boolean),
      mugshotUrl: clean(g(photos[0] || {}, 'ImageUrl', 'imageUrl', 'ThumbUrl', 'thumbUrl')) || null,
      bookingDate: clean(g(offenses[0] || {}, 'OffenseDate', 'offenseDate', 'ConvictionDate', 'CaseDate')) || null,
      releaseStatus: null,
      facility: clean(g(r, 'Source', 'source')) || null,
      county: clean(g(addr, 'County', 'county')) || clean(g(offenses[0] || {}, 'OffenseCounty', 'County')) || null,
      state: (clean(g(addr, 'State', 'state')) || clean(g(offenses[0] || {}, 'SourceState', 'OffenseState')) || query.state || '').toUpperCase() || null,
    };
  });
}

// First-party state DOC scrapers (the moat — stateInmates.mjs). Write-through: every live result is
// upserted into the `inmates` table (fire-and-forget) so the first-party roster grows from real searches.
const stateDoc = async (query, opts) => {
  const recs = await findStateInmates(query, (opts && opts.env) || {});
  if (recs.length && hasInmatesDb) upsertInmates(recs).catch(() => {}); // never block the response
  return recs;
};
// Cached first-party roster (inmatesDb) — serves persisted rows (fast, and the fallback when a live
// scrape is blocked/down), each carrying `asOf` for the freshness display.
const dbInmates = (query, opts) => queryInmates({ state: query.state, firstName: query.firstName, lastName: query.lastName, limit: (opts && opts.limit) || 20 });
const PROVIDERS = { jailbase, ucc, floridaObis, enformion, stateDoc, dbInmates };

/**
 * Query all enabled incarceration providers for a person; return normalized, best-effort merged records.
 * Never throws — a provider failure degrades to the others (each is independently try/caught).
 * @param {{firstName?:string,lastName?:string,state?:string,city?:string,age?:string|number,sourceId?:string}} query
 * @param {object} [env] process.env (server-side)
 */
export async function findBookings(query, env = {}) {
  const opts = {
    jailbaseUrl: env.JAILBASE_API_URL,
    jailbaseRapidKey: env.JAILBASE_RAPIDAPI_KEY,
    jailbaseRapidHost: env.JAILBASE_RAPIDAPI_HOST || 'jailbase-jailbase.p.rapidapi.com',
    jailbaseSearchPath: env.JAILBASE_SEARCH_PATH,
    uccKey: env.UCC_API_KEY, uccSecret: env.UCC_API_SECRET, uccUrl: env.UCC_API_URL,
    enformionName: env.ENFORMION_AP_NAME, enformionPass: env.ENFORMION_AP_PASSWORD,
    enformionUrl: env.ENFORMION_API_URL, enformionClient: env.ENFORMION_CLIENT_TYPE, enformionSearchType: env.ENFORMION_SEARCH_TYPE,
    limit: Math.min(Number(env.INCARCERATION_LIMIT) || 12, 40),
    env,
  };
  const enabled = [];
  // Florida OBIS (our Neon) — free/reliable; only for FL or stateless searches (efficiency).
  const st = (query.state || '').toUpperCase();
  if (flSql && env.FL_OBIS_ENABLED !== 'false' && (!st || st === 'FL')) enabled.push('floridaObis');
  // JailBase is DROPPED (dead upstream — reliably 503s from Vercel; non-authoritative scraper-aggregate).
  // Off by default so it stops erroring in the sources map; set JAILBASE_ENABLED=1 to re-try it.
  if (env.JAILBASE_ENABLED === '1' && (opts.jailbaseRapidKey || env.JAILBASE_API_URL)) enabled.push('jailbase');
  if (opts.uccKey && opts.uccSecret) enabled.push('ucc');
  // Enformion — nationwide + mugshots; enabled when AccessProfile creds are set.
  if (opts.enformionName && opts.enformionPass) enabled.push('enformion');
  // First-party state DOC scraper — enabled whenever we have an adapter for the searched state.
  if (STATE_ADAPTERS[st] && env.STATE_INMATES_DISABLED !== '1') enabled.push('stateDoc');
  // Cached first-party roster — serve persisted rows for any state (coverage + blocked-state fallback).
  if (hasInmatesDb && st) enabled.push('dbInmates');
  const settled = await Promise.allSettled(enabled.map((k) => PROVIDERS[k](query, opts)));
  const records = [];
  const sources = {};
  settled.forEach((s, i) => {
    const k = enabled[i];
    if (s.status === 'fulfilled') { records.push(...s.value); sources[k] = s.value.length; }
    else sources[k] = { error: String(s.reason && s.reason.message || s.reason) };
  });
  // Dedupe; prefer records that carry a mugshot. Key on the SOURCE + stable inmate id when present
  // (distinct inmates from a state roster share name but have unique DOC#s, and often have no
  // facility/bookingDate on the list view — keying on name+date+facility alone collapsed real people).
  const byKey = new Map();
  for (const r of records) {
    const key = r.inmateId
      ? `${r.source || ''}|${String(r.inmateId).toLowerCase()}`
      : `${clean(r.name).toLowerCase()}|${r.bookingDate || ''}|${(r.facility || '').toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev || (!prev.mugshotUrl && r.mugshotUrl)) byKey.set(key, r);
  }
  return { count: byKey.size, records: [...byKey.values()].slice(0, opts.limit), sources };
}
