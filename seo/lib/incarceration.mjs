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
  const rows = fn
    ? await flSql`SELECT dc_number, first_name, middle_name, last_name, race, sex, birth_date, custody_status, facility, release_date, offenses FROM fl_inmates WHERE last_norm = ${ln} AND first_norm = ${fn} LIMIT 20`
    : await flSql`SELECT dc_number, first_name, middle_name, last_name, race, sex, birth_date, custody_status, facility, release_date, offenses FROM fl_inmates WHERE last_norm = ${ln} LIMIT 20`;
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
      facility: clean(r.facility) || null, county: null, state: 'FL',
    };
  });
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

// ── UnlimitedCriminalChecks — env-configured (key + base URL). Bundles DOC/inmate + arrest/booking +
//    mugshots. Exact field names to be confirmed in the trial; the mapper below is best-effort + defensive
//    so finalizing is a one-spot edit. Only enabled when UCC_API_KEY is present AND display rights confirmed. ──
async function ucc(query, opts) {
  if (!opts.uccKey) return [];
  const base = opts.uccUrl || 'https://api.unlimitedcriminalchecks.com';
  const res = await fetch(`${base}/v1/criminal/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.uccKey}` },
    body: JSON.stringify({ first_name: query.firstName, last_name: query.lastName, state: query.state, age: query.age }),
  });
  if (!res.ok) throw new Error(`ucc ${res.status}`);
  const data = await res.json().catch(() => null);
  const records = (data && (data.records || data.results || data.data)) || [];
  return records.map((r) => ({
    source: 'ucc', sourceName: clean(r.source || r.agency) || null,
    firstName: clean(r.first_name || r.firstName), lastName: clean(r.last_name || r.lastName),
    name: clean(r.full_name || r.name) || [r.first_name, r.last_name].map(clean).filter(Boolean).join(' '),
    age: num(r.age || r.dob_age), gender: clean(r.gender || r.sex) || null, race: clean(r.race) || null,
    charges: Array.isArray(r.charges) ? r.charges.map((c) => clean(c.description || c.charge || c)).filter(Boolean)
      : (clean(r.charge) ? [clean(r.charge)] : []),
    mugshotUrl: clean(r.mugshot || r.mugshot_url || r.image) || null,
    bookingDate: clean(r.booking_date || r.arrest_date) || null,
    releaseStatus: clean(r.release_status || r.status) || null,
    facility: clean(r.facility || r.jail) || null, county: clean(r.county) || null,
    state: (clean(r.state) || query.state || '').toUpperCase() || null,
  }));
}

