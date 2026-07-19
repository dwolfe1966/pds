// Life-events data layer — divorce (+ marriage when entitled) via Enformion/Endato. Mirrors the enformion
// provider in incarceration.mjs (galaxy-ap-name/password auth). Powers the marriage/divorce marketing angle
// (/name/landing/v6 divorce funnel) + the dating-verification "is your date married/divorced?" hook.
//
// PRICING (owner 2026-07-19): Divorce $0.05/match (entitled, All Plans), Marriage $0.10/match (Pro-only, NOT
// enabled yet — self-gates until Enformion enables it). Call these only POST-signup on a paid report, never on
// the high-volume prospect teaser (cost control). Criminal V2 ($2/match) is intentionally NOT used — we cover
// criminal via the scraped incarceration roster + IDI-in-the-BC-report.
//
// PII: the divorce record carries SSN + full spouse name. We DROP the ssn here and never expose it — display
// spouse name + divorce date + county/state only.
//
// ⚠️ ENDPOINT: verified on `devapi.endato.com` (POST /DivorceSearch, header galaxy-search-type: Divorce →
// 200 with real records). PROD `api.endato.com/DivorceSearch` 404s (prod uses a different path/version) — set
// ENFORMION_API_URL to the correct prod base once confirmed. Self-gates to [] when creds/URL missing.
const clean = (s) => (s == null ? '' : String(s).trim());
const num = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isNaN(n) ? null : n; };
const g = (o, ...keys) => { if (!o) return ''; for (const k of keys) { if (o[k] != null && o[k] !== '') return o[k]; } return ''; };

function enformionHeaders(env, searchType) {
  return {
    'Content-Type': 'application/json', Accept: 'application/json',
    'galaxy-ap-name': env.ENFORMION_AP_NAME, 'galaxy-ap-password': env.ENFORMION_AP_PASSWORD,
    'galaxy-search-type': searchType,
  };
}

/**
 * Divorce records for a person. Returns normalized rows (NO ssn). Never throws → [] on any failure.
 * @param {{firstName?:string,lastName?:string,city?:string,state?:string,spouseFirstName?:string}} query
 */
export async function divorceSearch(query, env = process.env) {
  if (!env.ENFORMION_AP_NAME || !env.ENFORMION_AP_PASSWORD) return [];
  const base = (env.ENFORMION_API_URL || 'https://devapi.endato.com').replace(/\/$/, '');
  const body = {
    FirstName: clean(query.firstName) || undefined, LastName: clean(query.lastName) || undefined,
    City: clean(query.city) || undefined, State: clean(query.state) || undefined,
    SpouseFirstName: clean(query.spouseFirstName) || undefined,
  };
  try {
    const res = await fetch(`${base}/DivorceSearch`, { method: 'POST', headers: enformionHeaders(env, 'Divorce'), body: JSON.stringify(body) });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const records = (data && Array.isArray(data.records)) ? data.records : [];
    // Record is a divorce between two parties: `spouse*` (the searched person) and `otherSpouse*` (the ex).
    // Top-level firstName/name are empty — read the spouse fields. ssn/spouseKey/certificatNo deliberately dropped.
    return records.map((r) => ({
      source: 'enformion-divorce', sourceName: 'Divorce record', recordType: 'divorce',
      firstName: clean(g(r, 'spouseFirstName')), lastName: clean(g(r, 'spouseLastName')),
      name: [g(r, 'spouseFirstName'), g(r, 'spouseMiddleName'), g(r, 'spouseLastName')].map(clean).filter(Boolean).join(' '),
      gender: clean(g(r, 'spouseGender')) || null, age: num(g(r, 'spouseAge')),
      exSpouseName: clean(g(r, 'otherSpouseFullName')) || [g(r, 'otherSpouseFirstName'), g(r, 'otherSpouseMiddleName'), g(r, 'otherSpouseLastName')].map(clean).filter(Boolean).join(' ') || null,
      exSpouseAge: num(g(r, 'otherSpouseAge')),
      marriageDate: clean(g(r, 'marriageDate')) || null,
      divorceDate: clean(g(r, 'divorceDate')) || null,
      county: clean(g(r, 'county')) || null, state: (clean(g(r, 'state')) || query.state || '').toUpperCase() || null,
    }));
  } catch { return []; }
}

/**
 * Marriage records. Self-gates to [] until Enformion enables Marriage Search on our AccessProfile
 * (currently "Access denied"). Set MARRIAGE_ENABLED=1 once enabled to turn it on.
 * @param {{firstName?:string,lastName?:string,city?:string,state?:string,maidenName?:string}} query
 */
