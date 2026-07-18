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

// #2 BROWSER TIER (moat infra) — run a Puppeteer function on Browserless (real browser TLS + behavior)
// to beat WAF/anti-bot sites (TX/TDCJ Akamai, NY F5) that reset proxied NON-browser connections. Those
// sites also block the browser's datacenter IP, so we append Browserless's RESIDENTIAL proxy. Set
// BROWSER_SERVICE_URL to your Browserless /function endpoint (…?token=…). Returns the fn's `data` (Browserless
// wraps it as {data,type}), or null. ⚠️ OWNER: Browserless account with residential-proxy capability.
async function browserFunction(code, tries = 3) {
  const svc = process.env.BROWSER_SERVICE_URL;
  if (!svc) return null;
  let url;
  try {
    url = new URL(svc);
    if (!url.searchParams.has('proxy')) { url.searchParams.set('proxy', 'residential'); url.searchParams.set('proxyCountry', process.env.BROWSER_PROXY_COUNTRY || 'us'); }
  } catch { return null; }
  // Residential exit nodes are flaky (some rotate into an IP the target resets/empties) — retry a few times.
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, context: {} }) });
      if (res.ok) { const j = await res.json().catch(() => null); const data = j ? j.data : null; if (data != null && !(data && data.__status)) return data; }
    } catch { /* retry */ }
  }
  return null;
}

