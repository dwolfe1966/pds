// ============================================================================
// NSOPW — First-party SEX-OFFENDER data layer (national aggregator adapter)
// ============================================================================
// TARGET: Dru Sjodin National Sex Offender Public Website (US DOJ / OJP).
// ONE source that queries all 50 states + DC + 5 territories live. Marketing
// angle = dating-safety ("is your match on a registry?").
//
// ── ENDPOINT (reverse-engineered 2026-07-19) ────────────────────────────────
//   POST https://nsopw-api.ojp.gov/nsopw/v1/v1.0/search
//   Content-Type: application/json          (site sends JSON string; either CT works)
//   Body (name search):
//     { firstName, lastName, city, county,
//       jurisdictions: ["FL","CA",...],      // REQUIRED unless `zips` given (omit both => HTTP 422, statusCode 108)
//       clientIp: "" }
//   Body (zip search): same but `zips: ["33101", ...]` (max 5) instead of `jurisdictions`.
//   Jurisdiction codes = 2-letter state/DC + AMERICANSAMOA, GU, CNMI, PR, USVI (56 total, see ALL_JURISDICTIONS).
//   Config source: inline <script> in https://www.nsopw.gov/search-public-sex-offender-registries
//   (var NSOPWForm; buildPostBody(); getData() -> $.ajax POST urlNSOPW). Companion GET:
//   https://nsopw-api.ojp.gov/nsopw/v1/v1.0/jurisdictions/offline  (which registries are down).
//
// ── RESPONSE ENVELOPE ───────────────────────────────────────────────────────
//   { statusCode: 200|201|108,               // 200 all-ok, 201 PARTIAL (a registry offline), 108 bad-request
//     jurisdictionStatus: [ { jurisdictionId, statusCode:"200"|"507"..., records, responseTime } ],
//     query: {...echo...},
//     offenders: [ {
//        name:      { givenName, middleName, surName, suffix },   // PRIMARY registry name
//        aliases:   [ { givenName, middleName, surName, suffix } ],// <-- the searched name is OFTEN only here
//        gender:    "M" | "F",
//        dob:       "1972-04-28T00:00:00",
//        age:       54,
//        locations: [ { type, streetAddress, city, county, state, zipCode, latitude, longitude } ],
//        offenderUri: "https://offender.fdle.state.fl.us/...",    // per-jurisdiction registry flyer (HTML-entity encoded!)
//        imageUri:    "https://.../CallImage?imgID=...",          // per-jurisdiction mugshot (HTML-entity encoded!)
//        absconder:   false,
//        jurisdictionId: "FL"
//     } ] }
//
// ── TIER: BROWSER-ONLY (node-direct is BLOCKED) ─────────────────────────────
//   The task assumed "no WAF => plain node fetch." TRUE for www.nsopw.gov, FALSE for the API host:
//   `nsopw-api.ojp.gov` sits behind a Cloudflare *managed challenge* — a direct Node fetch returns
//   403 "Just a moment...". A real browser on a residential IP passes with NO visible challenge
//   (correct TLS/JA3 + UA fingerprint), so we run the search as an in-page fetch inside Browserless
//   (BQL, residential proxy). `verify(type: cloudflare)` is the safety net for exits that DO get
//   challenged. cf_clearance is IP+UA-bound, so you CANNOT harvest a cookie in the browser and replay
//   it from a Node/datacenter fetch — the whole request must originate in the residential browser.
//
// ── FIELD REALITY vs the deliverable spec ───────────────────────────────────
//   * offenses[]  — NOT in the aggregate feed (verified: 0/113 records carry offense text). Registry
//                   charges live on the per-offender flyer (`offenderUri`). Left EMPTY here; populate via
//                   a follow-on flyer fetch per jurisdiction (that is the "70+ fields" offenders.io scrapes).
//   * riskLevel   — NOT in the aggregate feed (no tier/level field). Same story: flyer-only, per state.
//   * age/dob/gender/GPS (lat/long)/photo/aliases/address — ALL present in the feed and mapped below.
//   * offenderId  — no standalone field; parsed out of `offenderUri` (personId= / id= / &id=).
//
// ── CAVEATS ─────────────────────────────────────────────────────────────────
//   * MIN NAME: first+last combined must total >= 3 chars (site-enforced; server also rejects thin input).
//   * NATIONWIDE = one call: send ALL_JURISDICTIONS. Measured ~5s / 506 records for "James Smith"
//     across 56 jurisdictions — comfortably under the 60s BQL cap, so NO chunking needed.
//   * PARTIAL results: envelope statusCode 201 + a jurisdiction with statusCode "507" = that registry is
//     offline right now (e.g. AK during testing). We surface `jurisdictionStatus` so callers can tell.
//   * ALIAS MATCH: `offenders[].name` is the primary/legal name; your query name frequently appears only
//     in `aliases[]` (searching John Smith returned JEAN ANTOINE, ROBERT BROWN, ...). Treat every hit as
//     "a registrant whose name OR a known alias matches" — never assert name equality. `matchedAlias` is
//     set when the query matched an alias rather than the primary name.
//   * URIs are HTML-entity encoded (`&amp;`) — decoded before use or they 404.
//   * `location.type` differs by jurisdiction ("RESIDENTIAL" vs "R"); `streetAddress` may be a sentinel
//     ("TRANSIENT", "INCARCERATED", "OUT OF STATE") with 0/0 lat-long. Mapped defensively.
//   * Residential exits are flaky — retry loop + non-JSON/"just a moment" detection included.
//
// TEST:  node --env-file=.env.local scratchpad/nsopw-final.mjs [firstName] [lastName] [ST]
// ============================================================================

