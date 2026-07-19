// Captcha/browser-gated state DOC inmate adapters (the "captcha wave" — docs/incarceration-data-strategy).
// These 6 states hide their inmate locator behind a captcha (reCAPTCHA v2 or an image/shape challenge) and
// were reverse-engineered + tested standalone in scratchpad *-final.mjs before being folded in here. Each is
// exported as a NAMED async adapter matching the normalized BookingRecord shape used by stateInmates.mjs:
//   { source, sourceName, firstName, lastName, name, age, gender, race, charges[], mugshotUrl,
//     bookingDate, releaseStatus, facility, county, state, inmateId }
//
// Adapters: OK (reCAPTCHA v2), NM (reCAPTCHA v2), KS (reCAPTCHA v2), WI (reCAPTCHA v2 entry gate),
//           CO (shape-count image captcha), DE (VINE — no captcha, fast/live).
//
// Shared helpers (UA/clean/num/stripTags/ageFromDob/capKey) are defined ONCE at module scope — the
// standalone -final.mjs files each declared their own; deduped here to avoid duplicate-declaration errors.
// `clean` is OK's tag+entity-stripping superset (a no-op on the other 5's already-stripped/JSON inputs, and
// required for OK's HTML-cell parser); adapter-private constants/helpers that collided (BASE, SITEKEY,
// makeJar, splitName, parseDetail, …) are prefixed per-adapter.

import { solveRecaptcha, solveImageCaptcha } from './captchaSolver.mjs';

// ── shared helpers (declared ONCE) ─────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
// OK's clean: decode common entities, strip tags, collapse whitespace. Superset of the whitespace-only
// `clean` the other adapters shipped with (safe: their inputs are pre-stripped or plain JSON strings).
const clean = (s) => (s == null ? '' : String(s)).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const num = (s) => { const m = String(s == null ? '' : s).match(/\d+/); return m ? Number(m[0]) : null; };
const stripTags = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const titleCase = (s) => clean(s).toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
// Normalize CAPTCHA_SOLVER_KEY against paste errors (stray leading `=`, quotes, whitespace) — 32 hex chars.
const capKey = () => (process.env.CAPTCHA_SOLVER_KEY || '').trim().replace(/^["'=\s]+/, '').replace(/["'\s]+$/, '');
// MM/DD/YYYY -> age (years), or null.
function ageFromDob(dob) {
  const m = (dob || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null;
  const b = new Date(+m[3], +m[1] - 1, +m[2]); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// OK — Oklahoma DOC "OK Offender" inmate locator. Classic ASP.NET WebForms (IIS/.NET). No WAF.
//   FLOW: GET /Search -> accept disclaimer postback -> reCAPTCHA v2 -> solve -> POST name search.
//   Requires BOTH first + last name (last-only over-broadens). Mugshots via /Image.ashx.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const OK_BASE = 'https://okoffender.doc.ok.gov';
const OK_SITEKEY = '6Lf9rxYUAAAAAONGkGNFMyG60E2o__uRRIyUTyoI';

// tiny cookie jar (Node global fetch does not persist cookies across calls)
function okMakeJar() {
  const jar = {};
  return {
    header() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); },
    absorb(res) {
      const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie')].filter(Boolean);
      for (const line of raw) { const [p] = line.split(';'); const i = p.indexOf('='); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
    },
  };
}
async function okGet(url, jar) { const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: jar.header() }, redirect: 'follow' }); jar.absorb(r); return r.text(); }
async function okPost(url, jar, form) {
  const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, Cookie: jar.header(), 'Content-Type': 'application/x-www-form-urlencoded', Origin: OK_BASE, Referer: url }, body: new URLSearchParams(form).toString(), redirect: 'follow' });
  jar.absorb(r); return r.text();
}
const okPick = (html, name) => (html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)) || [])[1] || '';
const okTokens = (html) => ({ __VIEWSTATE: okPick(html, '__VIEWSTATE'), __VIEWSTATEGENERATOR: okPick(html, '__VIEWSTATEGENERATOR'), __EVENTVALIDATION: okPick(html, '__EVENTVALIDATION') });

// "Last, First M" -> "First M Last"; also returns split first/last
function splitNameOK(raw) {
  const s = clean(raw); const c = s.indexOf(',');
  if (c === -1) { const p = s.split(/\s+/); return { name: s, firstName: p[0] || '', lastName: p.slice(1).join(' ') }; }
  const last = s.slice(0, c).trim(); const rest = s.slice(c + 1).trim();
  return { name: `${rest} ${last}`.trim(), firstName: rest.split(/\s+/)[0] || '', lastName: last };
}