// ── TX · TDCJ ── Struts HTML table. TDCJ's Akamai WAF RESETS proxied non-browser connections (verified:
//    every Decodo tier incl. US residential → TLS reset), so live requires the BROWSER TIER (real browser
//    + residential). Verified 2026-07-18 via Browserless: form-fill + submit → 26 rows. Direct/proxy path
//    kept for non-blocked hosts (e.g. the crawler off a residential box).
function parseTxHtml(html) {
  const out = [];
  const rowRe = /viewDetail\.action\?sid=(\d+)">([^<]+)<\/a>([\s\S]*?)(?=viewDetail\.action\?sid=|<\/table>)/g;
  let m;
  while ((m = rowRe.exec(html || '')) !== null) {
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
async function TX(query) {
  const ln = clean(query.lastName).toUpperCase(), fn = clean(query.firstName).toUpperCase();
  if (process.env.BROWSER_SERVICE_URL) {
    const code = `export default async function ({ page }) {
      await page.goto("https://inmate.tdcj.texas.gov/InmateSearch/start", { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.evaluate((fn, ln) => { const q = (n) => document.querySelector("[name=" + n + "]"); if (q("lastName")) q("lastName").value = ln; if (q("firstName")) q("firstName").value = fn; }, ${JSON.stringify(fn)}, ${JSON.stringify(ln)});
      await Promise.all([ page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null), page.evaluate(() => { const b = document.querySelector("[name=btnSearch]"); if (b) b.click(); }) ]);
      return { data: await page.content(), type: "text/html" };
    }`;
    return parseTxHtml(await browserFunction(code));
  }
  const body = new URLSearchParams({ page: 'index', lastName: ln, firstName: fn, tdcj: '', sid: '', gender: 'ALL', race: 'ALL', btnSearch: 'Search' }).toString();
  const res = await proxyFetch('https://inmate.tdcj.texas.gov/InmateSearch/search.action', {
    method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!res.ok) throw new Error(`TX ${res.status}`);
  return parseTxHtml(await res.text());
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
  // Route through browserFunction so it gets the residential proxy (DOCCS resets Browserless's datacenter
  // IP too). Returns the fn's `data` = the SearchByName rows (or {__status} on an in-page block).
  const result = await browserFunction(code);
  const rows = Array.isArray(result) ? result : [];
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

// ── WA · WA DOC ── Drupal Views exposed GET filter. No auth/CSRF/cookies. HTML table (DOC#, name, age,
//    facility). No mugshots/charges. Verified 2026-07-18. Enumerable (surname sweep + ?page=N).
async function WA(query) {
  const last = clean(query.lastName); if (!last) return [];
  const u = new URL('https://doc.wa.gov/records/incarcerated-data-search/incarcerated-search');
  u.searchParams.set('field_last_name_value', last);
  u.searchParams.set('field_first_name_value', clean(query.firstName));
  const res = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`WA ${res.status}`);
  const html = await res.text();
  const tb = html.match(/<tbody>([\s\S]*?)<\/tbody>/i); if (!tb) return [];
  const out = [];
  for (const row of (tb[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(stripTags);
    if (cells.length < 4) continue;
    const [inmateId, nameDisplay, age, facility] = cells;
    const parts = nameDisplay.split(',').map((s) => clean(s));
    const lastN = parts[0] || '', firstN = (parts[1] || '').split(/\s+/)[0] || '';
    if (!inmateId || !nameDisplay) continue;
    out.push({
      source: 'wa-doc', sourceName: 'Washington DOC', firstName: firstN, lastName: lastN, name: nameDisplay,
      age: num(age), gender: null, race: null, charges: [], mugshotUrl: null, bookingDate: null,
      releaseStatus: 'incarcerated', facility, county: null, state: 'WA', inmateId,
    });
  }
  return out;
}

// ── OH · ODRC ── ASP.NET MVC double-submit antiforgery: GET landing (token+cookie) → POST search → GET
//    results. HTML table w/ MUGSHOT (URL pattern) + offenses. Verified 2026-07-18. DOC# = letter+digits.
async function OH(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://appgateway.drc.ohio.gov/OffenderSearch';
  const setCookies = (r) => (r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []));
  const jarHdr = (arr) => arr.map((c) => c.split(';')[0]).join('; ');
  const mugshot = (num) => { const m = /^([A-Z])(\d+)$/.exec(num || ''); if (!m) return null; const b = Math.floor(parseInt(m[2], 10) / 100000) * 100; return `https://appgateway.drc.ohio.gov/images/${m[1]}/${b}k/${num}.jpg`; };
  const g = await fetch(BASE, { redirect: 'manual', headers: { 'User-Agent': UA } });
  const jar = setCookies(g); const gh = await g.text();
  const token = (gh.match(/name="__RequestVerificationToken"[^>]*value="([^"]*)"/i) || [])[1];
  if (!token) throw new Error('OH token missing');
  const body = new URLSearchParams({ __RequestVerificationToken: token, IsAuthenticated: '', LastName: last, FirstName: clean(query.firstName), CntyCommitment: '', CntyResidential: '', ZipCode: '', Status: 'A', PbDate: '', NumPrefix: 'A', OffNumber: '', Sort: 'N' });
  const p = await fetch(`${BASE}/Search/SearchResults`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jarHdr(jar), Referer: BASE, 'User-Agent': UA }, body });
  const jar2 = jarHdr([...jar, ...setCookies(p)]);
  const r = await fetch(`${BASE}/Search/Results`, { headers: { Cookie: jar2, Referer: `${BASE}/Search/SearchResults`, 'User-Agent': UA } });
  const rhtml = await r.text();
  const out = [];
  for (const row of (rhtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    const cell = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(stripTags);
    if (cell.length < 6) continue;
    const numId = cell[2]; if (!/^[A-Z]\d{4,}$/.test(numId)) continue;
    const full = cell[1]; const cm = full.split(',');
    const lastN = cm.length >= 2 ? clean(cm[0]) : clean(full.split(/\s+/).slice(-1)[0]);
    const firstN = cm.length >= 2 ? clean(cm.slice(1).join(',')) : clean(full.split(/\s+/).slice(0, -1).join(' '));
    out.push({
      source: 'oh-odrc', sourceName: 'Ohio DRC', firstName: firstN, lastName: lastN, name: [firstN, lastN].filter(Boolean).join(' '),
      age: null, gender: null, race: null, charges: cell[5] ? cell[5].split(/,\s*/).map(clean).filter(Boolean) : [],
      mugshotUrl: mugshot(numId), bookingDate: null, releaseStatus: cell[4] || null, facility: null,
      county: null, state: 'OH', inmateId: numId,
    });
  }
  return out;
}

// ── NC · NC DAC ── Struts POST → HTML table (9 cols). MUGSHOT via viewpicture.do URL. Also publishes the
//    FULL BULK roster (opus.doc.state.nc.us/offenders/*.zip) — a future OBIS-style ingest. Verified 2026-07-18.
async function NC(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://webapps.doc.state.nc.us/opi';
  const body = new URLSearchParams({
    heightTotalInchesMinimum: '0', heightTotalInchesMaximum: '0', activeFilter: '2',
    searchLastName: last.toUpperCase(), searchFirstName: clean(query.firstName).toUpperCase(),
    searchMiddleName: '', searchOffenderId: '', searchGender: '', searchRace: '', ethnicity: '',
    searchDOB: '', searchDOBRange: '0', ageMinimum: '', ageMaximum: '',
  });
  const res = await fetch(`${BASE}/offendersearch.do?method=list`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body: body.toString() });
  if (!res.ok) throw new Error(`NC ${res.status}`);
  const html = await res.text();
  const out = []; const seen = new Set();
  const rowRe = /<tr[^>]*class="tableRow(?:Odd|Even)"[^>]*>([\s\S]*?)<\/tr>/g; let m;
  while ((m = rowRe.exec(html)) && out.length < 24) {
    const block = m[1]; if (!/viewoffender\.do/.test(block)) continue;
    const cells = [...block.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => stripTags(c[1]));
    if (cells.length < 9) continue;
    const [, lastN, suffix, first, middle, gender, race, , age] = cells;
    const id = (/offenderID=(\d{7})/.exec(block) || [])[1] || cells[0];
    if (!id || seen.has(id)) continue; seen.add(id);
    out.push({
      source: 'nc-dac', sourceName: 'North Carolina DAC', firstName: first || '', lastName: lastN || '',
      name: [first, middle, lastN, suffix].filter(Boolean).join(' '), age: num(age), gender: gender || null, race: race || null,
      charges: [], mugshotUrl: `${BASE}/viewpicture.do?method=view&showDate=N&pictureType=I&pictureSequence=1&offenderID=${id}`,
      bookingDate: null, releaseStatus: null, facility: null, county: null, state: 'NC', inmateId: id,
    });
  }
  return out;
}

// ── GA · GDC ── session (disclaimer) → name search → per-record detail (N+1, so capped). Rich: charges,
//    mugshot, county, facility, status. services.gdc.ga.gov app host (NOT the Cloudflare-challenged mirror).
//    Verified 2026-07-18. Enumerable (surname sweep / sequential GDC#). Slow-ish live → write-through to DB.
async function GA(query) {
  const last = clean(query.lastName); if (!last) return [];
  const B = 'https://services.gdc.ga.gov/GDC/OffenderQuery/jsp', IMG = 'https://services.gdc.ga.gov/offenderimg';
  const jar = {};
  const merge = (r) => { const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []); for (const c of raw) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); } };
  const ckh = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const gstrip = (h) => (h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const grab = (t, re) => { const m = re.exec(t); return m ? gstrip(m[1]) : ''; };
  const searchBody = (over) => Object.entries(Object.assign({ vLastName: '', vFirstName: '', vMiddleName: '', vAlias: '', vUnoCaseNoRadioButton: 'none', vOffenderId: '', vGender: '', vRace: '', vAgeLow: '', vAgeHigh: '', vHeightLow: '', vHeightHigh: '', vWeightLow: '', vWeightHigh: '', vEyeColor: '', vHairColor: '', vSMT: '', vCurrentInstitution: '', vCounty: '', vOffense: '', vSentencedTo: '', vScope: '', vListType: '', vOutput: 'Detailed', vDetailFormat: 'Summary', vIsCookieEnabled: 'Y', RecordsPerPage: '45', NextPage: '2' }, over)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`).join('&');
  const post = (body) => fetch(`${B}/OffQryRedirector.jsp`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: ckh(), Referer: `${B}/OffQryForm.jsp` }, body });
  const parse = (html, recNo) => {
    const t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    const gdcId = grab(t, /GDC ID:\s*<\/?[^>]*>?\s*([0-9]{6,10})/i) || recNo;
    const name = grab(t, /NAME:([^<]+)</i);
    const yob = grab(t, /YOB:\s*<\/?[^>]*>?\s*([0-9]{4})/i);
    const charges = []; const re = /OFFENSE:\s*<\/?[^>]*>?\s*([^<]+)</gi; let m2;
    while ((m2 = re.exec(t))) { const c = gstrip(m2[1]); if (c && !charges.includes(c)) charges.push(c); }
    const st = grab(t, /CURRENT STATUS:\s*<\/?[^>]*>?\s*([A-Z]+)/i);
    let lastN = '', first = ''; if (name.includes(',')) { const p = name.split(','); lastN = clean(p[0]); first = clean((p[1] || '').split(/\s+/)[0]); }
    return {
      source: 'ga-gdc', sourceName: 'Georgia DOC', inmateId: gdcId, name, firstName: first, lastName: lastN,
      age: yob ? (new Date().getFullYear() - Number(yob)) : null,
      gender: grab(t, /GENDER:\s*<\/?[^>]*>?\s*([A-Z]+)/i) || null, race: grab(t, /RACE:\s*<\/?[^>]*>?\s*([A-Z ]+?)\s*(?:GENDER|<)/i) || null,
      charges, mugshotUrl: `${IMG}/${gdcId}.jpg`, bookingDate: grab(t, /INCARCERATION BEGIN:\s*<\/?[^>]*>?\s*([0-9/]+)/i) || null,
      releaseStatus: st || null, facility: grab(t, /MOST RECENT INSTITUTION:\s*<\/?[^>]*>?\s*([^<]+)</i) || null,
      county: grab(t, /CONVICTION COUNTY:\s*<\/?[^>]*>?\s*([^<&]+)/i) || null, state: 'GA',
    };
  };
  let r = await fetch(`${B}/OffQryForm.jsp`, { headers: { 'User-Agent': UA } }); merge(r); await r.text();
  r = await fetch(`${B}/OffQryForm.jsp`, { method: 'POST', redirect: 'manual', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: ckh() }, body: 'vDisclaimer=True&submit2=agree' }); merge(r); await r.text();
  const lr = await post(searchBody({ vLastName: last.toUpperCase(), vFirstName: clean(query.firstName).toUpperCase() }));
  const list = await lr.text();
  if (/GDC ID:/i.test(list) && !/name="vRecNo"/i.test(list)) return [parse(list, grab(list, /GDC ID:\s*<\/?[^>]*>?\s*([0-9]{6,10})/i))];
  const recs = [...new Set([...list.matchAll(/name="vRecNo"\s+type="hidden"\s+value="([0-9]{6,10})"/gi)].map((m) => m[1]))].slice(0, 8);
  const out = [];
  for (const rec of recs) { try { const d = await post(`vRecNo=${rec}&NextPage=6&btn1=View+Offender+Info`); out.push(parse(await d.text(), rec)); } catch { /* skip */ } }
  return out;
}

// ── MI · MDOC OTIS ── stateful ASP.NET behind F5 + Cloudflare. 4-step session dance; results live in
//    server-side session keyed by the F5 `TS…` affinity cookie — so all requests MUST share ONE socket or
//    /Results bounces empty. We pin a single undici Agent (connections:1). List gives name/charges(MCL)/
//    facility/status; mugshot is on the profile page (deferred). Verified 2026-07-18. Degrades to [] if split.
async function MI(query) {
  const last = clean(query.lastName); if (!last) return [];
  const B = 'https://mdocweb.state.mi.us';
  let dispatcher;
  try { const { Agent } = await import('undici'); dispatcher = new Agent({ connections: 1, pipelining: 1, keepAliveTimeout: 30000 }); } catch { dispatcher = undefined; }
  const jar = new Map();
  const absorb = (r) => { const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []); for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const H = (extra = {}) => { const h = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...extra }; const c = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '); if (c) h.Cookie = c; return h; };
  const F = (url, opts = {}) => fetch(url, dispatcher ? { ...opts, dispatcher } : opts);
  try {
    absorb(await F(`${B}/OTIS2/Search`, { headers: H() }));
    const body = new URLSearchParams({ LastName: last.toUpperCase(), FirstName: clean(query.firstName).toUpperCase(), MDOCNumber: '', Sex: 'Either', Race: 'All', Age: '', OffenderStatus: 'Prison', MarksScarsTattoos: '', 'action:Search': 'Search' });
    absorb(await F(`${B}/OTIS2/Search`, { method: 'POST', redirect: 'manual', body, headers: H({ 'Content-Type': 'application/x-www-form-urlencoded', Origin: B, Referer: `${B}/OTIS2/Search` }) }));
    const res = await F(`${B}/OTIS2/Results`, { headers: H({ Referer: `${B}/OTIS2/Search` }) });
    absorb(res);
    const html = await res.text();
    const out = [];
    const rowRe = /action:LoadProfile"\s+value="(\d+)"[^>]*>\s*<\/td>([\s\S]*?)<\/tr>/gi; let m;
    while ((m = rowRe.exec(html))) {
      const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
      const [lastN, first, , sex, race, mcl, location, status] = cells;
      out.push({
        source: 'mi-otis', sourceName: 'Michigan DOC (OTIS)', firstName: first || '', lastName: lastN || '',
        name: [first, lastN].filter(Boolean).join(' '), age: null, gender: sex || null, race: race || null,
        charges: mcl ? [mcl] : [], mugshotUrl: null, bookingDate: null, releaseStatus: status || null,
        facility: location || null, county: null, state: 'MI', inmateId: m[1],
      });
    }
    return out;
  } catch { return []; } finally { try { if (dispatcher) dispatcher.close(); } catch { /* ignore */ } }
}

// ── MO · DOC (Offender Web Search) ── Struts JSP (Imperva/F5 fronted). GET welcome (session cookies) →
//    POST search. ⚠️ CAPTCHA-GATED: a cold session must solve a numeric-image captcha before searching, so
//    the live path throws 'MO captcha gate' (→ [] via findStateInmates) until a vision solver is wired. The
//    flow + parser are kept for the crawler (one solve per session clears it). MUGSHOT via PhotoServer. Probed 2026-07-18.
async function MO(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://web.mo.gov/doc/offSearchWeb';
  const jar = new Map();
  const absorb = (r) => { const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []); for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const ckh = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const w = await fetch(`${BASE}/welcome.do`, { headers: { 'User-Agent': UA } });
  if (!w.ok) throw new Error(`MO ${w.status}`);
  absorb(w); await w.text();
  const body = new URLSearchParams({ docId: '', firstName: clean(query.firstName), lastName: last, subType: 'Search' });
  const s = await fetch(`${BASE}/searchOffenderAction.do`, { method: 'POST', redirect: 'follow', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: ckh(), Referer: `${BASE}/welcome.do` }, body: body.toString() });
  if (!s.ok) throw new Error(`MO ${s.status}`);
  const html = await s.text();
  if (/captcha/i.test(html) && !/offenderListForm|Assigned Location/i.test(html)) throw new Error('MO captcha gate');
  const ageFromDob = (d) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(d || ''); if (!m) return null; const t = new Date(); let a = t.getFullYear() - Number(m[3]); if (t.getMonth() + 1 < Number(m[1]) || (t.getMonth() + 1 === Number(m[1]) && t.getDate() < Number(m[2]))) a--; return a > 0 && a < 120 ? a : null; };
  const out = [];
  for (const tr of (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [])) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => stripTags(c[1]));
    if (cells.length < 8 || !/^\d+$/.test(cells[0])) continue; // list cols: DOC ID | Last | First | DOB | Race | Hgt | Wgt | Sex
    const [docId, lastN, firstN, dob, race, , , sex] = cells;
    out.push({
      source: 'mo-doc', sourceName: 'Missouri DOC',
      firstName: clean(firstN), lastName: clean(lastN), name: `${clean(firstN)} ${clean(lastN)}`.trim(),
      age: ageFromDob(dob), gender: /^m/i.test(sex) ? 'male' : /^f/i.test(sex) ? 'female' : null, race: race || null,
      charges: [], mugshotUrl: `${BASE.replace('/offSearchWeb', '')}/PhotoServer/getPublicFrontal?docId=${docId}`,
      bookingDate: null, releaseStatus: 'active', facility: null, county: null, state: 'MO', inmateId: docId,
    });
  }
  return out;
}

// ── MD · DPSCS (Incarcerated Individual Locator) ── ASP.NET WebForms, plain GET, no cookie/CSRF/captcha.
//    REQUIRES BOTH FirstName + LastName (exact, case-insensitive; a missing one 400s), so this returns []
//    when there's no firstName. HTML table #gvSearchInmate. No mugshots / detail / charges / county / race;
//    DOB is MM/YYYY only. Verified 2026-07-18.
async function MD(query) {
  const last = clean(query.lastName), first = clean(query.firstName);
  if (!last || !first) return []; // MD matches exactly on BOTH names — no first name → no results (avoids the 400)
  const url = `https://dpscs.maryland.gov/IncarceratedIndividualLocator/IncarceratedIndividualLocator?searchType=name&FirstName=${encodeURIComponent(first)}&LastName=${encodeURIComponent(last)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (res.status === 400) return []; // empty/invalid name → no results, not an error
  if (!res.ok) throw new Error(`MD ${res.status}`);
  const tbl = ((await res.text()).match(/id="gvSearchInmate"[\s\S]*?<\/table>/i) || [''])[0];
  if (!tbl) return [];
  const ageFromDob = (d) => { const mm = /^(\d{1,2})\/(\d{4})$/.exec(clean(d)); if (!mm) return null; const t = new Date(); let a = t.getFullYear() - parseInt(mm[2], 10); if (t.getMonth() + 1 < parseInt(mm[1], 10)) a--; return a > 0 && a < 120 ? a : null; };
  const out = [];
  for (const row of (tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
    if (cells.length < 7) continue; // cols: Full Name | DOC# | SID | Gender | DOB(MM/YYYY) | Fac(abbr) | Fac(full)
    const [fullName, docId, , gender, dob, , facFull] = cells;
    if (!docId) continue;
    out.push({
      source: 'md-dpscs', sourceName: 'Maryland DPSCS',
      firstName: first, lastName: last, name: clean(fullName) || `${first} ${last}`,
      age: ageFromDob(dob), gender: /^m/i.test(gender) ? 'male' : /^f/i.test(gender) ? 'female' : null, race: null,
      charges: [], mugshotUrl: null, bookingDate: null, releaseStatus: 'in_custody',
      facility: clean(facFull) || null, county: null, state: 'MD', inmateId: clean(docId),
    });
  }
  return out;
}

// ── CO · DOC (Offender Search Site) ── Prototype.js Ajax → HTML fragments. GET /oss/ (PHPSESSID) → POST
//    list_offenders. ⚠️ CAPTCHA-GATED: a cold session returns a shape-count captcha challenge, so the live
//    path throws 'CO captcha gate' (→ [] via findStateInmates) until a vision solver is wired. The flow +
//    parser are kept for the crawler (one solve per session clears it). MUGSHOT via photo URL. Probed 2026-07-18.
async function CO(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://www.doc.state.co.us/oss/controller/ctl_ajax.php';
  const land = await fetch('https://www.doc.state.co.us/oss/', { redirect: 'manual', headers: { 'User-Agent': UA } });
  const sc = land.headers.getSetCookie ? land.headers.getSetCookie() : (land.headers.get('set-cookie') ? [land.headers.get('set-cookie')] : []);
  const cookie = sc.map((c) => c.split(';')[0]).find((c) => /PHPSESSID=/.test(c)) || '';
  const body = new URLSearchParams({ docno: '', lnam: last, fnam: clean(query.firstName), gender: 'ALL', sec: 'list_offenders', search: 'true', start: '0', order_col: '', order_dir: '' });
  const s = await fetch(BASE, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://www.doc.state.co.us/oss/' }, body: body.toString() });
  if (!s.ok) throw new Error(`CO ${s.status}`);
  const html = await s.text();
  if (/CAPTCHA Challenge/i.test(html) || /captcha_toggle\([^)]*'on'\)/.test(html)) throw new Error('CO captcha gate');
  const out = [];
  for (const tr of (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [])) {
    if (!/get_offender\('[^']*','?\d+'?\)/.test(tr)) continue; // skip header / control rows
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => stripTags(x[1]));
    if (tds.length < 6) continue; // cols: Name(Last, First) | DOC# | Ethnicity | Gender | Facility | Age
    const [nm, docno, ethnicity, gender, facility, age] = tds;
    const comma = nm.indexOf(',');
    const lastN = comma >= 0 ? clean(nm.slice(0, comma)) : nm;
    const firstN = comma >= 0 ? clean(nm.slice(comma + 1)) : '';
    out.push({
      source: 'co-doc', sourceName: 'Colorado DOC',
      firstName: firstN, lastName: lastN, name: clean(nm),
      age: num(age), gender: /^m/i.test(gender) ? 'male' : /^f/i.test(gender) ? 'female' : null, race: ethnicity || null,
      charges: [], mugshotUrl: `https://www.doc.state.co.us/offender_search/offender_photos/PRODUCTION/${docno.slice(0, 3)}/${docno}.jpg`,
      bookingDate: null, releaseStatus: null, facility: facility || null, county: null, state: 'CO', inmateId: docno,
    });
  }
  return out;
}

// ── MN · DOC (COMS PublicViewer) ── ASP.NET MVC: GET landing (session cookie + __RequestVerificationToken) →
//    POST name search (302; results kept in session) → GET grid JSON. No captcha; a Radware bot-manager
//    fronts it (may decoy the DETAIL page, but the search grid is clean). No mugshot / gender / charges at
//    list level; age derived from DOB. lastName-only OK. Verified 2026-07-18.
async function MN(query) {
  const last = clean(query.lastName); if (!last) return [];
  const B = 'https://coms.doc.state.mn.us/PublicViewer';
  const jar = new Map();
  const absorb = (r) => { const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []); for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const ckh = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const land = await fetch(`${B}/`, { headers: { 'User-Agent': UA } });
  if (!land.ok) throw new Error(`MN ${land.status}`);
  absorb(land);
  const tok = ((await land.text()).match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/) || [])[1] || '';
  const form = new URLSearchParams({ rdogrp: '1', firstName: clean(query.firstName), lastName: last, oid: '' });
  if (tok) form.set('__RequestVerificationToken', tok);
  const post = await fetch(`${B}/Home/Index`, { method: 'POST', redirect: 'manual', headers: { 'User-Agent': UA, Cookie: ckh(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${B}/` }, body: form.toString() });
  absorb(post);
  const gr = await fetch(`${B}/SearchResults/GetOffenders////1`, { headers: { 'User-Agent': UA, Cookie: ckh(), 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json', Referer: `${B}/SearchResults` } });
  if (!gr.ok) throw new Error(`MN ${gr.status}`);
  const rows = await gr.json().catch(() => []);
  const ageFromDob = (d) => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(d || '')); if (!m) return null; const t = new Date(); let a = t.getFullYear() - Number(m[3]); if (t.getMonth() + 1 < Number(m[1]) || (t.getMonth() + 1 === Number(m[1]) && t.getDate() < Number(m[2]))) a--; return a > 0 && a < 120 ? a : null; };
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const nm = clean(r.FullName); const comma = nm.indexOf(','); // "Last, First Middle"
    const lastN = comma >= 0 ? clean(nm.slice(0, comma)) : nm;
    const firstN = comma >= 0 ? clean(nm.slice(comma + 1)).split(/\s+/)[0] : '';
    return {
      source: 'mn-doc', sourceName: 'Minnesota DOC',
      firstName: firstN, lastName: lastN, name: nm,
      age: ageFromDob(r.DOB), gender: null, race: null,
      charges: [], mugshotUrl: null, bookingDate: null,
      releaseStatus: clean(r.CurrentStatus) || null, facility: null, county: null,
      state: 'MN', inmateId: r.OID != null ? String(r.OID) : null,
    };
  });
}

// ── IN · IDOC (Offender Locator / OFS) ── legacy Java app, plain GET form, HTML tables. No captcha/CSRF/JS.
//    Cloudflare fronts it (__cf_bm) but a browser-UA GET returns 200; datacenter IPs MAY get CF-challenged →
//    proxyFetch handles that. lname required; DOB is MM/YYYY only; no mugshots. Charges + county live on the
//    per-inmate detail page (opt-in via includePhotos → polite 3-row slice). Verified 2026-07-18.
async function IN(query, opts = {}) {
  const ln = clean(query.lastName).toUpperCase(); if (!ln) return [];
  const fn = clean(query.firstName).toUpperCase();
  const IN_BASE = 'https://offenderlocator.idoc.in.gov/idoc-ofs-1.0.2/ofs';
  const dobToAge = (dob) => { const y = (String(dob).match(/(\d{4})/) || [])[1]; if (!y) return null; const a = new Date().getFullYear() - parseInt(y, 10); return a > 0 && a < 120 ? a : null; };
  const qs = new URLSearchParams({ lname: ln, ...(fn ? { fname: fn } : {}), 'search1.x': '1', 'search1.y': '1' });
  const res = await proxyFetch(`${IN_BASE}?${qs.toString()}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`IN ${res.status}`);
  const html = await res.text();
  const out = [];
  for (const tr of (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    const idm = tr.match(/detail=(\d+)/); if (!idm) continue;
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((t) => stripTags(t[1]));
    const [rawName = '', docNum = '', dob = '', race = '', sex = '', facility = ''] = tds; // Name|DOC#|DOB|Race|Sex|Facility
    if (!rawName) continue;
    const comma = rawName.indexOf(',');
    const lastN = comma >= 0 ? clean(rawName.slice(0, comma)) : rawName;
    const firstN = comma >= 0 ? clean(rawName.slice(comma + 1)) : '';
    out.push({
      source: 'in-idoc', sourceName: 'Indiana DOC (IDOC)',
      firstName: firstN, lastName: lastN, name: clean(rawName),
      age: dobToAge(dob), gender: sex === 'M' ? 'male' : sex === 'F' ? 'female' : null,
      race: race || null, charges: [], mugshotUrl: null, bookingDate: null,
      // IDOC "Facility/Location" doubles as status: a unit name, or "Discharge"/"Parole"/"Escape"
      releaseStatus: /discharge|parole|release/i.test(facility) ? clean(facility) : null,
      facility: /discharge|parole|release|escape/i.test(facility) ? null : (clean(facility) || null),
      county: null, state: 'IN', inmateId: docNum || null,
    });
  }
  if (opts.includePhotos) { // enrich charge + county from the detail page (polite slice)
    for (const rec of out.slice(0, 3)) {
      try {
        const d = await proxyFetch(`${IN_BASE}?detail=${encodeURIComponent(rec.inmateId)}`, { headers: { 'User-Agent': UA } });
        if (!d.ok) continue;
        const cells = [...(await d.text()).matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => stripTags(c[1]));
        const val = (label) => { const i = cells.findIndex((c) => new RegExp(label, 'i').test(c)); return i >= 0 ? clean(cells[i + 1]) : null; };
        const offense = val('Description'), county = val('County\\s*of\\s*Conviction');
        if (offense && !/refers to/i.test(offense)) rec.charges = [offense];
        if (county && !/committing county/i.test(county)) rec.county = county;
      } catch { /* keep base record */ }
    }
  }
  return out;
}

// ── AL · ADOC ── classic ASP.NET WebForms: GET search page (VIEWSTATE + ASP.NET_SessionId) → POST name/AIS
//    (302; results in server session) → GET /InmateInfo.aspx grid (#gvInmateResults). MUGSHOT = /photos/
//    <AIS-no-leading-zeros>.jpg. List gives AIS/name/race/sex/birthYear/facility; charges + county live on the
//    detail postback (deferred). Age derived from birth year. lastName-only OK. Verified 2026-07-18.
async function AL(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://doc.alabama.gov';
  const hidden = (html, name) => { const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)); return m ? m[1].replace(/&amp;/g, '&') : ''; };
  const g = await fetch(`${BASE}/inmatesearch.aspx`, { headers: { 'User-Agent': UA } });
  if (!g.ok) throw new Error(`AL ${g.status}`);
  const page = await g.text();
  const sc = g.headers.getSetCookie ? g.headers.getSetCookie() : (g.headers.get('set-cookie') ? [g.headers.get('set-cookie')] : []);
  const cookie = sc.map((c) => c.split(';')[0]).find((c) => /ASP\.NET_SessionId=/.test(c)) || '';
  const body = new URLSearchParams({
    __EVENTTARGET: '', __EVENTARGUMENT: '', __LASTFOCUS: '',
    __VIEWSTATE: hidden(page, '__VIEWSTATE'), __VIEWSTATEGENERATOR: hidden(page, '__VIEWSTATEGENERATOR'), __EVENTVALIDATION: hidden(page, '__EVENTVALIDATION'),
    'ctl00$MainContent$txtAIS': '', 'ctl00$MainContent$txtFName': clean(query.firstName), 'ctl00$MainContent$txtLName': last, 'ctl00$MainContent$btnSearch': 'Search',
  });
  const p = await fetch(`${BASE}/inmatesearch.aspx`, { method: 'POST', redirect: 'manual', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie }, body });
  if (p.status !== 302) throw new Error(`AL search ${p.status}`); // results are staged in the server session on the 302
  const r = await fetch(`${BASE}/InmateInfo.aspx`, { headers: { 'User-Agent': UA, Cookie: cookie } });
  if (!r.ok) throw new Error(`AL ${r.status}`);
  const grid = ((await r.text()).match(/id="MainContent_gvInmateResults"[\s\S]*?<\/table>/) || [''])[0];
  const out = []; const thisYear = new Date().getFullYear();
  for (const row of (grid.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [])) {
    if (/<th/.test(row) || /btnNext|btnPrev|lblPages/.test(row)) continue;
    const tds = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(stripTags);
    if (tds.length < 8) continue; // AIS | Last, First Middle | Race | Sex | BirthYear | Facility | ReleaseDate | Code
    const [aisRaw, nameLastFirst, race, sex, birthYear, institution] = tds;
    const comma = nameLastFirst.indexOf(',');
    const lastN = comma >= 0 ? clean(nameLastFirst.slice(0, comma)) : nameLastFirst;
    const firstN = comma >= 0 ? clean(nameLastFirst.slice(comma + 1)) : '';
    const by = num(birthYear);
    out.push({
      source: 'al-adoc', sourceName: 'Alabama DOC',
      firstName: firstN, lastName: lastN, name: clean(nameLastFirst),
      age: by && by > 1900 ? thisYear - by : null,
      gender: /^m/i.test(sex) ? 'male' : /^f/i.test(sex) ? 'female' : null, race: race || null,
      charges: [], mugshotUrl: `${BASE}/photos/${aisRaw.replace(/^0+/, '')}.jpg`,
      bookingDate: null, releaseStatus: 'incarcerated', facility: clean(institution) || null,
      county: null, state: 'AL', inmateId: aisRaw,
    });
  }
  return out;
}

// Registry — direct-fetch: CA/PA/IL/WA/OH/NC/GA/MI/MD/IN/MN/AL. Captcha-gated (returns [] live until a vision
// solver is added): MO/CO. Browser-tier (BROWSER_SERVICE_URL): TX (live) / NY (WIP).
export const STATE_ADAPTERS = { TX, CA, PA, IL, NY, WA, OH, NC, GA, MI, MO, MD, CO, MN, IN, AL };
export const STATE_CODES = Object.keys(STATE_ADAPTERS);

// Browser-tier states run a ~15–30s headless-browser session (WAF/anti-bot). Too slow for the live request
// path — so we SKIP them there (serve from the `inmates` DB instead) and refresh the DB asynchronously
// (crawler + on-demand hydration). Direct-fetch states (CA/PA/IL) are fast and run live.
export const BROWSER_TIER = new Set(['TX', 'NY']);

/**
 * Query the state DOC adapter for `query.state`. Self-gating: returns [] when we have no adapter, no
 * lastName, the adapter errors, or (in the live path) the state is browser-tier. Never throws.
 * @param {object} [opts] { allowBrowser } — set by the crawler / hydration to run browser-tier states.
 */
export async function findStateInmates(query, env = process.env, opts = {}) {
  if (env.STATE_INMATES_DISABLED === '1') return [];
  const st = (query.state || '').toUpperCase();
  const fn = STATE_ADAPTERS[st];
  if (!fn || !clean(query.lastName)) return [];
  if (BROWSER_TIER.has(st) && !opts.allowBrowser) return []; // don't run the slow browser in the live path
  try { return await fn(query, { includePhotos: env.STATE_INMATES_PHOTOS === '1' }); } catch { return []; }
}

/**
 * Run the adapter with the browser allowed and write-through to the `inmates` table. For the crawler AND
 * on-demand hydration — call from the route's after() so a browser-tier search still refreshes the DB
 * (the searcher gets the cached rows now; the next searcher gets fresh ones). Never throws.
 * @returns {Promise<number>} rows upserted
 */
export async function hydrateStateInmates(query, env = process.env) {
  try {
    const recs = await findStateInmates(query, env, { allowBrowser: true });
    if (!recs.length) return 0;
    const { upsertInmates } = await import('./inmatesDb.mjs');
    return await upsertInmates(recs);
  } catch { return 0; }
}
