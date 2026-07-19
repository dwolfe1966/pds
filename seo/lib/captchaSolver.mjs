// Captcha solver — the "captcha wave" infra (docs/incarceration-problem-states.md). Unlocks the state DOC
// locators gated by a captcha: image (number/text/shape → MO/CO/KS/OK/WV/DE) and reCAPTCHA Enterprise (NM).
//
// Provider: 2Captcha (default) — cheapest, covers image + reCAPTCHA v2/v3/Enterprise + hCaptcha.
//   ⚠️ BLOCKED ON OWNER: a 2Captcha account + API key. Set CAPTCHA_SOLVER_KEY on Vercel.
// Returns null when unconfigured (adapters then self-gate to []).
//
// 2Captcha flow: POST in.php (submit) → captcha id → poll res.php until "OK|<answer>".
const BASE = 'https://2captcha.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Normalize the key against common paste errors: surrounding whitespace/quotes and a stray leading `=`
// (a `KEY==value` line in .env parses the value as `=value`). 2Captcha keys are exactly 32 hex chars.
const apiKey = () => (process.env.CAPTCHA_SOLVER_KEY || '').trim().replace(/^["'=\s]+/, '').replace(/["'\s]+$/, '');

async function poll(key, id, { tries = 20, delay = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    await sleep(delay);
    try {
      const r = await fetch(`${BASE}/res.php?key=${encodeURIComponent(key)}&action=get&id=${id}&json=1`);
      const j = await r.json().catch(() => null);
      if (j && j.status === 1) return j.request;             // solved → the answer/token
      if (j && j.request && j.request !== 'CAPCHA_NOT_READY') return null; // hard error (ERROR_*)
    } catch { /* keep polling */ }
  }
  return null; // timed out
}

/**
 * Solve an image captcha (base64, no data: prefix) → the text/number answer. `numeric:true` hints digits;
 * `caseSensitive`, `minLength`/`maxLength` tune accuracy. Returns null if unconfigured / unsolved.
 */
export async function solveImageCaptcha(base64, opts = {}) {
  const key = apiKey();
  if (!key || !base64) return null;
  const body = new URLSearchParams({ key, method: 'base64', body: base64.replace(/^data:[^,]+,/, ''), json: '1' });
  if (opts.numeric) body.set('numeric', '1');
  if (opts.caseSensitive) body.set('regsense', '1');
  if (opts.minLength) body.set('min_len', String(opts.minLength));
  if (opts.maxLength) body.set('max_len', String(opts.maxLength));
  if (opts.phrase) body.set('phrase', '1');
  try {
    const r = await fetch(`${BASE}/in.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const j = await r.json().catch(() => null);
    if (!j || j.status !== 1) return null;
    return await poll(key, j.request);
  } catch { return null; }
}

/**
 * Solve a reCAPTCHA (v2 or Enterprise) → the g-recaptcha-response token to POST back.
 * @param {{sitekey:string, pageurl:string, enterprise?:boolean, action?:string, v3?:boolean, minScore?:number}} p
 */
export async function solveRecaptcha(p = {}) {
  const key = apiKey();
  if (!key || !p.sitekey || !p.pageurl) return null;
  const body = new URLSearchParams({ key, method: 'userrecaptcha', googlekey: p.sitekey, pageurl: p.pageurl, json: '1' });
  if (p.enterprise) body.set('enterprise', '1');
  if (p.v3) { body.set('version', 'v3'); if (p.action) body.set('action', p.action); if (p.minScore) body.set('min_score', String(p.minScore)); }
  try {
    const r = await fetch(`${BASE}/in.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const j = await r.json().catch(() => null);
    if (!j || j.status !== 1) return null;
    return await poll(key, j.request, { tries: 24, delay: 6000 }); // reCAPTCHA takes longer
  } catch { return null; }
}

export const hasCaptchaSolver = () => !!apiKey();