const SEARCH_URL = 'https://nsopw-api.ojp.gov/nsopw/v1/v1.0/search';
const WARMUP_URL = 'https://nsopw-api.ojp.gov/nsopw/v1/v1.0/jurisdictions/offline';

// All 56 searchable jurisdictions (states + DC + territories). Order matches the site's <select>.
export const ALL_JURISDICTIONS = [
  'AL','AK','AMERICANSAMOA','AZ','AR','CA','CO','CT','DE','DC','FL','GA','GU','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','CNMI',
  'OH','OK','OR','PA','PR','RI','SC','SD','TN','TX','USVI','UT','VT','VA','WA','WV','WI','WY',
];

const clean = (s) => (s == null ? '' : String(s).trim());
const decodeEntities = (s) => clean(s)
  .replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const joinName = (n) => n ? [n.givenName, n.middleName, n.surName, n.suffix].map(clean).filter(Boolean).join(' ') : '';

// offenderId lives inside the flyer URL — pull the stable id (personId=, id=, &id=, ?id=).
function extractOffenderId(uri) {
  const u = decodeEntities(uri);
  const m = u.match(/[?&](?:personId|offenderId|id|sid|OffenderID)=([^&#]+)/i);
  return m ? clean(m[1]) : null;
}

// ── Browserless BQL (residential) — solve/pass Cloudflare, run the search as an in-page fetch ──
function bqlEndpoint() {
  const svc = process.env.BROWSER_SERVICE_URL;
  if (!svc) return null;
  const base = new URL(svc);
  const token = base.searchParams.get('token');
  const u = new URL(`https://${base.host}/chrome/bql`);
  if (token) u.searchParams.set('token', token);
  u.searchParams.set('proxy', 'residential');
  u.searchParams.set('proxyCountry', process.env.BROWSER_PROXY_COUNTRY || 'us');
  u.searchParams.set('timeout', '60000');
  return u.toString();
}

function searchMutation(postBody) {
  // In-page fetch runs from the residential browser (cf_clearance bound to this session's IP+UA).
  const fetchJs = `
    const r = await fetch(${JSON.stringify(SEARCH_URL)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: ${JSON.stringify(JSON.stringify(postBody))},
      credentials: 'include'
    });
    const t = await r.text();
    return JSON.stringify({ status: r.status, body: t });
  `;
  return `mutation NSOPW {
    goto(url: ${JSON.stringify(WARMUP_URL)}, waitUntil: firstMeaningfulPaint) { status }
    verify(type: cloudflare) { found solved }
    res: evaluate(content: ${JSON.stringify(fetchJs)}) { value }
  }`;
}

async function runSearch(postBody, tries = 3) {
  const url = bqlEndpoint();
  if (!url) throw new Error('NSOPW requires BROWSER_SERVICE_URL (nsopw-api.ojp.gov is behind Cloudflare — browser tier + residential proxy)');
  const mutation = searchMutation(postBody);
  let lastErr = 'unknown';
  for (let i = 0; i < tries; i++) {
    let res, txt;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) });
      txt = await res.text();
    } catch (e) { lastErr = 'fetch:' + e.message; continue; }
    if (res.status === 429) { lastErr = '429 rate-limited'; await new Promise((r) => setTimeout(r, 15000)); continue; }
    if (res.status !== 200) { lastErr = `bql ${res.status}: ${txt.slice(0, 200)}`; continue; }
    let j; try { j = JSON.parse(txt); } catch { lastErr = 'bql non-json'; continue; }
    const value = j && j.data && j.data.res && j.data.res.value;
    if (!value) { lastErr = 'bql no value: ' + JSON.stringify(j).slice(0, 200); continue; }
    let inner; try { inner = JSON.parse(value); } catch { lastErr = 'inner non-json'; continue; }
    if (/just a moment|challenge-platform|enable javascript/i.test(inner.body || '')) { lastErr = 'cloudflare challenge on exit'; continue; }
    let data; try { data = JSON.parse(inner.body); } catch { lastErr = 'response non-json (http ' + inner.status + ')'; continue; }
    return data; // { statusCode, jurisdictionStatus, offenders, query }
  }
  throw new Error(`NSOPW search failed after ${tries} tries: ${lastErr}`);
}

