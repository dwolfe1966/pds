// PersonSearch — first-party person enrichment via Enformion (works on the PersonSearch product today,
// no criminal/Sales gate), on the idlookup.me Vercel server. Returns real relatives + address history +
// aliases for a person, used INTERNALLY (KBA record-fact questions, WSFY affinities) — NOT displayed raw
// to consumers (display needs the same written permission as criminal). Honors the opt-out flag.
//
// Enformion PersonSearch: POST {base}/PersonSearch, galaxy-ap-name/password + galaxy-search-type: Person.
const clean = (s) => (s == null ? '' : String(s).trim());
const num = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isNaN(n) ? null : n; };

function normalizePerson(p, query) {
  const nm = p.name && typeof p.name === 'object' ? p.name : {};
  const addresses = (Array.isArray(p.addresses) ? p.addresses : []).map((a) => ({
    city: clean(a.city), state: clean(a.state), county: clean(a.county), zip: clean(a.zip),
    full: clean(a.fullAddress), lastSeen: clean(a.lastReportedDate),
  }));
  // Distinct "City, ST" history, most-recent-ish first (addresses come ordered).
  const seen = new Set(); const pastCities = [];
  for (const a of addresses) { const c = [a.city, a.state].filter(Boolean).join(', '); if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); pastCities.push(c); } }
  const relatives = (Array.isArray(p.relativesSummary) ? p.relativesSummary : []).map((r) => ({
    name: [clean(r.firstName), clean(r.lastName)].filter(Boolean).join(' '), relation: clean(r.relativeType) || 'Family',
  })).filter((r) => r.name);
  const aliases = (Array.isArray(p.akas) ? p.akas : []).map((a) => [clean(a.firstName), clean(a.lastName)].filter(Boolean).join(' ')).filter(Boolean);
  return {
    name: clean(p.fullName) || [nm.firstName, nm.lastName].map(clean).filter(Boolean).join(' '),
    firstName: clean(nm.firstName), lastName: clean(nm.lastName),
    age: num(p.age), dob: clean(p.dob),
    isOptedOut: !!p.isOptedOut,
    aliases, addresses, pastCities, relatives,
    phones: (Array.isArray(p.phoneNumbers) ? p.phoneNumbers : []).map((x) => ({ number: clean(x.phoneNumber), type: clean(x.phoneType) })).filter((x) => x.number),
    emails: (Array.isArray(p.emailAddresses) ? p.emailAddresses : []).map((x) => clean(x.emailAddress)).filter(Boolean),
    state: (query.state || (addresses[0] && addresses[0].state) || '').toUpperCase() || null,
  };
}

/**
 * Find the best-matching person (nationwide) and return a normalized, enrichment-ready record.
 * @param {{firstName?:string,lastName?:string,state?:string,city?:string,age?:string|number}} query
 * @param {object} [env]
 * @returns {Promise<object|null>} normalized person (null if none / not configured)
 */
export async function findPerson(query, env = process.env) {
  const APN = env.ENFORMION_AP_NAME, APP = env.ENFORMION_AP_PASSWORD;
  if (!APN || !APP || !query.lastName) return null;
  const base = (env.ENFORMION_API_URL || 'https://devapi.endato.com').replace(/\/$/, '');
  const body = { FirstName: query.firstName, LastName: query.lastName, State: query.state, City: query.city, Page: 1, ResultsPerPage: 5 };
  if (query.age) body.Age = String(query.age);
  let data;
  try {
    const res = await fetch(`${base}/PersonSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'galaxy-ap-name': APN, 'galaxy-ap-password': APP, 'galaxy-search-type': 'Person' },
      body: JSON.stringify(body),
    });
    data = await res.json().catch(() => null);
    if (!res.ok || (data && data.isError)) return null;
  } catch { return null; }
  let persons = (data && Array.isArray(data.persons)) ? data.persons : [];
  // Prefer non-opted-out; then a city/age match when provided.
  const cityN = (query.city || '').toLowerCase(); const ageN = num(query.age);
  const ageOk = (p) => ageN && num(p.age) != null && Math.abs(num(p.age) - ageN) <= 2;
  const cityOk = (p) => cityN && (p.addresses || []).some((a) => (a.city || '').toLowerCase() === cityN);
  const score = (p) => (p.isOptedOut ? 0 : 2) + (ageOk(p) ? 2 : 0) + (cityOk(p) ? 1 : 0);
  persons = persons.sort((a, b) => score(b) - score(a));
  const best = persons[0];
  if (!best || best.isOptedOut) return null; // never enrich from an opted-out record

  // MATCH CONFIDENCE (advisor 2026-07-17): findPerson returns a best-effort top result even on a weak
  // signal. For a common name with no age/city, the top hit could be a STRANGER — writing their relatives
  // into a member's record poisons the exact "May be family" signal WSFY monetizes. So gate any
  // enrichment WRITE on corroboration. 'high' = age (±2) OR exact-city match on the chosen record.
  // 'low' = name-only (ambiguous). Callers that persist must require 'high'.
  const corroborated = ageOk(best) || cityOk(best);
  // Also flag ambiguity: a common name where the 2nd result is just as plausible (no corroboration to
  // separate them) should not be trusted even if `best` happens to sort first.
  const ambiguous = !corroborated && persons.length > 1;
  const out = normalizePerson(best, query);
  out.matchConfidence = corroborated ? 'high' : 'low';
  out.ambiguous = ambiguous;
  return out;
}

/**
 * Enrichment-write guard: map a corroborated PersonSearch match into the member_enrichment shape
 * (relatives as name strings, past_locations as "City, ST"). Returns { ok:false } and writes NOTHING
 * on a weak/ambiguous match or opt-out — never poison WSFY affinities with a stranger's network.
 * Persistence is the CALLER's job (and is gated on confirming Enformion permits data retention).
 * @returns {Promise<{ok:boolean, reason?:string, enrichment?:object, person?:object}>}
 */
export async function personToEnrichment(query, env = process.env) {
  const p = await findPerson(query, env);
  if (!p) return { ok: false, reason: 'no_match' };
  if (p.isOptedOut) return { ok: false, reason: 'opted_out' };
  if (p.matchConfidence !== 'high') return { ok: false, reason: p.ambiguous ? 'ambiguous' : 'low_confidence', person: p };
  return {
    ok: true,
    person: p,
    enrichment: {
      userId: query.userId,
      relatives: p.relatives.map((r) => r.name).filter(Boolean),
      pastLocations: p.pastCities,
      city: query.city || (p.addresses[0] && p.addresses[0].city) || null,
      state: query.state || p.state || null,
      source: 'enformion_personsearch',
      verified: 'enformion',
    },
  };
}