export async function marriageSearch(query, env = process.env) {
  if (env.MARRIAGE_ENABLED !== '1') return []; // Pro-only, entitlement pending — don't spend on a 400
  if (!env.ENFORMION_AP_NAME || !env.ENFORMION_AP_PASSWORD) return [];
  const base = (env.ENFORMION_API_URL || 'https://devapi.endato.com').replace(/\/$/, '');
  const body = {
    FirstName: clean(query.firstName) || undefined, LastName: clean(query.lastName) || undefined,
    City: clean(query.city) || undefined, State: clean(query.state) || undefined,
    MaidenName: clean(query.maidenName) || undefined,
  };
  try {
    const res = await fetch(`${base}/MarriageSearch`, { method: 'POST', headers: enformionHeaders(env, 'Marriage'), body: JSON.stringify(body) });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const records = (data && Array.isArray(data.records)) ? data.records : [];
    // Same two-party Enformion shape as DivorceSearch (spouse = searched person, otherSpouse = who they married).
    // Field names assumed identical to the verified divorce record; confirm once Marriage is entitled.
    return records.map((r) => ({
      source: 'enformion-marriage', sourceName: 'Marriage record', recordType: 'marriage',
      firstName: clean(g(r, 'spouseFirstName')), lastName: clean(g(r, 'spouseLastName')),
      name: [g(r, 'spouseFirstName'), g(r, 'spouseMiddleName'), g(r, 'spouseLastName')].map(clean).filter(Boolean).join(' '),
      gender: clean(g(r, 'spouseGender')) || null, age: num(g(r, 'spouseAge')),
      spouseName: clean(g(r, 'otherSpouseFullName')) || [g(r, 'otherSpouseFirstName'), g(r, 'otherSpouseLastName')].map(clean).filter(Boolean).join(' ') || null,
      spouseAge: num(g(r, 'otherSpouseAge')),
      marriageDate: clean(g(r, 'marriageDate')) || null,
      county: clean(g(r, 'county')) || null, state: (clean(g(r, 'state')) || query.state || '').toUpperCase() || null,
    }));
  } catch { return []; }
}

export const hasDivorce = (env = process.env) => !!(env.ENFORMION_AP_NAME && env.ENFORMION_AP_PASSWORD);

/**
 * Orchestrate the life-events providers for ONE person → a single normalized, recordType-tagged list that maps
 * to the report / identity / relationship surfaces (docs/design/life-events-data-mapping.md). Never throws.
 *   - divorce (Enformion $0.05, entitled) + marriage (gated on MARRIAGE_ENABLED) run in parallel (fast).
 *   - sex-offender (NSOPW, browser-tier ~10s, HIGH-STAKES alias match) runs ONLY when opts.sexOffender === true
 *     (post-pay reports that want the safety flag) — never on the default/teaser path.
 * @param {{firstName?:string,lastName?:string,state?:string,city?:string,age?:string|number,gender?:string}} query
 * @param {object} [opts] { sexOffender?:boolean }
 */
export async function findLifeEvents(query, env = process.env, opts = {}) {
  // LOCATION mode ("offenders near you", owner 2026-07-19): NSOPW zip search, NO name → geographic safety,
  // no name-attribution problem. Used by the member-profile "Neighborhood Safety" module.
  if (opts.nearZips && opts.nearZips.length) {
    try {
      const { sexOffender } = await import('./sexOffender.mjs');
      const r = await sexOffender({ zips: opts.nearZips });
      const records = (r.records || []).map((rec) => ({
        source: 'nsopw', sourceName: 'Sex-offender registry', recordType: 'sex-offender-nearby',
        name: rec.name, age: rec.age, gender: rec.gender,
        city: (rec.locations && rec.locations[0] && rec.locations[0].city) || null,
        state: (rec.locations && rec.locations[0] && rec.locations[0].state) || null,
        zip: (rec.locations && rec.locations[0] && rec.locations[0].zip) || null,
        offenses: rec.offenses || [], photoUrl: rec.photoUrl || null, registryUrl: rec.registryUrl || null,
      }));
      return { count: records.length, records };
    } catch { return { count: 0, records: [] }; }
  }
  const tasks = [
    divorceSearch(query, env).then((rs) => rs.map((r) => ({ ...r, recordType: 'divorce' }))).catch(() => []),
    marriageSearch(query, env).then((rs) => rs.map((r) => ({ ...r, recordType: 'marriage' }))).catch(() => []),
  ];
  if (opts.sexOffender) {
    tasks.push((async () => {
      try {
        const { sexOffender } = await import('./sexOffender.mjs');
        const r = await sexOffender({ firstName: query.firstName, lastName: query.lastName, state: query.state, city: query.city });
        return (r.records || []).map((rec) => ({
          source: 'nsopw', sourceName: 'Sex-offender registry', recordType: 'sex-offender',
          name: rec.name, firstName: rec.firstName, lastName: rec.lastName, age: rec.age, gender: rec.gender,
          state: (rec.locations && rec.locations[0] && rec.locations[0].state) || query.state || null,
          county: (rec.locations && rec.locations[0] && rec.locations[0].county) || null,
          offenses: rec.offenses || [], photoUrl: rec.photoUrl || null, registryUrl: rec.registryUrl || null,
          matchedAlias: rec.matchedAlias || null, jurisdiction: rec.jurisdiction || null,
        }));
      } catch { return []; }
    })());
  }
  const settled = await Promise.allSettled(tasks);
  const records = settled.filter((s) => s.status === 'fulfilled').flatMap((s) => s.value);
  return { count: records.length, records };
}
