// ── MT · Montana DOC (Correctional Offender Network, "conweb") ──────────────────
// Access class: BROWSER TIER + RESIDENTIAL proxy (moat infra). offendersearch.mt.gov
//   is behind an F5 BIG-IP ASM / TSPD bot wall (TS*/TSPD_101 cookies, /TSPD/?type=NN
//   challenge scripts). Findings (verified live 2026-07-19 via Browserless):
//     • plain node fetch                         → "Request Rejected" (245 bytes, F5)
//     • Browserless w/ DEFAULT ua (HeadlessChrome)→ "Request Rejected" (hard-blocked)
//     • Browserless + real UA, DATACENTER ip      → GET /conweb OK, but POST /Search REJECTED
//     • Browserless + real UA + RESIDENTIAL proxy → POST /Search returns real results ✅
//   So: real Chrome (non-headless UA) + Browserless RESIDENTIAL proxy is REQUIRED, and
//   the search must be a genuine form-SUBMIT navigation (in-page fetch/XHR of /Search is
//   still rejected). Residential exit IPs are flaky → retry the whole run (see MT()).
//   No captcha anywhere. Public records (convicted felons). Results capped at 100.
//
// Data available:
//   LIST (reliable): name, year-of-birth (→ approx age), correctional status
//     ("Secure"=incarcerated / "Probation" / "Parole" / etc.), DOC ID (inmateId),
//     and a single-use SIGNED detail URL /conweb/Offender/{docId}/{ticks}/{sha1}.
//   DETAIL (opt-in, best-effort — same wall, flaky): sex, race, facility/location,
//     charges[] (per-docket: offense/county/judge/sentence), mugshot
//     (/conweb/Photo/Show/{docId}, also WAF-gated). age is NEVER published (YOB only).
//   Detail URLs cannot be constructed from a DOC ID — the ticks+hash token is minted
//   by the results page, so enumeration is by name sweep only.

const BASE = 'https://offendersearch.mt.gov/conweb';
const REAL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ---- helpers (mirror lib/stateInmates.mjs conventions) ----
const clean = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
const num = (s) => { const n = parseInt(String(s == null ? '' : s).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null; };
function txt(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n');
}
function field(flat, label) {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*([^\\n]+)', 'i');
  const m = flat.match(re); return m ? clean(m[1]) : null;
}

// "Last, First Middle" -> {firstName, lastName, name}
function splitName(raw) {
  const s = clean(raw);
  const comma = s.indexOf(',');
  if (comma < 0) { const p = s.split(' '); return { firstName: p[0] || '', lastName: p.slice(1).join(' '), name: s }; }
  const last = clean(s.slice(0, comma));
  const rest = clean(s.slice(comma + 1));
  const first = rest.split(' ')[0] || '';
  return { firstName: first, lastName: last, name: clean([rest, last].join(' ')) };
}

// ---- LIST parser: one row = con_cell_1 { name+detailPath, YOB, status } ----
export function parseList(html) {
  const out = [];
  // capture each con_cell_1 block
  const blockRe = /<div class="con_cell_1">([\s\S]*?)<\/div>\s*<\/div>/gi;
  let bm;
  const blocks = [];
  // the nested-div structure means a naive close won't work; instead split on con_cell_1
  const parts = (html || '').split(/<div class="con_cell_1">/i).slice(1);
  for (const p of parts) blocks.push(p);
  for (const b of blocks) {
    const a = b.match(/href="(\/conweb\/Offender\/(\d+)\/\d+\/[a-f0-9]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    const detailPath = a[1], docId = a[2];
    const rawName = txt(a[3]).replace(/\n/g, ' ').trim();
    // the three con_cell_2 values in order: [name cell], YOB, status
    const cells = [...b.matchAll(/<div class="con_cell_2">([\s\S]*?)<\/div>/gi)].map((m) => txt(m[1]).replace(/\n/g, ' ').trim());
    const yob = cells[1] ? num(cells[1]) : null;
    const status = cells[2] || null;
    const { firstName, lastName, name } = splitName(rawName);
    const thisYear = new Date().getFullYear();
    out.push({
      source: 'mt-doc', sourceName: 'Montana DOC (conweb)',
      firstName, lastName, name,
      age: yob ? thisYear - yob : null,   // APPROX — only year of birth is published (±1)
      gender: null, race: null,
      charges: [], mugshotUrl: docId ? `${BASE}/Photo/Show/${docId}` : null, // WAF-gated
      bookingDate: null,
      releaseStatus: status,              // "Secure" (incarcerated) / "Probation" / "Parole" / ...
      facility: null, county: null, state: 'MT', inmateId: docId || null,
      _detailPath: detailPath,            // single-use signed URL; used by opt-in hydrate
      _yearOfBirth: yob || null,
      _alias: /alias_label/i.test(b) || null,
    });
  }
  return out;
}

// ---- DETAIL parser (opt-in; best-effort — many fields vary by record) ----
function parseCharges(flat) {
  const charges = [];
  for (const b of flat.split(/\bDOCKET\s*:/i).slice(1)) {
    const seg = 'DOCKET:' + b;
    charges.push({
      docket: field(seg, 'DOCKET'), county: field(seg, 'COUNTY'), judge: field(seg, 'JUDGE'),
      counts: field(seg, 'COUNTS'), offense: field(seg, 'OFFENSE'), code: field(seg, 'CODE'),
      offenseDate: field(seg, 'OFFENSE DATE'), sentenceMonths: field(seg, 'SENTENCE (MONTHS)'),
    });
  }
  return charges;
}
export function parseDetail(html, base) {
  const flat = txt(html);
  const charges = parseCharges(flat);
  return {
    sex: field(flat, 'SEX'),
    race: field(flat, 'RACE'),
    facility: field(flat, 'CURRENT STATUS'),   // location block is inconsistent; status label is the reliable anchor
    county: charges[0] ? charges[0].county : null, // county of CONVICTION (per docket), not residence
    charges,
    yearOfBirth: field(flat, 'YEAR OF BIRTH'),
    height: field(flat, 'HEIGHT'), weight: field(flat, 'WEIGHT'),
    hairColor: field(flat, 'HAIR COLOR'), eyeColor: field(flat, 'EYE COLOR'),
  };
}

// ---- Browserless runner (residential; retries flaky exit IPs) ----
async function browserFunction(code, tries = 4) {
  const svc = process.env.BROWSER_SERVICE_URL;
  if (!svc) return null;
  let url;
  try {
    url = new URL(svc);
    url.searchParams.set('proxy', 'residential');
    url.searchParams.set('proxyCountry', process.env.BROWSER_PROXY_COUNTRY || 'us');
  } catch { return null; }
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, context: {} }) });
      if (res.ok) {
        const j = await res.json().catch(() => null);
        const data = j ? j.data : null;
        // A residential exit that scored as a bot yields the F5 "Request Rejected"
        // payload — treat it as a retryable miss so a fresh IP gets a turn.
        if (data != null && !/"rejected":true/.test(data)) return data;
      }
    } catch { /* retry — residential exit rotated onto a blocked/reset IP */ }
  }
  return null;
}

