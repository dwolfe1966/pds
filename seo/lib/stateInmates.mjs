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
  // MN DOC serves an INCOMPLETE TLS chain (missing intermediate) → Node/undici rejects it
  // (UNABLE_TO_VERIFY_LEAF_SIGNATURE), even though curl accepts it. Scope a dispatcher that skips
  // verification for THIS host only (public read, no secrets sent) — never a global TLS-off.
  let dispatcher;
  try { const { Agent } = await import('undici'); dispatcher = new Agent({ connect: { rejectUnauthorized: false } }); } catch { dispatcher = undefined; }
  const F = (url, opts = {}) => fetch(url, dispatcher ? { ...opts, dispatcher } : opts);
  const jar = new Map();
  const absorb = (r) => { const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []); for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const ckh = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const land = await F(`${B}/`, { headers: { 'User-Agent': UA } });
  if (!land.ok) throw new Error(`MN ${land.status}`);
  absorb(land);
  const tok = ((await land.text()).match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/) || [])[1] || '';
  const form = new URLSearchParams({ rdogrp: '1', firstName: clean(query.firstName), lastName: last, oid: '' });
  if (tok) form.set('__RequestVerificationToken', tok);
  const post = await F(`${B}/Home/Index`, { method: 'POST', redirect: 'manual', headers: { 'User-Agent': UA, Cookie: ckh(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${B}/` }, body: form.toString() });
  absorb(post);
  const gr = await F(`${B}/SearchResults/GetOffenders////1`, { headers: { 'User-Agent': UA, Cookie: ckh(), 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json', Referer: `${B}/SearchResults` } });
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

// ── SC · SCDC ── clean JSON API (Struts .do). No auth/cookie/CSRF/captcha. POST inmateSearch.do with all
//    params on the query string → a JSON array. MUGSHOT ships INLINE as a base64 JPEG in `thumbnail` (data URI,
//    no hosted URL). offense/institution/offenseCounty/dates are detail-only (null in the list). Verified 2026-07-18.
async function SC(query) {
  const last = clean(query.lastName); if (!last) return [];
  const qs = new URLSearchParams({ lastName: last, firstName: clean(query.firstName), scdcId: '', sid: '', phoneticMatch: 'false' }).toString();
  const res = await fetch(`https://public.doc.state.sc.us/scdc-public/inmateSearch.do?${qs}`, {
    method: 'POST', headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'User-Agent': UA, Referer: 'https://public.doc.state.sc.us/scdc-public/' },
  });
  if (!res.ok) throw new Error(`SC ${res.status}`);
  const rows = await res.json().catch(() => null);
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const first = clean(r.fname), mid = clean(r.mname), lastN = clean(r.lname), sex = clean(r.sex);
    return {
      source: 'sc-scdc', sourceName: 'South Carolina DOC (SCDC)',
      firstName: first, lastName: lastN, name: [first, mid, lastN].filter(Boolean).join(' '),
      age: num(r.age), gender: /^m/i.test(sex) ? 'male' : /^f/i.test(sex) ? 'female' : null, race: clean(r.race) || null,
      charges: [], mugshotUrl: r.thumbnail ? `data:image/jpeg;base64,${r.thumbnail}` : null,
      bookingDate: null, releaseStatus: 'incarcerated', facility: clean(r.institution) || null,
      county: clean(r.offenseCounty) || null, state: 'SC', inmateId: clean(r.scdcId) || null,
    };
  });
}

// ── LA · LA DOC (VINE) ── doc.la.gov delegates to VINELink (Appriss/Equifax VINE). JSON API: bootstrap an
//    anonymous guest session (POST /accounts with an "Auth: Basic anonymous:<pw>" header — the header is
//    literally "Auth", not "Authorization"), capture x-vine-session-id + x-vine-jwt, then GET /persons. A
//    reCAPTCHA-v3 (score-based) fronts the SPA but the guest search returns live data with no token — pace
//    requests. Guest data is OBSCURED (DOB + booking#/contextRefId masked; mugshot is a signed, expiring URL).
//    VINE carries NO charges — custody STATUS only. Requires BOTH first + last (no wildcard roster). Verified 2026-07-18.
async function LA(query) {
  const last = clean(query.lastName); if (!last) return [];
  const API = 'https://vinelink-mobile.vineapps.com/api/v1';
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let pw = '';
  for (let i = 0; i < 12; i++) pw += cs[Math.floor(Math.random() * cs.length)]; pw += 'aA1!'; // satisfy complexity
  const base = { Accept: 'application/json', 'x-vine-application': 'VINELINK', 'x-vine-language': 'ENGLISH', 'User-Agent': UA, Referer: 'https://vinelink.vineapps.com/' };
  const acc = await fetch(`${API}/accounts`, { method: 'POST', headers: { ...base, 'Content-Type': 'application/json', Auth: `Basic ${Buffer.from(`anonymous:${pw}`).toString('base64')}`, Origin: 'https://vinelink.vineapps.com' }, body: JSON.stringify({ termsRead: false }) });
  if (!acc.ok) throw new Error(`LA ${acc.status}`);
  const sessionId = acc.headers.get('x-vine-session-id'), jwt = acc.headers.get('x-vine-jwt');
  const qs = new URLSearchParams();
  qs.set('siteRefId', 'LASWVINE'); qs.set('personLastName', last);
  if (clean(query.firstName)) qs.set('personFirstName', clean(query.firstName));
  qs.append('personContextTypes', 'offender'); qs.append('personContextTypes', 'defendant');
  qs.set('limit', '20'); qs.set('offset', '0'); qs.set('obscurePersonData', 'true');
  qs.set('includeJuveniles', 'false'); qs.set('includeSearchBlocked', 'false');
  qs.set('includeRegistrantInfo', 'true'); qs.set('addImageWatermark', 'true'); qs.set('language', 'ENGLISH');
  const res = await fetch(`${API}/persons?${qs.toString()}`, { headers: { ...base, 'x-vine-session-id': sessionId, 'x-vine-jwt': jwt } });
  if (!res.ok) throw new Error(`LA ${res.status}`);
  const data = await res.json().catch(() => null);
  const persons = (data && data._embedded && Array.isArray(data._embedded.persons)) ? data._embedded.persons : [];
  const gnorm = (g) => { const v = clean(g); return /^m/i.test(v) ? 'male' : /^f/i.test(v) ? 'female' : (v || null); };
  return persons.map((p) => {
    const nm = p.personName || {}; const locs = Array.isArray(p.locations) ? p.locations : [];
    const holding = locs.find((l) => l.locationType === 'HOLDING_FACILITY');
    const reporting = locs.find((l) => l.locationType === 'REPORTING_AGENCY');
    const oi = p.offenderInfo || {}, img = p.imageLinks || {}, cust = oi.custodyStatus || {};
    return {
      source: 'la-vine', sourceName: 'Louisiana DOC (VINE)',
      firstName: clean(nm.firstName), lastName: clean(nm.lastName),
      name: [nm.firstName, nm.middleName, nm.lastName].map(clean).filter(Boolean).join(' '),
      age: num(p.age), gender: gnorm((p.gender || {}).name || (p.gender || {}).code), race: clean((p.race || {}).name) || null,
      charges: [], mugshotUrl: img.desktopImageLink || (p._links && p._links.desktopImage && p._links.desktopImage.href) || img.mobileImageLink || img.thumbnailImageLink || null,
      bookingDate: null, releaseStatus: clean(cust.name || cust.code) || null,
      facility: clean(oi.custodyDetail) || (holding && clean(holding.locationName)) || (reporting && clean(reporting.locationName)) || null,
      county: (reporting && clean(reporting.locationName)) || null,
      state: 'LA', inmateId: clean((p.personContext || {}).contextRefId) || null, // guest-obscured (10005*****); not stable for dedup
    };
  });
}

// ── KY · KOOL ── ASP.NET MVC, plain GET, server-rendered HTML. No captcha/CSRF/auth/cookie. GET "/" with
//    returnResults=True renders the results table (skip the 302 from AdvancedSearchWithAnchor). MUGSHOT is a
//    plain URL (Content/OffenderPhotos/<PID zero-padded to 7>.jpg) when a Camera.gif marker is present. Charges
//    arrive as offense-category summaries ("Dangerous Drugs(1)"); full per-offense detail is on /KOOL/Details/{PID}.
//    sortOrder MUST be an exact enum string or it 500s. Verified 2026-07-18. Fully enumerable (sequential PID).
async function KY(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://kool.corrections.ky.gov';
  const qs = new URLSearchParams({ returnResults: 'True', showAdvancedOptions: 'False', sortOrder: 'Last Name, First Name', lastName: last, firstName: clean(query.firstName), middleName: '', searchAliases: 'False', onlyPhotoRecords: 'False' }).toString();
  const res = await fetch(`${BASE}/?${qs}`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`KY ${res.status}`);
  const html = await res.text();
  const out = [];
  const rowRe = /<a href="\/KOOL\/Details\/(\d+)">([^<]*)<\/a>([\s\S]*?)(?=<a href="\/KOOL\/Details\/\d+">|<\/table>)/g; let m;
  while ((m = rowRe.exec(html)) !== null) {
    const pid = m[1], disp = stripTags(m[2]), chunk = m[3];
    const comma = disp.indexOf(',');
    const lastN = comma >= 0 ? clean(disp.slice(0, comma)) : disp;
    const firstN = comma >= 0 ? clean(disp.slice(comma + 1)) : '';
    const loc = chunk.match(/target="_blank"[^>]*>([^<]+)<\/a>/);
    const charges = (chunk.match(/([A-Za-z][A-Za-z ]+\(\d+\))/g) || []).map(clean);
    out.push({
      source: 'ky-doc', sourceName: 'Kentucky DOC (KOOL)',
      firstName: firstN, lastName: lastN, name: [firstN, lastN].filter(Boolean).join(' '),
      age: null, gender: null, race: null, charges,
      mugshotUrl: /Camera\.gif/i.test(chunk) ? `${BASE}/Content/OffenderPhotos/${pid.padStart(7, '0')}.jpg` : null,
      bookingDate: null, releaseStatus: null, facility: loc ? clean(loc[1]) : null, county: null,
      state: 'KY', inmateId: pid,
    });
  }
  return out;
}

// ── OR · ODOC (OOS) ── JSF (JavaServer Faces) postback. No captcha/WAF. GET searchCriteria.jsf → JSESSIONID +
//    javax.faces.ViewState + a form action carrying ;jsessionid=…, then POST the name criteria. List row cols:
//    SID | First | Middle | Last | DOB(MM/YYYY). NOT enumerable: a broad/surname-only search returns "Too many
//    results to display" → [] (needs a first name). Age from DOB. facility/charges/race/gender + mugshot
//    (imageLoader.jsp?idno=SID needs the session cookie, so null here) are detail-only postbacks. Verified 2026-07-18.
async function OR(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://docpub.state.or.us';
  const dec = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const g = await fetch(`${BASE}/OOS/searchCriteria.jsf`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!g.ok) throw new Error(`OR ${g.status}`);
  const sc = g.headers.getSetCookie ? g.headers.getSetCookie() : (g.headers.get('set-cookie') ? [g.headers.get('set-cookie')] : []);
  const cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const gh = await g.text();
  const viewState = dec((gh.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]*)"/) || [])[1] || '');
  const action = dec((gh.match(/action="([^"]*searchCriteria\.jsf[^"]*)"/) || [])[1] || '/OOS/searchCriteria.jsf');
  if (!viewState) throw new Error('OR ViewState missing');
  const form = new URLSearchParams({ mainBodyForm: 'mainBodyForm', 'mainBodyForm:FirstName': clean(query.firstName), 'mainBodyForm:MiddleName': '', 'mainBodyForm:LastName': last, 'mainBodyForm:SidNumber': '', 'mainBodyForm:sendQuery': 'Search', 'javax.faces.ViewState': viewState });
  const s = await fetch(`${BASE}${action}`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Accept: 'text/html', Referer: `${BASE}/OOS/searchCriteria.jsf` }, body: form.toString() });
  if (!s.ok) throw new Error(`OR ${s.status}`);
  const html = await s.text();
  if (/Too many results to display/i.test(html)) return [];
  const ageFromDob = (d) => { const mm = /(\d{1,2})\/(\d{4})/.exec(String(d || '')); if (!mm) return null; const t = new Date(); let a = t.getFullYear() - Number(mm[2]); if (t.getMonth() + 1 < Number(mm[1])) a--; return a > 0 && a < 120 ? a : null; };
  const out = [];
  for (const row of (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    if (!/foundOffenders:\d+:/.test(row)) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
    if (cells.length < 5) continue; // SID | First | Middle | Last | DOB(MM/YYYY)
    const [sid, firstN, mid, lastN, dob] = cells;
    if (!sid) continue;
    out.push({
      source: 'or-odoc', sourceName: 'Oregon DOC (OOS)',
      firstName: clean(firstN), lastName: clean(lastN), name: [firstN, mid, lastN].map(clean).filter(Boolean).join(' '),
      age: ageFromDob(dob), gender: null, race: null, charges: [], mugshotUrl: null,
      bookingDate: null, releaseStatus: null, facility: null, county: null, state: 'OR', inmateId: clean(sid) || null,
    });
  }
  return out;
}

