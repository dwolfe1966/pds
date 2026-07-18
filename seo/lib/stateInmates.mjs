// First-party state DOC inmate adapters (the scraping moat — docs/incarceration-data-strategy-provisional.md).
// Each adapter reverse-engineers a state's official inmate locator into the normalized BookingRecord shape
// used by incarceration.mjs. Live-search per query today; the same fetch primitives feed the crawl-to-DB
// pipeline later (build a first-party roster table → zero-cost queries + SEO).
//
// Query in:  { firstName, lastName, state, city, age }   (state selects the adapter)
// Record out: { source, sourceName, firstName, lastName, name, age, gender, race, charges[], mugshotUrl,
//               bookingDate, releaseStatus, facility, county, state, inmateId? }
//
// Guardrails (docs): public records only; polite single requests; NO captcha-busting; never pay-to-remove.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// #1 PROXY (SEO moat infra) — some state sites (TX/TDCJ) block datacenter IPs, so they return nothing from
// Vercel. Set STATE_PROXY_URL to a residential/rotating proxy (http://user:pass@host:port) and blocked-state
// adapters route through it via undici's ProxyAgent. Unset → direct fetch (works only from a non-blocked
// host). ⚠️ BLOCKED ON OWNER: a residential-proxy account (e.g. Bright Data / Oxylabs / Smartproxy).
let _proxyDispatcher; let _proxyTried = false;
async function proxyFetch(url, init = {}) {
  const px = process.env.STATE_PROXY_URL;
  if (!px) return fetch(url, init);
  if (!_proxyDispatcher && !_proxyTried) {
    _proxyTried = true;
    try {
      const { ProxyAgent } = await import('undici');
      const u = new URL(px); // http://USER:PASS@host:port
      const opts = { uri: `${u.protocol}//${u.host}` };
      // Set Proxy-Authorization explicitly — some undici versions ignore URL-embedded credentials.
      if (u.username || u.password) opts.token = `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64')}`;
      _proxyDispatcher = new ProxyAgent(opts);
    } catch { /* undici missing / bad URL → direct */ }
  }
  return _proxyDispatcher ? fetch(url, { ...init, dispatcher: _proxyDispatcher }) : fetch(url, init);
}
const clean = (s) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim());
const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isNaN(n) ? null : n; };
const stripTags = (s) => clean(String(s || '').replace(/<[^>]*>/g, ''));

// ── TX · TDCJ ── POST search.action (Struts, server-rendered HTML table). No auth/captcha. No mugshots.
//    Verified 2026-07-18: POST lastName=SMITH firstName=JAMES → tdcj_table rows. Fully enumerable.
async function TX(query) {
  const body = new URLSearchParams({
    page: 'index', lastName: clean(query.lastName).toUpperCase(), firstName: clean(query.firstName).toUpperCase(),
    tdcj: '', sid: '', gender: 'ALL', race: 'ALL', btnSearch: 'Search',
  }).toString();
  // TDCJ IP-blocks datacenter egress → route through STATE_PROXY_URL when set (else direct).
  const res = await proxyFetch('https://inmate.tdcj.texas.gov/InmateSearch/search.action', {
    method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!res.ok) throw new Error(`TX ${res.status}`);
  const html = await res.text();
  const out = [];
  // Each result row: <a href="/InmateSearch/viewDetail.action?sid=NNNN">LAST,FIRST</a> then <td>s:
  // [TDCJ#, Race, Gender, ProjectedReleaseDate, Unit, Age]
  const rowRe = /viewDetail\.action\?sid=(\d+)">([^<]+)<\/a>([\s\S]*?)(?=viewDetail\.action\?sid=|<\/table>)/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const rawName = clean(m[2]);
    const tds = [...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) => stripTags(t[1]));
    const [tdcjNum = '', race = '', gender = '', relDate = '', unit = '', age = ''] = tds;
    const comma = rawName.indexOf(',');
    const lastName = comma >= 0 ? clean(rawName.slice(0, comma)) : rawName;
    const firstName = comma >= 0 ? clean(rawName.slice(comma + 1)) : '';
    out.push({
      source: 'tx-tdcj', sourceName: 'Texas DOC (TDCJ)',
      firstName, lastName, name: [firstName, lastName].filter(Boolean).join(' ') || rawName,
      age: num(age), gender: gender || null, race: race || null,
      charges: [], mugshotUrl: null, bookingDate: null,
      releaseStatus: /LIFE/i.test(relDate) ? 'LIFE SENTENCE' : (relDate || null),
      facility: unit || null, county: null, state: 'TX', inmateId: tdcjNum || null,
    });
  }
  return out;
}