// Build the in-browser search function (real form-submit navigation through the F5 wall).
function searchCode(fn, ln, offNo, hydrateN) {
  return `export default async function ({ page }) {
    await page.setUserAgent(${JSON.stringify(REAL_UA)});
    await page.goto("${BASE}", { waitUntil: "networkidle2", timeout: 45000 });
    await page.mouse.move(220, 210); await page.mouse.move(380, 320);
    await new Promise(r => setTimeout(r, 5000)); // let the TSPD SDK arm
    await page.evaluate((off) => { const e=document.querySelector("#OffenderNumber"); if(e) e.value=off; }, ${JSON.stringify(offNo)});
    if (${JSON.stringify(ln)}) { await page.click("#LastName"); await page.type("#LastName", ${JSON.stringify(ln)}, { delay: 60 }); }
    if (${JSON.stringify(fn)}) { await page.click("#FirstName"); await page.type("#FirstName", ${JSON.stringify(fn)}, { delay: 60 }); }
    await new Promise(r => setTimeout(r, 500));
    const btn = await page.$("button[type=submit]") || await page.$("#searchForm button");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => null),
      btn ? btn.click() : page.evaluate(() => document.querySelector("form").submit()),
    ]);
    await new Promise(r => setTimeout(r, 1200));
    const listHtml = await page.content();
    if (/Request Rejected/i.test(listHtml)) return { data: JSON.stringify({ rejected: true }), type: "application/json" };
    // opt-in hydrate: in-page fetch (SDK-hooked) of the first N signed detail URLs
    const details = {};
    const hyd = ${Number(hydrateN) || 0};
    if (hyd > 0) {
      const paths = [...listHtml.matchAll(/\\/conweb\\/Offender\\/[^"]+/g)].map(m => m[0]).slice(0, hyd);
      for (const p of paths) {
        try {
          const r = await page.evaluate(async (p) => { const resp = await fetch(p, { credentials: "include" }); return await resp.text(); }, p);
          if (r && !/Request Rejected/i.test(r)) details[p] = r;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 900));
      }
    }
    return { data: JSON.stringify({ listHtml, details }), type: "application/json" };
  }`;
}

// ---- Main entry. query: string (last name) or { lastName, firstName, offenderNumber, hydrate } ----
export async function MT(query) {
  const q = typeof query === 'string' ? { lastName: query } : (query || {});
  const ln = clean(q.lastName).toUpperCase();
  const fn = clean(q.firstName).toUpperCase();
  const offNo = clean(q.offenderNumber);
  if (!ln && !fn && !offNo) return [];
  if (!process.env.BROWSER_SERVICE_URL) throw new Error('MT requires BROWSER_SERVICE_URL (F5 BIG-IP ASM wall — browser tier + residential proxy)');

  const hydrateN = q.hydrate ? (typeof q.hydrate === 'number' ? q.hydrate : 3) : 0;
  const raw = await browserFunction(searchCode(fn, ln, offNo, hydrateN));
  if (raw == null) throw new Error('MT: Browserless returned no data (residential exits all reset/blocked, or F5 rejected every attempt)');

  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (!parsed || parsed.rejected) throw new Error('MT: F5 ASM rejected the search POST on every retry (residential IP scored as bot)');

  const records = parseList(parsed.listHtml || '');
  if (hydrateN && parsed.details) {
    for (const rec of records) {
      const d = parsed.details[rec._detailPath];
      if (!d) continue;
      const det = parseDetail(d, BASE);
      rec.gender = det.sex || rec.gender;
      rec.race = det.race || rec.race;
      rec.facility = det.facility || rec.facility;
      rec.county = det.county || rec.county;
      rec.charges = det.charges && det.charges.length ? det.charges : rec.charges;
    }
  }
  return records;
}

export default MT;