// Parse the gvOffenders GridView. Header: [img] | OK DOC # | Name("Last, First M") | Gender | Race | DOB | Facility
function parseGrid(html) {
  const out = [];
  for (const m of (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [])) {
    if (!/lbDOCNum_\d+/.test(m)) continue; // data rows only
    const tds = [...m.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => x[1]);
    if (tds.length < 7) continue;
    const img = m.match(/Image\.ashx\?ID=(\d+)&(?:amp;)?Code=([0-9]+)/);
    const docNum = clean((tds[1].match(/>([^<]+)<\/a>/) || [])[1] || tds[1]);
    const nm = splitNameOK(tds[2]);
    const dob = clean(tds[5]);
    const sex = clean(tds[3]);
    const facCell = clean(tds[6]);
    const inactive = /^inactive$/i.test(facCell);
    out.push({
      source: 'ok-doc', sourceName: 'Oklahoma DOC (OK Offender)',
      firstName: nm.firstName, lastName: nm.lastName, name: nm.name,
      age: ageFromDob(dob),
      gender: /^m/i.test(sex) ? 'male' : /^f/i.test(sex) ? 'female' : null,
      race: clean(tds[4]) || null,
      charges: [], // list view has none; detail postback carries a Sentences table
      mugshotUrl: img ? `${OK_BASE}/Image.ashx?ID=${img[1]}&Code=${img[2]}` : null,
      bookingDate: null, // not in list view (detail "Reception Date")
      releaseStatus: inactive ? 'Inactive' : 'In Custody',
      facility: inactive ? null : (facCell || null),
      county: null, // site never exposes county
      state: 'OK', inmateId: docNum,
    });
  }
  return out;
}

// Establish session + accept disclaimer -> returns { jar, url, html } of the live (captcha'd) search form.
async function okBoot(fugitives = false) {
  const jar = okMakeJar();
  const url = `${OK_BASE}/Search${fugitives ? '?Fugitives=true' : ''}`;
  let html = await okGet(url, jar);
  if (/cmdAcceptDisclaimer/.test(html)) {
    html = await okPost(url, jar, { __EVENTTARGET: '', __EVENTARGUMENT: '', ...okTokens(html), 'ctl00$cphMain$cmdAcceptDisclaimer': 'Accept' });
  }
  return { jar, url, html };
}

/**
 * OK adapter. query = { firstName, lastName, docNum?, dob? }. Requires the captcha solver (CAPTCHA_SOLVER_KEY).
 * Fugitive roster (opts.fugitives) is captcha-FREE.
 */
export async function OK(query = {}, opts = {}) {
  if (opts.fugitives) { const { html } = await okBoot(true); return parseGrid(html); }

  const lastName = clean(query.lastName), firstName = clean(query.firstName);
  if (!lastName || !firstName) return []; // OK over-broadens on surname-only; require both

  const { jar, url, html } = await okBoot(false);
  const sitekey = (html.match(/data-sitekey="([^"]+)"/) || [])[1] || OK_SITEKEY;
  const token = await solveRecaptcha({ sitekey, pageurl: url });
  if (!token) return []; // unconfigured / unsolved / expired -> self-gate

  const form = {
    __EVENTTARGET: '', __EVENTARGUMENT: '', ...okTokens(html),
    'ctl00$cphMain$txtDOCNum': query.docNum || '',
    'ctl00$cphMain$txtFirstName': firstName,
    'ctl00$cphMain$txtLastName': lastName,
    'ctl00$cphMain$txtDOB': query.dob || '',
    'ctl00$cphMain$cmdBasicSearch': 'Search',
    'g-recaptcha-response': token,
  };
  const res = await okPost(url, jar, form);
  if (/Captcha response required/i.test(res)) return []; // token expired before POST landed
  return parseGrid(res);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// NM — New Mexico Corrections Department (NMCD) "OMNI Offender Search". ASP.NET MVC.
//   Anti-bot: Google reCAPTCHA v2 checkbox (standard api.js, NOT enterprise). Endpoint POST
//   /Home/OfenderSearch (yes, the app's own "Ofender" typo). Session cookie from GET carried into POST.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const NM_BASE = 'https://search.cd.nm.gov';
const NM_SEARCH_URL = NM_BASE + '/Home/OfenderSearch';

/**
 * NM(query) — normalized adapter (returns [] on any self-gate/error).
 * @param {{lastName?:string, firstName?:string, offenderId?:string, status?:'active'|'includeInactive'|'absconderOnly'}} query
 */
export async function NM(query = {}) {
  const last = clean(query.lastName), first = clean(query.firstName);
  const oid = clean(query.offenderId);
  if (!last && !oid) return []; // NMCD requires Last Name OR Offender Number (First alone is rejected)
  if (typeof solveRecaptcha !== 'function') return [];

  // 1) GET the search page → session cookie + live sitekey.
  const g = await fetch(NM_BASE + '/', { headers: { 'User-Agent': UA } });
  if (!g.ok) throw new Error(`NM GET ${g.status}`);
  const gh = await g.text();
  const cookie = (g.headers.getSetCookie ? g.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
  const sitekey = (gh.match(/data-sitekey="([^"]+)"/) || [])[1];
  if (!sitekey) return [];

  // 2) Solve reCAPTCHA v2 (checkbox). ~15–90s, ~$0.001–0.003.
  const token = await solveRecaptcha({ sitekey, pageurl: NM_BASE + '/' });
  if (!token) return []; // unconfigured / unsolved / expired

  // 3) POST the form immediately (token expires ~120s after solve).
  const statusVal = { active: '0', includeInactive: '1', absconderOnly: '2' }[query.status] || '0';
  const body = new URLSearchParams({
    lastName: last,
    firstName: first,
    offenderId: oid,
    offenderStatus: statusVal,
    region: 'Reg-0',
    fromAge: '',
    toAge: '',
    'g-recaptcha-response': token,
  });
  const p = await fetch(NM_SEARCH_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Referer: NM_BASE + '/',
      Origin: NM_BASE,
    },
    body,
  });
  if (!p.ok) throw new Error(`NM POST ${p.status}`);
  const html = await p.text();
  if (/An error occurred while processing your request/i.test(html) && !/View Details|Offender Number/i.test(html)) {
    throw new Error('NM error page — reCAPTCHA token rejected/expired.');
  }
  return parseNmHtml(html);
}