// ── CA · CDCR (CIRIS) ── FeathersJS JSON API. No auth/captcha. No mugshots/charges (contact court).
//    Verified 2026-07-18: the query validator REQUIRES the full $limit + $skip + $sort set, and `$` must
//    stay LITERAL (URLSearchParams encodes it to %24 → 400 "Invalid query"), so build the string by hand.
async function CA(query) {
  const last = clean(query.lastName); if (!last) return [];
  const parts = [`lastName=${encodeURIComponent(last)}`];
  if (clean(query.firstName)) parts.push(`firstName=${encodeURIComponent(clean(query.firstName))}`);
  parts.push('$limit=50', '$skip=0', '$sort%5BlastName%5D=1'); // literal $, encoded brackets — all required
  const res = await fetch(`https://ciris.mt.cdcr.ca.gov/api/ciris/v1/incarceratedpersons?${parts.join('&')}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`CA ${res.status}`);
  const json = await res.json().catch(() => null);
  const rows = (json && Array.isArray(json.data)) ? json.data : [];
  return rows.map((r) => ({
    source: 'ca-cdcr', sourceName: 'California DOC (CIRIS)',
    firstName: clean(r.firstName), lastName: clean(r.lastName),
    name: clean([r.firstName, r.middleName, r.lastName].filter(Boolean).join(' ')) || clean(r.fullName),
    age: num(r.age), gender: null, race: null,
    charges: [], mugshotUrl: null,
    bookingDate: r.admissionDate ? String(r.admissionDate).slice(0, 10) : null,
    releaseStatus: r.typeCode === 'I' ? 'incarcerated' : (clean(r.typeCode) || null),
    facility: clean(r.location) || null,
    county: Array.isArray(r.commitmentCounties) ? r.commitmentCounties.join(', ') : null,
    state: 'CA', inmateId: clean(r.cdcrNumber) || null,
  }));
}

// ── PA · PA DOC ── clean JSON API (Captor). No auth/captcha. Search returns roster rows; per-inmate DETAIL
//    carries the MUGSHOT (data:image URI) + sex. Verified 2026-07-18. Mugshot enrichment is opt-in (opts
//    .includePhotos) — it's one extra request per record, so off for a bare list, on for a detail view.
async function PA(query, opts = {}) {
  const API = 'https://captorapi.cor.pa.gov/InmateLocatorAPIV8/api/v1';
  const body = {
    id: '', firstName: clean(query.firstName), lastName: clean(query.lastName), middleName: '',
    paroleNumber: '', countylistkey: '---', citizenlistkey: '---', sexlistkey: '---',
    locationlistkey: '---', age: '', dateofbirth: query.dob || null, sortBy: '1',
  };
  const res = await fetch(`${API}/InmateLocator/SearchResults`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PA ${res.status}`);
  const data = await res.json().catch(() => null);
  const rows = (data && Array.isArray(data.inmates)) ? data.inmates : [];
  const ageFromDob = (d) => { if (!d) return null; const [m, day, y] = String(d).split('/').map(Number); if (!y) return null; const t = new Date(); let a = t.getFullYear() - y; if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < day)) a--; return a; };
  const norm = rows.map((r) => {
    const first = clean(r.inm_firstname), last = clean(r.inm_lastname), mid = clean(r.inm_middlename), suf = clean(r.inm_namesuffix);
    return {
      source: 'pa-doc', sourceName: 'Pennsylvania DOC',
      firstName: first, lastName: last, name: [first, mid, last, suf].filter(Boolean).join(' '),
      age: ageFromDob(r.dob), gender: null, race: null,
      charges: [], mugshotUrl: null, bookingDate: null, releaseStatus: 'in_custody',
      facility: clean(r.fac_name) || null, county: clean(r.cnty_name) || null,
      state: 'PA', inmateId: clean(r.inmate_number) || null,
    };
  });
  if (!opts.includePhotos) return norm;
  // Enrich (sex + mugshot) from the per-inmate detail — sequential = polite; cap to avoid hammering.
  const out = [];
  for (const rec of norm.slice(0, 10)) {
    try {
      const d = await fetch(`${API}/InmateLocator/InmateDetailsbyID/${encodeURIComponent(rec.inmateId)}`, { headers: { 'User-Agent': UA } });
      if (d.ok) {
        const dj = await d.json();
        const commit = (dj.inmateDetails || []).find((x) => x.name_descp === 'Commit Name') || (dj.inmateDetails || [])[0] || {};
        const img = (dj.inmImageDetails || [])[0];
        rec.gender = commit.sex ? (String(commit.sex).toUpperCase().startsWith('M') ? 'male' : String(commit.sex).toUpperCase().startsWith('F') ? 'female' : clean(commit.sex)) : rec.gender;
        rec.mugshotUrl = img && img.blob ? img.blob : rec.mugshotUrl;
      }
    } catch { /* keep base record */ }
    out.push(rec);
  }
  return out.concat(norm.slice(10));
}