// ── UT · UDC ── OPEN JSON API on the api.utah.gov gateway. No auth/key/cookie/captcha; CORS *. GET name search →
//    {results:[{offenderNumber,offenderName:"LAST, FIRST MIDDLE",dateOfBirth}]}. UDC has NO photos anywhere.
//    facility/status are detail-only (keyed by offenderNumber). age derived from DOB. Verified 2026-07-18.
async function UT(query) {
  const last = clean(query.lastName); if (!last) return [];
  const url = `https://api.utah.gov/udc/v1/public/rest/offenders/name?first=${encodeURIComponent(clean(query.firstName))}&last=${encodeURIComponent(last)}&index=0&pageCount=100`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA, Referer: 'https://corrections.utah.gov/' } });
  if (!res.ok) throw new Error(`UT ${res.status}`);
  const body = await res.json().catch(() => null);
  const rows = (body && Array.isArray(body.results)) ? body.results : [];
  const ageFromDob = (d) => { const mm = /(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (!mm) return null; const t = new Date(); let a = t.getFullYear() - Number(mm[1]); if (t.getMonth() + 1 < Number(mm[2]) || (t.getMonth() + 1 === Number(mm[2]) && t.getDate() < Number(mm[3]))) a--; return a > 0 && a < 120 ? a : null; };
  return rows.map((r) => {
    const nm = clean(r.offenderName), comma = nm.indexOf(','); // "LAST, FIRST MIDDLE"
    const lastN = comma >= 0 ? clean(nm.slice(0, comma)) : nm;
    const firstN = comma >= 0 ? clean(nm.slice(comma + 1)).split(/\s+/)[0] : '';
    return {
      source: 'ut-udc', sourceName: 'Utah DOC (UDC)',
      firstName: firstN, lastName: lastN, name: nm,
      age: ageFromDob(r.dateOfBirth), gender: null, race: null,
      charges: [], mugshotUrl: null, bookingDate: null, releaseStatus: null,
      facility: null, county: null, state: 'UT', inmateId: r.offenderNumber != null ? String(r.offenderNumber) : null,
    };
  });
}