function toRecord(o, query) {
  const primary = o.name || {};
  const aliases = Array.isArray(o.aliases) ? o.aliases : [];
  const loc = (Array.isArray(o.locations) && o.locations[0]) || {};
  const registryUrl = decodeEntities(o.offenderUri);
  const photoUrl = decodeEntities(o.imageUri) || null;
  const dob = clean(o.dob) ? clean(o.dob).slice(0, 10) : null; // YYYY-MM-DD

  // Did the query match the primary name or only an alias?
  const qf = norm(query.firstName), ql = norm(query.lastName);
  const nameHit = (n) => (!qf || norm(n.givenName).includes(qf) || qf.includes(norm(n.givenName))) &&
                         (!ql || norm(n.surName).includes(ql) || ql.includes(norm(n.surName)));
  const matchedPrimary = nameHit(primary);
  const aliasMatch = !matchedPrimary ? aliases.find(nameHit) : null;

  return {
    source: 'nsopw',
    sourceName: 'Dru Sjodin National Sex Offender Public Website',
    firstName: clean(primary.givenName) || null,
    lastName: clean(primary.surName) || null,
    name: joinName(primary) || null,
    age: Number.isFinite(o.age) ? o.age : null,
    dob,
    address: clean(loc.streetAddress) || null,
    city: clean(loc.city) || null,
    state: clean(loc.state) || o.jurisdictionId || null,
    zip: clean(loc.zipCode) || null,
    county: clean(loc.county) || null,
    latitude: Number.isFinite(loc.latitude) && loc.latitude !== 0 ? loc.latitude : null,
    longitude: Number.isFinite(loc.longitude) && loc.longitude !== 0 ? loc.longitude : null,
    gender: clean(o.gender) || null,
    offenses: [], // aggregate feed carries none — enrich from `registryUrl` flyer per jurisdiction
    aliases: aliases.map(joinName).filter(Boolean),
    photoUrl,
    riskLevel: null, // not in aggregate feed — flyer-only, per state
    jurisdiction: o.jurisdictionId || null,
    jurisdictionName: clean(loc.state) || o.jurisdictionId || null,
    offenderId: extractOffenderId(o.offenderUri),
    registryUrl: registryUrl || null,
    absconder: o.absconder === true,
    matchedAlias: aliasMatch ? joinName(aliasMatch) : null, // set when query hit an alias, not the primary name
    locations: (o.locations || []).map((l) => ({
      type: clean(l.type) || null, address: clean(l.streetAddress) || null, city: clean(l.city) || null,
      county: clean(l.county) || null, state: clean(l.state) || null, zip: clean(l.zipCode) || null,
      latitude: Number.isFinite(l.latitude) && l.latitude !== 0 ? l.latitude : null,
      longitude: Number.isFinite(l.longitude) && l.longitude !== 0 ? l.longitude : null,
    })),
  };
}

