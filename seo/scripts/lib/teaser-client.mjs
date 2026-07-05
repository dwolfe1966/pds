// Server-side BC name-teaser client. Replays the exact call the IIFE makes
// (recipe verified 2026-07-05): POST {base}/idLookup/teaser/search?clientId&apiId
// with a flat JSON body {type,fName,lName,state,contextKey}. No auth (pre-signup);
// clientId/apiId are self-minted randoms. One clientId per process (politeness).
//
// CAVEAT: prod (idlookup.ai) sits behind Cloudflare Turnstile. A raw fetch MAY get
// a CF challenge → then use the headless path (drive the real IIFE via Playwright;
// see DEPLOY-notes). This client tries the raw fetch and surfaces a clear error so
// fetch-profiles can decide.
import { randomBytes } from 'node:crypto';

const BASE = process.env.SEO_TEASER_BASE || 'https://www.idlookup.ai/api';
const rid = () => randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
const CLIENT_ID = rid(); // stable for the run

export async function searchTeaser(first, last, state = '') {
  const url = `${BASE}/idLookup/teaser/search?clientId=${CLIENT_ID}&apiId=${rid()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ type: 'name', fName: first, lName: last, state: String(state || '').toUpperCase(), contextKey: 'sale.name.teaser' }),
  });
  const text = await res.text();
  if (!res.ok) {
    const cf = /cloudflare|turnstile|challenge|cf-/i.test(text) || res.status === 403 || res.status === 503;
    throw new Error(`teaser HTTP ${res.status}${cf ? ' (Cloudflare/Turnstile gate — use headless path)' : ''}`);
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('teaser: non-JSON response (likely a CF challenge page — use headless path)'); }
  // Prod captcha is OFF (2026-06-24); a captcha-challenge body here would mean it's back.
  if (data?.type === 'password.v0' || data?.captchaId) throw new Error('teaser returned a captcha challenge (unexpected on prod)');
  return data;
}
