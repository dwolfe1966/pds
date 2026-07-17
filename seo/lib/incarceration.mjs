// Incarceration / booking data layer — first-party, on the idlookup.me Vercel server (the proven
// pattern), independent of BC. Provider-abstracted so we can add/swap sources without touching callers.
// Powers the inmate (/name/landing/v3) experience with mugshots, charges, facility, and booking dates.
//
// ⚠️ POC status (2026-07-17): field shapes for JailBase are from published docs; UCC is env-configured
// and its exact response must be finalized in the trial. LICENSING: only display UCC data once consumer-
// display permission is confirmed IN WRITING (owner is securing it). JailBase is a public scraper-
// aggregate — patchy coverage, non-authoritative; it may also rate-limit/block datacenter IPs, so a
// residential proxy or their paid/RapidAPI tier may be needed for reliable server-side calls.

const num = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isNaN(n) ? null : n; };
const clean = (s) => (s == null ? '' : String(s).trim());

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
  const base = opts.jailbaseUrl || 'https://www.jailbase.com/api/1';
  const p = new URLSearchParams();
  if (query.firstName) p.set('first_name', query.firstName);
  if (query.lastName) p.set('last_name', query.lastName);
  if (query.sourceId) p.set('source_id', String(query.sourceId));
  p.set('json', '1');
  const url = `${base}/search_records/?${p.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'idlookup/1.0', Accept: 'application/json' } });
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

const PROVIDERS = { jailbase, ucc };

/**
 * Query all enabled incarceration providers for a person; return normalized, best-effort merged records.
 * Never throws — a provider failure degrades to the others (each is independently try/caught).
 * @param {{firstName?:string,lastName?:string,state?:string,city?:string,age?:string|number,sourceId?:string}} query
 * @param {object} [env] process.env (server-side)
 */
export async function findBookings(query, env = {}) {
  const opts = {
    jailbaseUrl: env.JAILBASE_API_URL,
    jailbaseEnabled: env.JAILBASE_ENABLED !== 'false',
    uccKey: env.UCC_API_KEY, uccUrl: env.UCC_API_URL,
    limit: Math.min(Number(env.INCARCERATION_LIMIT) || 12, 40),
  };
  const enabled = [];
  if (opts.jailbaseEnabled) enabled.push('jailbase');
  if (opts.uccKey) enabled.push('ucc');
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