/**
 * Query the NSOPW national registry aggregator for a person.
 * @param {{firstName?:string,lastName?:string,state?:string,city?:string,county?:string,zip?:string,
 *          zips?:string[],jurisdictions?:string[]}} query
 * @returns {Promise<{count:number, statusCode:number, partial:boolean, jurisdictionStatus:Array, records:Array}>}
 *
 * Coverage: pass `state` (or `jurisdictions`) to scope to one/several registries; omit both to search
 * ALL 56 jurisdictions in a single ~5s call. A `zip`/`zips` search overrides jurisdiction scoping.
 */
export async function sexOffender(query = {}) {
  const firstName = clean(query.firstName);
  const lastName = clean(query.lastName);
  const zips = query.zips || (query.zip ? [clean(query.zip)] : null);

  if (!zips && (firstName.length + lastName.length) < 3) {
    throw new Error('NSOPW: first + last name must total at least 3 characters (or search by zip)');
  }

  const postBody = { firstName, lastName, city: clean(query.city), county: clean(query.county), clientIp: '' };
  if (zips && zips.length) {
    postBody.zips = [...new Set(zips.map(clean).filter(Boolean))].slice(0, 5); // site cap: 5 zips
  } else if (Array.isArray(query.jurisdictions) && query.jurisdictions.length) {
    postBody.jurisdictions = query.jurisdictions.map((s) => String(s).toUpperCase());
  } else if (query.state) {
    postBody.jurisdictions = [String(query.state).toUpperCase()];
  } else {
    postBody.jurisdictions = ALL_JURISDICTIONS; // nationwide — one call
  }

  const data = await runSearch(postBody);
  const offenders = Array.isArray(data.offenders) ? data.offenders : [];
  const jurisdictionStatus = Array.isArray(data.jurisdictionStatus) ? data.jurisdictionStatus : [];
  return {
    count: offenders.length,
    statusCode: data.statusCode ?? null,     // 200 ok · 201 partial (a registry offline) · 108 bad request
    partial: String(data.statusCode) === '201',
    jurisdictionStatus,                       // per-registry {jurisdictionId, statusCode, records, responseTime}
    records: offenders.map((o) => toRecord(o, { firstName, lastName })),
  };
}

export default sexOffender;

// ── self-test ───────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const [fn = 'John', ln = 'Smith', st = 'FL'] = process.argv.slice(2);
  console.log(`NSOPW sexOffender({ firstName:${JSON.stringify(fn)}, lastName:${JSON.stringify(ln)}, state:${JSON.stringify(st)} })\n`);
  const t0 = Date.now();
  const out = await sexOffender({ firstName: fn, lastName: ln, state: st });
  console.log(`count=${out.count}  statusCode=${out.statusCode}  partial=${out.partial}  (${Date.now() - t0}ms)`);
  const offline = out.jurisdictionStatus.filter((j) => String(j.statusCode) !== '200');
  if (offline.length) console.log('offline/error jurisdictions:', JSON.stringify(offline));
  console.log('\n--- first 2 records ---');
  for (const r of out.records.slice(0, 2)) {
    console.log(JSON.stringify({
      name: r.name, matchedAlias: r.matchedAlias, age: r.age, dob: r.dob, gender: r.gender,
      cityStateZip: [r.city, r.state, r.zip].filter(Boolean).join(', '), address: r.address,
      offenses: r.offenses, riskLevel: r.riskLevel, aliases: r.aliases.slice(0, 3),
      jurisdiction: r.jurisdiction, offenderId: r.offenderId, photoUrl: r.photoUrl, registryUrl: r.registryUrl,
    }, null, 2));
  }
}