// ── Enformion / Endato Criminal Search — the nationwide self-serve source (600M+ records, mugshots).
//    Auth = galaxy-ap-name / galaxy-ap-password headers (AccessProfile creds). Env-configured; enabled
//    only when creds are present AND consumer-display permission is confirmed. Response field names are
//    best-effort (PascalCase + camelCase variants) — finalize in the trial from a live sample. ──
async function enformion(query, opts) {
  if (!opts.enformionName || !opts.enformionPass) return [];
  const base = (opts.enformionUrl || 'https://devapi.endato.com').replace(/\/$/, '');
  const res = await fetch(`${base}/CriminalSearch/V1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
      'galaxy-ap-name': opts.enformionName,
      'galaxy-ap-password': opts.enformionPass,
      'galaxy-client-type': opts.enformionClient || 'DevAPI',
      'galaxy-search-type': opts.enformionSearchType || 'Criminal',
    },
    body: JSON.stringify({ FirstName: query.firstName, LastName: query.lastName, State: query.state, Page: 1, ResultsPerPage: 20 }),
  });
  if (!res.ok) throw new Error(`enformion ${res.status}`);
  const data = await res.json().catch(() => null);
  const records = (data && (data.records || data.Records || data.results || data.persons)) || [];
  const g = (r, ...keys) => { for (const k of keys) { if (r[k] != null && r[k] !== '') return r[k]; } return ''; };
  return records.map((r) => {
    const raw = g(r, 'charges', 'Charges', 'offenses', 'Offenses');
    const charges = Array.isArray(raw)
      ? raw.map((c) => clean(typeof c === 'object' ? g(c, 'description', 'Description', 'charge', 'Charge', 'offense') : c)).filter(Boolean)
      : (clean(g(r, 'offense', 'Offense', 'charge', 'Charge')) ? [clean(g(r, 'offense', 'Offense', 'charge', 'Charge'))] : []);
    return {
      source: 'enformion', sourceName: clean(g(r, 'source', 'Source', 'agency', 'Agency')) || 'Enformion',
      firstName: clean(g(r, 'firstName', 'FirstName')), lastName: clean(g(r, 'lastName', 'LastName')),
      name: clean(g(r, 'fullName', 'FullName', 'name', 'Name')) || [g(r, 'firstName', 'FirstName'), g(r, 'lastName', 'LastName')].map(clean).filter(Boolean).join(' '),
      age: num(g(r, 'age', 'Age', 'dobAge')), gender: clean(g(r, 'gender', 'Gender', 'sex', 'Sex')) || null, race: clean(g(r, 'race', 'Race')) || null,
      charges,
      mugshotUrl: clean(g(r, 'mugshot', 'Mugshot', 'mugshotUrl', 'MugshotUrl', 'image', 'Image')) || null,
      bookingDate: clean(g(r, 'bookingDate', 'BookingDate', 'arrestDate', 'ArrestDate', 'offenseDate', 'OffenseDate')) || null,
      releaseStatus: clean(g(r, 'status', 'Status', 'releaseStatus', 'ReleaseStatus')) || null,
      facility: clean(g(r, 'facility', 'Facility', 'agency', 'Agency')) || null,
      county: clean(g(r, 'county', 'County')) || null,
      state: (clean(g(r, 'state', 'State', 'offenseState', 'OffenseState')) || query.state || '').toUpperCase() || null,
    };
  });
}

const PROVIDERS = { jailbase, ucc, floridaObis, enformion };

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
    uccKey: env.UCC_API_KEY, uccUrl: env.UCC_API_URL,
    enformionName: env.ENFORMION_AP_NAME, enformionPass: env.ENFORMION_AP_PASSWORD,
    enformionUrl: env.ENFORMION_API_URL, enformionClient: env.ENFORMION_CLIENT_TYPE, enformionSearchType: env.ENFORMION_SEARCH_TYPE,
    limit: Math.min(Number(env.INCARCERATION_LIMIT) || 12, 40),
  };
  const enabled = [];
  // Florida OBIS (our Neon) — free/reliable; only for FL or stateless searches (efficiency).
  const st = (query.state || '').toUpperCase();
  if (flSql && env.FL_OBIS_ENABLED !== 'false' && (!st || st === 'FL')) enabled.push('floridaObis');
  // Only enable JailBase when the RapidAPI key is set (direct calls 503 from datacenter IPs).
  if (opts.jailbaseRapidKey || env.JAILBASE_API_URL) enabled.push('jailbase');
  if (opts.uccKey) enabled.push('ucc');
  // Enformion — nationwide + mugshots; enabled when AccessProfile creds are set.
  if (opts.enformionName && opts.enformionPass) enabled.push('enformion');
  const settled = await Promise.allSettled(enabled.map((k) => PROVIDERS[k](query, opts)));
  const records = [];
  const sources = {};
  settled.forEach((s, i) => {
    const k = enabled[i];
    if (s.status === 'fulfilled') { records.push(...s.value); sources[k] = s.value.length; }
    else sources[k] = { error: String(s.reason && s.reason.message || s.reason) };
  });
  // Dedupe by name+bookingDate+facility; prefer records that carry a mugshot.
  const byKey = new Map();
  for (const r of records) {
    const key = `${clean(r.name).toLowerCase()}|${r.bookingDate || ''}|${(r.facility || '').toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev || (!prev.mugshotUrl && r.mugshotUrl)) byKey.set(key, r);
  }
  return { count: byKey.size, records: [...byKey.values()].slice(0, opts.limit), sources };
}