// ── IL · IDOC ── legacy classic-ASP, two-step x-www-form-urlencoded. No auth/captcha. MUGSHOT is a plain
//    URL (pub_showfront.asp?idoc=DOC) — no per-record fetch needed. Verified 2026-07-18. Facility/status/
//    charges need the detail page (opt-in via includePhotos to avoid one POST per record).
async function IL(query, opts = {}) {
  const BASE = 'https://www.idoc.state.il.us/subsections/search';
  const last = clean(query.lastName); if (!last) return [];
  const term = clean(query.firstName) ? `${last}, ${clean(query.firstName)}` : last;
  const lr = await fetch(`${BASE}/ISListInmates2.asp`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, Referer: `${BASE}/ISdefault2.asp` },
    body: new URLSearchParams({ selectlist1: 'Last', idoc: term, submit: 'Find' }).toString(),
  });
  if (!lr.ok) throw new Error(`IL ${lr.status}`);
  const lh = await lr.text();
  const rawOpts = [...lh.matchAll(/<OPTION[^>]*>(?:<font[^>]*>\s*<\/font>)?\s*([A-Z]\d{4,}\s*\|\s*[\d/-]+\s*\|\s*[^<]+?)\s*<\/option>/gi)].map((m) => m[1]);
  const ageFromDob = (d) => { const p = String(d || '').split(/[/-]/).map(Number); if (p.length < 3) return null; const [mm, dd, yy] = p; if (!yy) return null; const t = new Date(); let a = t.getFullYear() - yy; if (t.getMonth() + 1 < mm || (t.getMonth() + 1 === mm && t.getDate() < dd)) a--; return a > 0 && a < 120 ? a : null; };
  const records = rawOpts.map((opt) => {
    const p = opt.split('|').map((s) => s.trim());
    const doc = p[0], dob = /^0+[/-]0+[/-]0+$/.test(p[1] || '') ? '' : (p[1] || ''), nm = p[2] || '';
    const [lastN, rest] = nm.split(',').map((s) => (s || '').trim());
    return {
      source: 'il-idoc', sourceName: 'Illinois DOC',
      firstName: (rest || '').split(/\s+/)[0] || '', lastName: lastN || '', name: clean(nm),
      age: ageFromDob(dob), gender: null, race: null, charges: [],
      mugshotUrl: `${BASE}/pub_showfront.asp?idoc=${encodeURIComponent(doc)}`,
      bookingDate: null, releaseStatus: null, facility: null, county: null,
      state: 'IL', inmateId: doc, _opt: opt,
    };
  });
  if (opts.includePhotos) {
    const val = (html, label) => { const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*</b>\\s*</font>\\s*</td>\\s*<td[^>]*>\\s*<font[^>]*>([^<]*)</font>`, 'i'); const m = html.match(re); return m ? clean(m[1]) : ''; };
    for (const rec of records.slice(0, 10)) {
      try {
        const dr = await fetch(`${BASE}/ISinms2.asp`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, Referer: `${BASE}/ISListInmates2.asp` },
          body: new URLSearchParams({ idoc: rec._opt }).toString(),
        });
        if (dr.ok) {
          const d = await dr.text();
          rec.facility = val(d, 'Parent Institution') || rec.facility;
          rec.releaseStatus = val(d, 'Offender Status') || rec.releaseStatus;
          const off = [...d.matchAll(/OFFENSE:<\/font>[^<]*<\/td>\s*<td[^>]*>\s*<font[^>]*>([^<]+)/gi)].map((m) => clean(m[1]));
          if (off.length) rec.charges = off;
        }
      } catch { /* keep base record */ }
    }
  }
  records.forEach((r) => { delete r._opt; });
  return records;
}

// ── NY · DOCCS ── #2 BROWSER TIER (moat infra). F5 BIG-IP WAF: the SearchByName/SearchByDin JSON API is
//    clean, but the TS cookie is minted by a JS challenge at Blazor boot — headless Chrome doesn't run on
//    Vercel serverless, so route through a browser SERVICE. Set BROWSER_SERVICE_URL to a Browserless
//    /function endpoint (navigate origin → boot → in-page fetch). Returns [] until configured.
//    ⚠️ BLOCKED ON OWNER: a headless-browser service account (Browserless / ScrapingBee / Bright Data).
async function NY(query) {
  const svc = process.env.BROWSER_SERVICE_URL;
  if (!svc || !clean(query.lastName)) return [];
  const body = { din: null, nysid: null, lastName: clean(query.lastName).toUpperCase(), firstName: clean(query.firstName).toUpperCase(), middleInitial: '', suffix: '', birthYear: '', userDisplayableMessage: null, clickNextFlag: '', clickNextDin: '' };
  // Browserless /function (verified contract 2026-07-18): POST {code, context}; the code exports a default
  // async fn receiving { page } and MUST return { data, type }; that `data` becomes the HTTP response body.
  // Boot the SPA (mints the F5 TS cookie), let Blazor settle, then do the API fetch IN-PAGE so it carries it.
  const code = `export default async function ({ page }) {
    await page.goto('https://nysdoccslookup.doccs.ny.gov/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));
    const result = await page.evaluate(async (b) => {
      const resp = await fetch('/IncarceratedPerson/SearchByName', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
      return resp.ok ? await resp.json() : { __status: resp.status };
    }, ${JSON.stringify(body)});
    return { data: result, type: 'application/json' };
  }`;
  let json;
  try {
    const res = await fetch(svc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, context: {} }) });
    if (!res.ok) return [];
    json = await res.json().catch(() => null); // response body IS the returned `data` (the search rows)
  } catch { return []; }
  const rows = Array.isArray(json) ? json : (json && Array.isArray(json.data) ? json.data : []);
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const nm = clean(r.name); const comma = nm.indexOf(',');
    const last = comma >= 0 ? clean(nm.slice(0, comma)) : nm;
    const first = comma >= 0 ? clean(nm.slice(comma + 1)) : '';
    return {
      source: 'ny-doccs', sourceName: 'New York DOCCS',
      firstName: first, lastName: last, name: nm,
      age: num(r.age), gender: null, race: clean(r.race) || null,
      charges: Array.isArray(r.crime) ? r.crime.map(clean).filter(Boolean) : [], mugshotUrl: null,
      bookingDate: null, releaseStatus: clean(r.status) || null,
      facility: clean(r.facility) || null, county: null,
      state: 'NY', inmateId: clean(r.din) || null,
    };
  });
}

// Registry — TX/CA/PA/IL live via fetch (TX needs STATE_PROXY_URL from Vercel). NY = browser-tier
// (needs BROWSER_SERVICE_URL). NJ = browser-tier too, pending a live-verified spec (recon sample failed).
export const STATE_ADAPTERS = { TX, CA, PA, IL, NY };
export const STATE_CODES = Object.keys(STATE_ADAPTERS);

/**
 * Query the state DOC adapter for `query.state`. Self-gating: returns [] when we have no adapter for that
 * state, no lastName, or the adapter errors (never throws). Kill switch: env.STATE_INMATES_DISABLED==='1'.
 * @returns {Promise<object[]>} normalized BookingRecords
 */
export async function findStateInmates(query, env = process.env) {
  if (env.STATE_INMATES_DISABLED === '1') return [];
  const st = (query.state || '').toUpperCase();
  const fn = STATE_ADAPTERS[st];
  if (!fn || !clean(query.lastName)) return [];
  const opts = { includePhotos: env.STATE_INMATES_PHOTOS === '1' };
  try { return await fn(query, opts); } catch { return []; }
}