// ── NV · NDOC ── plain server-side POST form (no captcha/CSRF/cookie/JS). POST fname/lname/submit=true → an
//    HTML results table (under the "Search Results" caption), CAPPED at 20 rows; cols: OffenderID(form) | First |
//    Middle | Last | Gender | Institution. Each row's ID cell is a mini <form> POSTing onumber for the detail page
//    (charges + a base64 mugshot live there — detail-only, not fetched live). Bulk TSVs at download_offender_data/*.csv.
//    Verified 2026-07-18.
async function NV(query) {
  const last = clean(query.lastName); if (!last) return [];
  const body = new URLSearchParams({ onumber: '', fname: clean(query.firstName), lname: last, submit: 'true' }).toString();
  const res = await fetch('https://ofdsearch.doc.nv.gov/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body });
  if (!res.ok) throw new Error(`NV ${res.status}`);
  const html = await res.text();
  const cap = html.indexOf('Search Results');
  const ts = cap >= 0 ? html.lastIndexOf('<table', cap) : -1;
  const tbl = ts >= 0 ? html.slice(ts, html.indexOf('</table>', cap) + 8) : '';
  const out = [];
  for (const row of (tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    const idm = row.match(/name="onumber"\s+value="?(\d+)"?/i); if (!idm) continue; // skip header row
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
    const firstN = cells[1] || '', mid = cells[2] || '', lastN = cells[3] || '', sex = cells[4] || '';
    out.push({
      source: 'nv-ndoc', sourceName: 'Nevada DOC (NDOC)',
      firstName: firstN, lastName: lastN, name: [firstN, mid, lastN].filter(Boolean).join(' '),
      age: null, gender: /^m/i.test(sex) ? 'male' : /^f/i.test(sex) ? 'female' : null, race: null,
      charges: [], mugshotUrl: null, bookingDate: null, releaseStatus: null,
      facility: clean(cells[5]) || null, county: null, state: 'NV', inmateId: idm[1],
    });
  }
  return out;
}

// ── AR · ADC ── Laravel app behind CloudFront. GET homepage (Laravel _token + XSRF-TOKEN/inmate_search_session
//    cookies, both `secure`) → GET /index.php/results with the COMPLETE form field set. CloudFront emits http://
//    redirect URLs, but the secure cookies won't ride http → a naive follow bounces http↔https forever, dropping
//    the session. We mirror the browser's HSTS upgrade: manual redirect + rewrite every http:// Location to https.
//    Omit a field and the `results` route does a canonicalization 302 (→ same loop) — so send ALL fields. HTML
//    table (Name|DC#|Race|Gender|PE-TE|Facility|BirthDate). MUGSHOT = predictable cloudfront /prod/inmate/{dc}.jpg.
//    A unique/dc_num hit 302s straight to the detail page (list-only live). Verified 2026-07-18.
async function AR(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://inmate.ark.org', MUG = 'https://d2do6krhnt2rgj.cloudfront.net/prod/inmate';
  const jar = new Map();
  const absorb = (r) => { const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []); for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const ckh = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  // fetch that survives the CloudFront http↔https downgrade loop (manual redirect + HSTS-style upgrade each hop)
  const hop = async (url) => { let cur = url; for (let i = 0; i < 6; i++) { const r = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', ...(ckh() ? { Cookie: ckh() } : {}) } }); absorb(r); if (r.status >= 300 && r.status < 400) { const loc = r.headers.get('location'); if (!loc) return r; cur = new URL(loc, cur).href.replace(/^http:\/\//i, 'https://'); continue; } return r; } throw new Error('AR redirect loop'); };
  const home = await hop(`${BASE}/`); if (!home.ok) throw new Error(`AR ${home.status}`);
  const token = ((await home.text()).match(/name="_token"\s+value="([^"]+)"/i) || [])[1] || '';
  const p = new URLSearchParams({ _token: token, dc_num: '', county: '0', last_name: last, first_name: clean(query.firstName), facility: '0', crime: '0', age_type: '1', age: '', ethnicity: '0', disclaimer: '1', B1: 'Search' });
  const res = await hop(`${BASE}/index.php/results?${p.toString()}`); if (!res.ok) throw new Error(`AR ${res.status}`);
  const html = await res.text();
  const ageFromDob = (d) => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(d || '')); if (!m) return null; const t = new Date(); let a = t.getFullYear() - Number(m[3]); if (t.getMonth() + 1 < Number(m[1]) || (t.getMonth() + 1 === Number(m[1]) && t.getDate() < Number(m[2]))) a--; return a > 0 && a < 120 ? a : null; };
  const out = [];
  for (const tr of (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
    if (tds.length < 7) continue; // (photo) | Name(Last, First) | DC# | Race | Gender | PE-TE | Facility | BirthDate
    const nm = tds[1]; if (!nm || !/[A-Za-z]/.test(nm)) continue;
    const dc = tds[2]; if (!dc) continue;
    const comma = nm.indexOf(','), sex = tds[4];
    const lastN = comma >= 0 ? clean(nm.slice(0, comma)) : nm;
    const firstN = comma >= 0 ? clean(nm.slice(comma + 1)) : '';
    out.push({
      source: 'ar-adoc', sourceName: 'Arkansas DOC (ADC)',
      firstName: firstN, lastName: lastN, name: [firstN, lastN].filter(Boolean).join(' ') || clean(nm),
      age: ageFromDob(tds[7]), gender: /^f/i.test(sex) ? 'female' : /^m/i.test(sex) ? 'male' : null, race: tds[3] || null,
      charges: [], mugshotUrl: `${MUG}/${dc}.jpg`, bookingDate: null, releaseStatus: 'incarcerated',
      facility: tds[6] || null, county: null, state: 'AR', inmateId: dc,
    });
  }
  return out;
}

// ── MS · MDOC ── ASP.NET MVC, session-stateful, no CSRF/captcha. GET /Search/Index (session cookie) → POST
//    /Search/Index name mode (302 → GetSearchResults) → GET the results grid (#SearchResults: ID|Last|First|
//    Location|Term|Offense). Charges = the row's primary Offense string. Mugshot/DOB/county are detail-only
//    (null live). A unique surname 302s straight to GetDetails/<id> — one minimal fetch salvages that lone row.
//    Verified 2026-07-18. Enumerable by sequential MDOC ID (name search caps near 400 for common surnames).
async function MS(query) {
  const last = clean(query.lastName); if (!last) return [];
  const BASE = 'https://www.ms.gov/mdoc/inmate';
  const jar = new Map();
  const absorb = (r) => { const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []); for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const ckh = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  absorb(await fetch(`${BASE}/Search/Index`, { redirect: 'manual', headers: { 'User-Agent': UA, Cookie: ckh() } }));
  const post = await fetch(`${BASE}/Search/Index`, { method: 'POST', redirect: 'manual', headers: { 'User-Agent': UA, Cookie: ckh(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ SearchCriteria: 'name', LastName: last, FirstName: clean(query.firstName), MdocId: '', ClickEvent: 'SEARCH >>' }).toString() });
  absorb(post);
  const loc = post.headers.get('location') || `${BASE}/Search/GetSearchResults`;
  const single = loc.match(/GetDetails\/(\d+)/); // a unique surname jumps straight to the detail sheet
  if (single) {
    const d = await fetch(`${BASE}/Search/GetDetails/${single[1]}`, { headers: { 'User-Agent': UA, Cookie: ckh() } });
    if (!d.ok) throw new Error(`MS ${d.status}`);
    const dh = await d.text();
    const nm = stripTags((dh.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) || [])[1] || ''), parts = nm.split(/\s+/);
    const mug = (dh.match(/GetImage\?path=[^"'&\s]+/i) || [])[0];
    return [{
      source: 'ms-mdoc', sourceName: 'Mississippi DOC (MDOC)',
      firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', name: nm || null,
      age: null, gender: null, race: null, charges: [], mugshotUrl: mug ? `${BASE}/Search/${mug}` : null,
      bookingDate: null, releaseStatus: null, facility: null, county: null, state: 'MS', inmateId: single[1],
    }];
  }
  const lr = await fetch(loc.startsWith('http') ? loc : `${BASE}/Search/GetSearchResults`, { headers: { 'User-Agent': UA, Cookie: ckh() } });
  if (!lr.ok) throw new Error(`MS ${lr.status}`);
  const html = await lr.text();
  const tbody = (html.match(/<tbody[\s\S]*?<\/tbody>/i) || [html])[0];
  const out = [];
  for (const row of (tbody.match(/<tr[\s\S]*?<\/tr>/gi) || [])) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
    if (cells.length < 6 || !/^\d+$/.test(cells[0])) continue; // ID | Last | First | Location | Term | Offense
    const [id, lastN, firstN, facility, , offense] = cells;
    out.push({
      source: 'ms-mdoc', sourceName: 'Mississippi DOC (MDOC)',
      firstName: clean(firstN), lastName: clean(lastN), name: [clean(firstN), clean(lastN)].filter(Boolean).join(' '),
      age: null, gender: null, race: null, charges: offense ? [offense] : [], mugshotUrl: null,
      bookingDate: null, releaseStatus: null, facility: facility || null, county: null, state: 'MS', inmateId: id,
    });
  }
  return out;
}

// ── NE · NDCS ── the interactive name search is reCAPTCHA-gated, but NDCS publishes the FULL active roster as a
//    captcha-free .xlsx (InmateExcelDownloadActiveRetrievalServlet, ~3MB, ~8.5k in custody/parole/post-release/
//    absconder/escape). We download once (6h module cache), parse SpreadsheetML by hand (inline strings; zlib
//    inflate), join the master + offense sheets on ID, and filter client-side (prefix match). No mugshots. Fully
//    enumerable. ⚠️ pulls ~3MB per COLD query (serverless cold starts may not keep the cache warm → slower than
//    the other direct-fetch states). Verified 2026-07-18.
let _neRoster = { at: 0, people: null };
async function NE(query) {
  const last = clean(query.lastName); if (!last) return [];
  const now = Date.now();
  if (!_neRoster.people || now - _neRoster.at > 6 * 60 * 60 * 1000) {
    const zlib = await import('node:zlib');
    const res = await fetch('https://dcs-inmatesearch.ne.gov/Corrections/InmateExcelDownloadActiveRetrievalServlet', { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`NE ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    // minimal ZIP reader (xlsx central directory) — inflate each stored member
    const files = {}; let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('NE not a zip');
    const cdCount = buf.readUInt16LE(eocd + 10); let pp = buf.readUInt32LE(eocd + 16);
    for (let n = 0; n < cdCount; n++) {
      if (buf.readUInt32LE(pp) !== 0x02014b50) break;
      const method = buf.readUInt16LE(pp + 10), compSize = buf.readUInt32LE(pp + 20), nameLen = buf.readUInt16LE(pp + 28), extraLen = buf.readUInt16LE(pp + 30), commentLen = buf.readUInt16LE(pp + 32), localOff = buf.readUInt32LE(pp + 42);
      const name = buf.toString('utf8', pp + 46, pp + 46 + nameLen);
      const dataStart = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
      const comp = buf.subarray(dataStart, dataStart + compSize);
      files[name] = method === 0 ? comp : zlib.inflateRawSync(comp);
      pp += 46 + nameLen + extraLen + commentLen;
    }
    const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
    const colIdx = (ref) => { const mm = /^([A-Z]+)/.exec(ref); let c = 0; for (const ch of mm[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; };
    const parseSheet = (xml) => { const rows = []; const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g; let rm; while ((rm = rowRe.exec(xml))) { const cells = []; const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let cm; while ((cm = cellRe.exec(rm[1]))) { const attrs = cm[1], inner = cm[2] || ''; const refM = /r="([A-Z]+\d+)"/.exec(attrs); const idx = refM ? colIdx(refM[1]) : cells.length; const t = /t="([^"]+)"/.exec(attrs); let val = ''; if (t && t[1] === 'inlineStr') { const im = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner); val = im ? decodeXml(im[1]) : ''; } else { const vm = /<v>([\s\S]*?)<\/v>/.exec(inner); val = vm ? decodeXml(vm[1]) : ''; } cells[idx] = val; } rows.push(cells); } return rows; };
    const intId = (v) => { const s = clean(v); const nn = parseFloat(s); return Number.isFinite(nn) ? String(Math.round(nn)) : s; };
    const titleCase = (s) => clean(s).toLowerCase().replace(/\b([a-z])/g, (mm) => mm.toUpperCase());
    const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
    const excelDate = (v) => { const s = clean(v); if (!s) return ''; if (!/^\d+(\.0+)?$/.test(s)) return s; const serial = parseFloat(s); if (serial < 60 || serial > 80000) return s; const d = new Date(EXCEL_EPOCH + serial * 86400000); return isNaN(d) ? s : d.toISOString().slice(0, 10); };
    const ageFromSerial = (v) => { const iso = excelDate(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null; const d = new Date(iso); if (isNaN(d)) return null; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--; return a >= 0 && a < 130 ? a : null; };
    const master = parseSheet(files['xl/worksheets/sheet1.xml'].toString('utf8')).slice(1);
    const offense = parseSheet(files['xl/worksheets/sheet2.xml'].toString('utf8')).slice(1);
    const offBy = new Map(); // offense cols: 0 ID | 10 CHARGE DESC | 12 FELONY/MSDMNR | 17 COUNTY COMMITTED
    for (const r of offense) { const id = intId(r[0]); if (!id) continue; if (!offBy.has(id)) offBy.set(id, []); offBy.get(id).push({ charge: clean(r[10]), cls: clean(r[12]), county: clean(r[17]) }); }
    // master cols: 0 ID | 5/1 LEGAL/COMMITTED LAST | 6/2 FIRST | 7/3 MIDDLE | 9 DOB | 10 RACE | 11 GENDER | 12 FACILITY | 15 SENTENCE BEGIN | 29 STATUS
    _neRoster = { at: now, people: master.filter((r) => clean(r[0])).map((r) => {
      const id = intId(r[0]), sex = clean(r[11]), offs = offBy.get(id) || [];
      const lastN = titleCase(clean(r[5]) || clean(r[1])), firstN = titleCase(clean(r[6]) || clean(r[2])), mid = titleCase(clean(r[7]) || clean(r[3]));
      return {
        source: 'ne-ndcs', sourceName: 'Nebraska DOC (NDCS)',
        firstName: firstN, lastName: lastN, name: [firstN, mid, lastN].filter(Boolean).join(' '),
        age: ageFromSerial(r[9]), gender: /^f/i.test(sex) ? 'female' : /^m/i.test(sex) ? 'male' : null, race: titleCase(r[10]) || null,
        charges: offs.map((o) => o.charge + (o.cls ? ` (${titleCase(o.cls)})` : '')).filter(Boolean),
        mugshotUrl: null, bookingDate: excelDate(r[15]) || null, releaseStatus: clean(r[29]) || null,
        facility: titleCase(r[12]) || null, county: titleCase((offs.find((o) => o.county) || {}).county) || null,
        state: 'NE', inmateId: id,
      };
    }) };
  }
  const ln = last.toLowerCase(), fn = clean(query.firstName).toLowerCase();
  return _neRoster.people.filter((p) => (!ln || p.lastName.toLowerCase().startsWith(ln)) && (!fn || p.firstName.toLowerCase().startsWith(fn)));
}

// ── ID · IDOC ── Drupal resident/client search, plain GET (no cookie/CSRF/captcha/JS). last_name (or number)
//    ≥3 chars required. HTML table: IDOC# | Last | First | Middle | BirthYear | Status ("In custody"/"In
//    community"/"Discharged …"). Birth YEAR only (age approx); no sex/race/facility/county/charges/mugshot.
//    Enumerable (prefix sweep + &page=N; 100/page — we take page 0 live). Verified 2026-07-18.
async function ID(query) {
  const last = clean(query.lastName); if (!last || last.length < 3) return []; // IDOC requires a ≥3-char last name
  const url = `https://www.idoc.idaho.gov/content/prisons/resident-client-search/results?last_name=${encodeURIComponent(last)}&first_name=${encodeURIComponent(clean(query.firstName))}&number=&page=0`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`ID ${res.status}`);
  const html = await res.text();
  const clip = (s) => stripTags(String(s || '').replace(/<div class="col-header">[^<]*<\/div>/gi, '')); // drop mobile label div
  const out = []; const thisYear = new Date().getFullYear();
  for (const part of html.split(/<tr role="row"><td headers="item\d+ columnheader1"/i).slice(1)) {
    const chunk = part.slice(0, part.indexOf('</tr>'));
    const firstCell = chunk.slice(0, chunk.indexOf('</td>'));
    const idoc = clip(firstCell.slice(firstCell.indexOf('>') + 1));
    const cell = (n) => { const m = chunk.match(new RegExp('columnheader' + n + '"[^>]*>([\\s\\S]*?)</td>', 'i')); return m ? clip(m[1]) : ''; };
    const lastN = cell(2), firstN = cell(3), mid = cell(4), yr = parseInt(cell(5), 10);
    if (!idoc && !lastN) continue;
    out.push({
      source: 'id-idoc', sourceName: 'Idaho DOC (IDOC)',
      firstName: firstN, lastName: lastN, name: [firstN, mid, lastN].filter(Boolean).join(' '),
      age: Number.isFinite(yr) ? thisYear - yr : null, gender: null, race: null,
      charges: [], mugshotUrl: null, bookingDate: null, releaseStatus: cell(9) || null,
      facility: null, county: null, state: 'ID', inmateId: idoc || null,
    });
  }
  return out;
}

// ── HI · DCR (SAVIN/VINE) ── the old HI DOC locator is decommissioned; custody-status lookups go to Hawai'i
//    SAVIN on VINELink (Appriss/Equifax). Guest JSON REST (HAL) — no auth/session/captcha. GET /guest/persons
//    with siteRefId=HISWVINE; personLastName ≥2 chars REQUIRED (x-vine-language MUST be the full word ENGLISH).
//    Guest data is masked (id → "A611****"; mugshot is a signed/expiring bewit URL). VINE carries custody STATUS
//    + facility + gender + mugshot only — no age/race/charges/county. Not enumerable. Verified 2026-07-18.
async function HI(query) {
  const last = clean(query.lastName); if (!last || last.length < 2) return []; // VINE needs a ≥2-char last name
  const API = 'https://vinelink-mobile.vineapps.com/api/v1';
  const qs = new URLSearchParams({ siteRefId: 'HISWVINE', personLastName: last, searchType: 'OFFENDER', isPartialSearch: 'true', offset: '0', limit: '25', obscurePersonData: 'true' });
  if (clean(query.firstName)) qs.set('personFirstName', clean(query.firstName));
  qs.append('personContextTypes', 'offender');
  const res = await fetch(`${API}/guest/persons?${qs.toString()}`, { headers: { Accept: 'application/json', 'x-vine-application': 'VINELINK', 'x-vine-language': 'ENGLISH', 'User-Agent': UA, Origin: 'https://vinelink.vineapps.com', Referer: 'https://vinelink.vineapps.com/' } });
  if (!res.ok) throw new Error(`HI ${res.status}`);
  const data = await res.json().catch(() => null);
  const persons = (data && data._embedded && Array.isArray(data._embedded.persons)) ? data._embedded.persons : [];
  const gnorm = (g) => { const v = clean(g); return /^m/i.test(v) ? 'male' : /^f/i.test(v) ? 'female' : (v || null); };
  return persons.map((p) => {
    const nm = p.personName || {}, img = p.imageLinks || {}, oi = p.offenderInfo || {}, cust = oi.custodyStatus || {};
    const holding = (Array.isArray(p.locations) ? p.locations : []).find((l) => l.locationType === 'HOLDING_FACILITY');
    return {
      source: 'hi-savin', sourceName: 'Hawaii DCR (VINE)',
      firstName: clean(nm.firstName), lastName: clean(nm.lastName),
      name: [nm.firstName, nm.middleName, nm.lastName].map(clean).filter(Boolean).join(' '),
      age: null, gender: gnorm((p.gender || {}).name || (p.gender || {}).code), race: null,
      charges: [], mugshotUrl: img.desktopImageLink || img.mobileImageLink || img.thumbnailImageLink || (p._links && p._links.desktopImage && p._links.desktopImage.href) || null,
      bookingDate: null, releaseStatus: clean(cust.name || cust.code) || null,
      facility: clean(oi.custodyDetail) || (holding && clean(holding.locationName)) || null,
      county: null, state: 'HI', inmateId: clean(p.displayId || (p.personContext || {}).contextRefId) || null,
    };
  });
}

// Registry — direct-fetch (last-name OK): CA/PA/IL/WA/OH/NC/GA/MI/MD/IN/MN/AL/SC/KY/UT/NV/AR/MS/ID/HI, plus OR/LA
// (need a first name: OR trips a "too many results" cap on a bare surname; LA/VINE has no wildcard roster). NE
// fetches the full captcha-free roster xlsx (~3MB per cold query, 6h cache) and filters client-side. Captcha-gated
// (returns [] live until a vision solver is added): MO/CO. Browser-tier (BROWSER_SERVICE_URL): TX (live) / NY (WIP).
export const STATE_ADAPTERS = { TX, CA, PA, IL, NY, WA, OH, NC, GA, MI, MO, MD, CO, MN, IN, AL, SC, LA, KY, OR, UT, NV, AR, MS, NE, ID, HI };
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