// OMNI renders the results table client-side from an embedded `var JsonData = [ … ];` array — parse it directly.
export function parseNmHtml(html) {
  const m = html.match(/var\s+JsonData\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!m) return [];
  let arr;
  try { arr = JSON.parse(m[1]); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeNmRecord).filter(Boolean);
}

function normalizeNmRecord(o) {
  if (!o || (!o.firstName && !o.lastName && !o.offenderId)) return null;
  const first = clean(o.firstName), mid = clean(o.middleName), last = clean(o.lastName);
  const name = [first, mid, last].filter(Boolean).join(' ') || null;
  const status = clean(o.supervisionStatus) || null; // PROBATION/PAROLE | INMATE | INACTIVE | …
  return {
    source: 'NMCD',
    sourceName: 'New Mexico Corrections Department',
    firstName: first || null,
    lastName: last || null,
    name,
    age: null,          // detail page only
    gender: null,       // detail page only
    race: null,         // detail page only
    charges: [],        // detail page only
    mugshotUrl: null,   // detail page only
    bookingDate: null,
    releaseStatus: o.isAbsconder ? 'ABSCONDER' : status,
    facility: clean(o.locationTo) || null, // usually null in the list; populated for some transfers
    county: null,
    state: 'NM',
    inmateId: o.offenderId != null ? String(o.offenderId) : null,
    sourceUrl: null,    // no per-row detail link in the JSON; detail is an in-app POST
    raw: o,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// KS — Kansas DOC (KASPER). Spring/Grails app, HTTP session via JSESSIONID + KDOCAPP cookies.
//   Invisible Google reCAPTCHA v2 (standard api.js) on the search form, enforced server-side.
//   FLOW: GET /search -> 302 /search/disclaimer -> POST /  (agree) -> solve v2 -> POST /search/results
//   -> (optional) GET /search/detail?offenderID=N in same session -> facility + charges.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const KS_BASE = 'https://kdocrepository.doc.ks.gov/kasper';
const KS_ORIGIN = 'https://kdocrepository.doc.ks.gov';
const KS_SITEKEY = '6Le49RkUAAAAACdCYlIM31CcbK3tpgmTNJ09HoGa';

function ksMakeJar() {
  const store = new Map();
  return {
    capture(res) {
      const raw = (res.headers.getSetCookie && res.headers.getSetCookie()) ||
        (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      for (const line of raw) {
        const [pair] = line.split(';');
        const i = pair.indexOf('=');
        if (i > 0) store.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
    },
    header() { return [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}
async function ksJarFetch(jar, url, opts = {}) {
  const headers = { 'User-Agent': UA, ...(opts.headers || {}) };
  const c = jar.header();
  if (c) headers['Cookie'] = c;
  const res = await fetch(url, { redirect: 'manual', ...opts, headers });
  jar.capture(res);
  return res;
}

// "SMITH, JAMES B WAYNE" -> { first:'James', last:'Smith', name:'James B Wayne Smith' }
function splitNameKS(raw) {
  const s = clean(raw);
  if (s.includes(',')) {
    const [lastPart, restPart] = s.split(',');
    const last = titleCase(lastPart);
    const rest = titleCase(restPart);
    const first = rest.split(' ')[0] || '';
    return { first, last, name: clean(`${rest} ${last}`) };
  }
  const parts = titleCase(s).split(' ');
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '', name: titleCase(s) };
}

// results-table parser -> [{ cells, offenderID, mug }]
function parseResultRows(html) {
  const out = [];
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/i.exec(html);
  if (!tbody) return out;
  for (const tr of tbody[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
    if (!cells.length) continue;
    const oid = (/offenderID=(\d+)/i.exec(tr[1]) || [])[1] || null;
    const mug = (/<img[^>]+src=["']([^"']+)["']/i.exec(tr[1]) || [])[1] || null;
    out.push({ cells, offenderID: oid, mug });
  }
  return out;
}

function rowToRecord(row) {
  const c = row.cells; // KDOC# | NameType | Name | Gender | Race | Birth | Age | Supervision | Source
  const { first, last, name } = splitNameKS(c[2]);
  const g = clean(c[3]).toLowerCase();
  return {
    source: 'ks-kasper', sourceName: 'Kansas DOC (KASPER)',
    firstName: first, lastName: last, name,
    age: num(c[6]),
    gender: g.startsWith('m') ? 'male' : g.startsWith('f') ? 'female' : null,
    race: clean(c[4]) || null,
    charges: [], mugshotUrl: row.mug && row.mug.startsWith('/') ? KS_ORIGIN + row.mug : (row.mug || null),
    bookingDate: null,
    releaseStatus: clean(c[7]) || null, // "Discharged", "Incarcerated", supervision status, etc.
    facility: null, county: null,
    state: 'KS', inmateId: clean(c[0]) || null,
    _offenderID: row.offenderID, // internal — for optional detail enrichment
    _nameType: clean(c[1]) || null, // "True" = primary, else alias
    _birth: clean(c[5]) || null,
  };
}

// detail-page enrichment (facility + charges), same session
function parseDetailKS(html) {
  const out = { facility: null, county: null, charges: [], mugshotUrl: null };
  // Convictions table: ...| Criminal Conviction Description(idx5) | Counts | Crime Severity(idx7) |...
  const conv = /Convictions[\s\S]*?(<table[\s\S]*?<\/table>)/i.exec(html);
  if (conv) {
    for (const tr of conv[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
      if (cells.length < 8) continue;
      const desc = clean(cells[5]);
      if (!desc) continue;
      const sev = clean(cells[7]);
      out.charges.push(sev ? `${desc} (${sev})` : desc);
      if (!out.county && clean(cells[0])) out.county = titleCase(cells[0]);
    }
  }
  // Physical Location History: most-recent row's Location = current placement (only if a real facility).
  const loc = /Physical Location[\s\S]*?(<table[\s\S]*?<\/table>)/i.exec(html);
  if (loc) {
    for (const tr of loc[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
      if (!cells.length) continue;
      const f = clean(cells[0]);
      if (!f || /^unknown/i.test(f)) continue;
      const isFacility = /\bCF\b|Correctional|Work Rel|Work Release|Larned/i.test(f) && !/ County$/i.test(f);
      if (isFacility) { out.facility = f; break; } // KDOC already cases these ("Lansing CF-Central")
    }
  }
  const img = /<img[^>]+src=["']([^"']*(?:photo|image|offender|mugshot)[^"']*)["']/i.exec(html);
  if (img) out.mugshotUrl = img[1].startsWith('/') ? KS_ORIGIN + img[1] : img[1];
  return out;
}

// query: { lastName, firstName?, state }   opts: { includePhotos?, enrich?, maxEnrich? }
export async function KS(query = {}, opts = {}) {
  const last = clean(query.lastName);
  const first = clean(query.firstName);
  if (!last) return []; // KASPER needs at least a surname
  if (!capKey()) return []; // captcha solver required

  const jar = ksMakeJar();
  // bootstrap session + accept disclaimer
  await ksJarFetch(jar, `${KS_BASE}/search`);
  await ksJarFetch(jar, `${KS_BASE}/search/disclaimer`);
  await ksJarFetch(jar, `${KS_BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${KS_BASE}/search/disclaimer` },
    body: 'agree=true&submit=Agree',
  });

  // solve invisible reCAPTCHA v2 (token expires ~120s — POST immediately after)
  const token = await solveRecaptcha({ sitekey: KS_SITEKEY, pageurl: `${KS_BASE}/` });
  if (!token) return [];

  const showPhoto = opts.includePhotos ? '1' : '0';
  const body = new URLSearchParams({
    lastName: last, firstName: first, middleName: '', kdocNumber: '',
    showPhoto, thumbnail: showPhoto, alias: '0',
    ssn: '', kbiNumber: '', race: '', gender: '', birthdate: '',
    ageRange_min: '', ageRange_max: '', convictionCounty: '', supervisionCounty: '',
    location: '', facility: '', supervisionType: '', fromSearch: 'true',
    'g-recaptcha-response': token,
  });
  const res = await ksJarFetch(jar, `${KS_BASE}/search/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${KS_BASE}/`, Origin: KS_ORIGIN },
    body: body.toString(),
  });
  if (res.status === 302) return []; // token invalid/expired -> silently rejected
  const html = await res.text();

  const rows = parseResultRows(html);
  const records = rows.map(rowToRecord);

  // Optional detail enrichment (facility + charges). Same captcha'd session, no extra solves. Default ON.
  if (opts.enrich !== false) {
    const cap = opts.maxEnrich ?? 25;
    for (const rec of records.slice(0, cap)) {
      if (!rec._offenderID) continue;
      try {
        const d = await ksJarFetch(jar, `${KS_BASE}/search/detail?offenderID=${rec._offenderID}`, { headers: { Referer: `${KS_BASE}/search/results` } });
        if (d.status !== 200) continue;
        const det = parseDetailKS(await d.text());
        if (det.charges.length) rec.charges = det.charges;
        if (det.facility) rec.facility = det.facility;
        if (det.county) rec.county = det.county;
        if (det.mugshotUrl && !rec.mugshotUrl) rec.mugshotUrl = det.mugshotUrl;
      } catch { /* skip this one */ }
    }
  }

  // strip internal fields
  return records.map(({ _offenderID, _nameType, _birth, ...r }) => r);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// WI — Wisconsin DOC "Offender Locator Public" (LOP). WebSphere Liberty .do servlet app.
//   reCAPTCHA v2 at the ENTRY disclaimer only — solve ONCE per session, "accept", then search freely.
//   FLOW: GET /home.do -> /welcome (disclaimer + sitekey) -> solve -> POST /home/public (accept) ->
//   POST /search/basic -> HTML results. Optional detail hydration via POST /details/detail.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const WI_BASE = 'https://appsdoc.wi.gov/lop';

// tiny cookie jar
function wiJar() {
  const store = {};
  return {
    absorb: (res) => (res.headers.getSetCookie?.() || []).forEach((c) => {
      const [k, ...v] = c.split(';')[0].split('='); store[k] = v.join('=');
    }),
    header: () => Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; '),
  };
}

async function follow302(res, j, extraHeaders = {}) {
  let hops = 0;
  while (res.status >= 300 && res.status < 400 && hops++ < 4) {
    const loc = res.headers.get('location');
    if (!loc) break;
    const url = loc.startsWith('http') ? loc : `https://appsdoc.wi.gov${loc.startsWith('/') ? '' : '/'}${loc}`;
    res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: j.header(), ...extraHeaders }, redirect: 'manual' });
    j.absorb(res);
  }
  return res;
}

/**
 * @param {{lastName:string, firstName?:string, middleName?:string, docNum?:string, status?:string[], hydrate?:boolean}} query
 */
export async function WI(query = {}) {
  const last = clean(query.lastName).toUpperCase();
  const first = clean(query.firstName).toUpperCase();
  if (!last && !query.docNum) return []; // need at least a surname (or DOC#)
  if (!capKey()) return []; // captcha solver required for the entry gate

  const j = wiJar();

  // 1-2. establish session + fetch disclaimer
  let res = await fetch(`${WI_BASE}/home.do`, { headers: { 'User-Agent': UA }, redirect: 'manual' });
  j.absorb(res);
  res = await fetch(`${WI_BASE}/welcome`, { headers: { 'User-Agent': UA, Cookie: j.header() } });
  j.absorb(res);
  const welcome = await res.text();
  const sitekey = (welcome.match(/data-sitekey="([^"]+)"/) || [])[1];
  if (!sitekey) return [];

  // 3. solve reCAPTCHA v2
  const token = await solveRecaptcha({ sitekey, pageurl: `${WI_BASE}/welcome` });
  if (!token) return []; // unsolved / expired

  // 4. accept the session
  const accept = new URLSearchParams({ type: 'basic', clientBrowser: UA, response: token });
  res = await fetch(`${WI_BASE}/home/public`, {
    method: 'POST',
    headers: { 'User-Agent': UA, Cookie: j.header(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${WI_BASE}/welcome` },
    body: accept, redirect: 'manual',
  });
  j.absorb(res);
  res = await follow302(res, j);
  // sanity: home page should now contain the search form
  const home = await res.text();
  if (!/LAST_NAM|search\/basic/i.test(home)) return []; // session not accepted (token expired?)

  // 5. name search
  const body = new URLSearchParams({
    view: 'demographics', searchpage: 'basic', pageSize: '25', sortBy: '2',
    LAST_NAM: last, FIRST_NAM: first, MID_NAM: clean(query.middleName).toUpperCase(),
    DOC_NUM: query.docNum || '',
    RACE: '', GENDER: '', BIRTH_YEAR: '', MIN_AGE: '', MAX_AGE: '',
    ADR_CITY: '', ADR_COUNTY: '', ADR_MIN_ZIP: '', ADR_MAX_ZIP: '',
  });
  for (const s of (query.status || ['INC', 'ACS', 'TERM'])) body.append('STATUS', s);
  res = await fetch(`${WI_BASE}/search/basic`, {
    method: 'POST',
    headers: { 'User-Agent': UA, Cookie: j.header(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${WI_BASE}/home/home` },
    body, redirect: 'manual',
  });
  j.absorb(res);
  res = await follow302(res, j);
  const resultsHtml = await res.text();

  let records = parseResultsWI(resultsHtml);

  // 6. optional detail hydration (DOC#/sex/mugshot via demographics; facility via status)
  if (query.hydrate && records.length) {
    const form = detailFormFields(resultsHtml);
    for (const rec of records) {
      try {
        const demo = await fetchDetailWI(rec.pin, 'demographics', form, j);
        Object.assign(rec, demo);
      } catch { /* leave row-level data */ }
    }
  }

  // strip internal-only pin from the normalized output unless caller wants it
  return records.map(({ pin, ...r }) => ({ ...r, _pin: pin }));
}

// results table parser
function parseResultsWI(html) {
  const out = [];
  const rows = [...html.matchAll(/<tr[^>]*rowClick\('(\d+)'\)[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const [, pin, rowHtml] of rows) {
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => decodeWI(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
    // cells: [Last, First+Mid, BirthYear, Race, County, Zip, Status, (Photo)]
    const [lastCell, firstCell, byCell, raceCell, countyCell] = cells;
    const statusCell = cells[6];
    const lastName = clean(lastCell);
    // "JAMES L" -> first = JAMES, middle initial = L
    const fm = clean(firstCell).split(' ');
    const firstName = fm[0] || '';
    const middle = fm.slice(1).join(' ');
    const birthYear = (clean(byCell).match(/\d{4}/) || [])[0] || null;
    const age = birthYear ? new Date().getFullYear() - Number(birthYear) : null;
    const county = clean(countyCell) && !/no data/i.test(countyCell) ? clean(countyCell) : null;
    out.push({
      source: 'wi-doc-lop',
      sourceName: 'Wisconsin DOC Offender Locator',
      firstName, lastName,
      name: `${firstName}${middle ? ' ' + middle : ''} ${lastName}`.trim(),
      age, birthYear,
      gender: null, race: clean(raceCell) || null,
      charges: [],
      mugshotUrl: null,
      bookingDate: null,
      releaseStatus: mapStatusWI(clean(statusCell)),
      facility: null,
      county,
      state: 'WI',
      inmateId: null, // public DOC# — populated by hydrate
      pin, // internal id (used for detail lookup; not a stable public key)
    });
  }
  return out;
}

const mapStatusWI = (s) => ({ INC: 'incarcerated', ACS: 'community supervision', TERM: 'terminated' }[s] || s || null);

// detail hydration
function detailFormFields(html) {
  const f = {};
  const formBlock = (html.match(/<form[^>]*locatorDetailForm[\s\S]*?<\/form>/i) || [])[0] || html;
  // NOTE: WI emits a stray duplicate `value=""` on each hidden input — LAZY match captures the FIRST (real) value.
  for (const m of formBlock.matchAll(/<input[^>]*?name="([^"]+)"[^>]*?value="([^"]*)"[^>]*>/gi)) {
    if (!(m[1] in f)) f[m[1]] = m[2];
  }
  return f; // navigation, firstRow, pageSize, rowCount, view, searchview, helpMenu, pin
}

async function fetchDetailWI(pin, view, formFields, j) {
  const body = new URLSearchParams({ ...formFields, pin, view });
  const res = await fetch(`${WI_BASE}/details/detail`, {
    method: 'POST',
    headers: { 'User-Agent': UA, Cookie: j.header(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${WI_BASE}/search/basic` },
    body, redirect: 'manual',
  });
  j.absorb(res);
  const r = await follow302(res, j);
  return parseDetailWI(await r.text());
}

// The demographics detail page is a flat sequence of [ "Label:", "Value", … ] cells with an "Aliases" block.
function parseDetailWI(html) {
  const cells = [...html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => decodeWI(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const kv = {};
  for (let i = 0; i < cells.length - 1; i++) {
    const m = cells[i].match(/^(.+?):$/);
    if (m) kv[m[1].trim().toLowerCase()] = cells[i + 1];
  }
  // aliases: the cells after the "Aliases" header until the nav/footer block
  const aStart = cells.findIndex((c) => /^Aliases$/i.test(c));
  const aliases = [];
  if (aStart >= 0) {
    for (let i = aStart + 1; i < cells.length; i++) {
      if (/(Printer Friendly|New Search|Legal Notices|Return to)/i.test(cells[i])) break;
      if (cells[i].length <= 40) aliases.push(cells[i]);
    }
  }
  const out = {
    gender: kv.sex || kv.gender || null,
    race: kv.race || null,
    ethnicity: kv.ethnicity || null,
    height: kv.height || null,
    weight: kv.weight || null,
    eyeColor: kv['eye color'] || null,
    hairColor: kv['hair color'] || null,
    dexterity: kv.dexterity || null,
    aliases: aliases.length ? aliases : undefined,
    mugshotUrl: (html.match(/photoID=[^"'&\s]+/) || [null])[0]
      ? `${WI_BASE}/photo/smallest?${(html.match(/photoID=[^"'&\s]+/) || [])[0]}` : null,
    // DOC# (public inmate number) + facility/county live in the view=status sub-tab, not demographics.
    inmateId: kv.doc || kv['doc number'] || null,
  };
  return out;
}

function decodeWI(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CO — CDOC (DOCNet Offender Search / OSS). Legacy PHP AJAX app (prototype.js).
//   FLOW: GET /oss/ (PHPSESSID) -> GET ?sec=captcha (GIF of shapes) -> POST sec=captcha_json ({shape:1|2|3})
//   -> POST sec=list_offenders with &captcha=<count>.
//   CAPTCHA = "count the shapes" (1=square 2=circle 3=slanted line). The count question is TEXT, not in the
//   image, so plain OCR can't solve it — send 2Captcha the image PLUS a `textinstructions` prompt (a human
//   worker counts the right shape). The answer can legitimately be 0.
// ════════════════════════════════════════════════════════════════════════════════════════════════
export async function CO(query = {}) {
  const last = clean(query.lastName); if (!last) return [];
  const first = clean(query.firstName);
  const ORIGIN = 'https://www.doc.state.co.us';
  const BASE = `${ORIGIN}/oss/controller/ctl_ajax.php`;
  const SHAPE_WORD = { 1: 'square', 2: 'circle', 3: 'slanted diagonal line' };

  // 1) landing → PHPSESSID
  const land = await fetch(`${ORIGIN}/oss/`, { headers: { 'User-Agent': UA } });
  if (!land.ok) throw new Error(`CO ${land.status}`);
  const sc = land.headers.getSetCookie ? land.headers.getSetCookie() : (land.headers.get('set-cookie') ? [land.headers.get('set-cookie')] : []);
  const cookie = sc.map((c) => c.split(';')[0]).find((c) => /PHPSESSID=/.test(c)) || '';

  // 2) captcha image (must be fetched before the json read) → 3) which shape to count
  const img = await fetch(`${BASE}?sec=captcha&ts=${Math.floor(Math.random() * 100000)}`, { headers: { 'User-Agent': UA, Cookie: cookie, Referer: `${ORIGIN}/oss/` } });
  const b64 = Buffer.from(await img.arrayBuffer()).toString('base64');
  const sj = await fetch(BASE, { method: 'POST', headers: { 'User-Agent': UA, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: `${ORIGIN}/oss/` }, body: 'sec=captcha_json' });
  const shape = ((await sj.json().catch(() => ({}))) || {}).shape;
  const word = SHAPE_WORD[shape];
  if (!word) throw new Error('CO captcha shape unknown');

  // 4) solve (human worker counts the target shape) via the shared image solver + textinstructions.
  const instr = `This image is a single horizontal row of simple outline shapes: squares, circles and slanted diagonal lines. Count ONLY how many ${word}s appear. Answer with just one digit (the count may be 0).`;
  const answer = await solveImageCaptcha(b64, { textInstructions: instr, numeric: true, minLength: 1, maxLength: 1 });
  if (answer == null) throw new Error('CO captcha unsolved (no solver key / timeout)');

  // 5) submit search with the count
  const body = new URLSearchParams({ docno: '', lnam: last, fnam: first, gender: 'ALL', sec: 'list_offenders', search: 'true', start: '0', order_col: '', order_dir: '', captcha: String(answer).trim() });
  const s = await fetch(BASE, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest', Referer: `${ORIGIN}/oss/` }, body: body.toString() });
  if (!s.ok) throw new Error(`CO ${s.status}`);
  const html = await s.text();
  if (/CAPTCHA Challenge Failed/i.test(html)) throw new Error('CO captcha incorrect'); // wrong count (crawler retries)

  // 6) parse results table
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
      charges: [], mugshotUrl: `${ORIGIN}/offender_search/offender_photos/PRODUCTION/${docno.slice(0, 3)}/${docno}.jpg`,
      bookingDate: null, releaseStatus: null, facility: facility || null, county: null, state: 'CO', inmateId: docno,
    });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// DE — Delaware DOC (VINE path, NO CAPTCHA). Delaware publishes no first-party name search; the public
//   path is VINELink (Appriss/Equifax VINE), same backend as the LA/MA/HI/AK/SD VINE adapters. Bootstrap
//   an anonymous guest session (POST /accounts with `Auth: Basic anonymous:<pw>`) → GET /persons. Fast,
//   captcha-free — stays a LIVE direct adapter (NOT browser-tier). Requires BOTH first + last name.
//   Returns OFFENDER (custody) + DEFENDANT (court) records, tagged via `recordType`.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const DE_API = 'https://vinelink-mobile.vineapps.com/api/v1';
const DE_SITE_REF = 'DESWVINE';

const gnorm = (g) => { const v = clean(g); return /^m/i.test(v) ? 'male' : /^f/i.test(v) ? 'female' : (v || null); };

/**
 * DE(query) -> normalized inmate/court records for Delaware.
 * @param {{firstName?:string, lastName:string}} query  Both first + last required.
 */
export async function DE(query = {}) {
  const last = clean(query.lastName);
  const first = clean(query.firstName);
  if (!last || !first) return []; // VINE DE requires BOTH first + last

  const base = {
    Accept: 'application/json',
    'x-vine-application': 'VINELINK',
    'x-vine-language': 'ENGLISH',
    'User-Agent': UA,
    Referer: 'https://vinelink.vineapps.com/',
  };

  // 1) Bootstrap an anonymous guest session (note: the header is literally "Auth", not "Authorization").
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += cs[Math.floor(Math.random() * cs.length)];
  pw += 'aA1!'; // satisfy password-complexity
  const acc = await fetch(`${DE_API}/accounts`, {
    method: 'POST',
    headers: { ...base, 'Content-Type': 'application/json', Auth: `Basic ${Buffer.from(`anonymous:${pw}`).toString('base64')}`, Origin: 'https://vinelink.vineapps.com' },
    body: JSON.stringify({ termsRead: false }),
  });
  if (!acc.ok) throw new Error(`DE accounts ${acc.status}`);
  const sessionId = acc.headers.get('x-vine-session-id');
  const jwt = acc.headers.get('x-vine-jwt');

  // 2) Search persons with the session headers (no captcha token needed).
  const qs = new URLSearchParams();
  qs.set('siteRefId', DE_SITE_REF);
  qs.set('personLastName', last);
  qs.set('personFirstName', first);
  qs.append('personContextTypes', 'offender');
  qs.append('personContextTypes', 'defendant');
  qs.set('limit', '20');
  qs.set('offset', '0');
  qs.set('obscurePersonData', 'true');
  qs.set('includeJuveniles', 'false');
  qs.set('includeSearchBlocked', 'false');
  qs.set('includeRegistrantInfo', 'true');
  qs.set('addImageWatermark', 'true');
  qs.set('language', 'ENGLISH');
  const res = await fetch(`${DE_API}/persons?${qs.toString()}`, {
    headers: { ...base, 'x-vine-session-id': sessionId, 'x-vine-jwt': jwt },
  });
  if (!res.ok) throw new Error(`DE persons ${res.status}`);
  const data = await res.json().catch(() => null);
  const persons = data && data._embedded && Array.isArray(data._embedded.persons) ? data._embedded.persons : [];
  return persons.map(normalizeDE);
}

/** Map one VINE person object to the normalized inmate shape. */
function normalizeDE(p = {}) {
  const nm = p.personName || {};
  const ctx = p.personContext || {};
  const isOffender = /OFFENDER/i.test(clean(ctx.contextType));
  const locs = Array.isArray(p.locations) ? p.locations : [];
  const holding = locs.find((l) => l.locationType === 'HOLDING_FACILITY');
  const reporting = locs.find((l) => l.locationType === 'REPORTING_AGENCY');
  const oi = p.offenderInfo || {};
  const cust = oi.custodyStatus || {};
  const img = p.imageLinks || {};
  const court = (p.defendantInfo && p.defendantInfo.courtCaseInfo) || {};

  const facility = clean(oi.custodyDetail)
    || (holding && clean(holding.locationName))
    || null;
  // VINE exposes NO real county (reporting agency is always DE DOC HQ; holding gives a city, not a county).
  void reporting;

  return {
    source: 'de-vine',
    sourceName: 'Delaware DOC (VINE)',
    firstName: clean(nm.firstName),
    lastName: clean(nm.lastName),
    name: [nm.firstName, nm.middleName, nm.lastName, nm.suffix].map(clean).filter(Boolean).join(' '),
    age: num(p.age),                                 // present for OFFENDER, usually null for DEFENDANT
    gender: gnorm((p.gender || {}).name || (p.gender || {}).code),
    race: clean((p.race || {}).name) || null,
    charges: [],                                     // VINE exposes no charges — status only
    mugshotUrl: img.desktopImageLink
      || (p._links && p._links.desktopImage && p._links.desktopImage.href)
      || img.mobileImageLink || img.thumbnailImageLink || null,
    bookingDate: null,                               // not exposed
    releaseStatus: isOffender
      ? (clean(cust.name || cust.code) || null)      // "In Custody" / "Supervised Custody" / ...
      : (clean((court.courtCaseStatus || {}).name) || null), // "Open" / "Closed" for court records
    facility,                                        // e.g. "Sussex Correctional Institution"
    county: null,                                    // VINE exposes no real county (see above)
    state: 'DE',
    // Guest-obscured DOC/SBI number (e.g. "0025****") — NOT stable for dedup. Use `contextId` for a stable key.
    inmateId: clean(p.displayId || ctx.contextRefId) || null,
    // extras beyond the common shape (safe to ignore):
    contextId: num(ctx.contextId),                   // UNMASKED stable id (offenderId / courtCaseId)
    recordType: isOffender ? 'custody' : 'court',
    caseNumber: isOffender ? null : (clean(court.courtCaseRefId) || clean(court.courtCaseNumber) || null),
  };
}
