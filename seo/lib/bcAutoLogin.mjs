// Mint a BC password-less auto-login link for a CONSUMER, redirecting to a destination — using ONLY existing
// BC methods (no BC ask). Path: headless CSR service login → resolve email→userId → getAutoLoginUrl(userId,
// redirect). BC returns a link like https://www.idlookup.ai/api/auth/loginLink?loginHash=<token+dest> that
// auto-logs the user in and redirects. Powers abandon-recovery auto-login.
//
// ⚠️ SECURITY: requires CSR ADMIN credentials in this backend (it can impersonate any user). Owner-accepted
// 2026-07-27. Env: BC_CSR_API_URL (e.g. https://admin.www.bytecrtrs.com/api), BC_CSR_USERNAME, BC_CSR_PASSWORD.
// Never returns creds to the client; only the short-lived login link. Degrades to null (never throws upstream)
// when unconfigured or BC errors.

const BC = () => (process.env.BC_CSR_API_URL || '').replace(/\/$/, '');
export const hasBcAutoLogin = () => !!(BC() && process.env.BC_CSR_USERNAME && process.env.BC_CSR_PASSWORD);

let _session = null; // { jar, exp } — reuse the CSR session for a few minutes across mints.

function cookieJar(res) {
  const list = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  // Keep the session + load-balancer affinity cookies (connect.sid, lb, …); drop attributes.
  return list.map((c) => String(c).split(';')[0]).filter(Boolean).join('; ');
}

async function csrLogin() {
  if (_session && _session.exp > Date.now() && _session.jar) return _session.jar;
  const res = await fetch(`${BC()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.BC_CSR_USERNAME, password: process.env.BC_CSR_PASSWORD }),
  });
  if (!res.ok) throw new Error(`csr login ${res.status}`);
  const jar = cookieJar(res);
  if (!/connect\.sid=/.test(jar)) throw new Error('csr login: no session cookie');
  _session = { jar, exp: Date.now() + 15 * 60 * 1000 };
  return jar;
}

async function csrPost(path, body, jar) {
  const res = await fetch(`${BC()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: jar },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const e = new Error(`${path} ${res.status}: ${String(t).slice(0, 140)}`);
    e.status = res.status;
    throw e;
  }
  return res.json().catch(() => ({}));
}

async function resolveUserId(email, jar) {
  const em = String(email || '').trim().toLowerCase();
  // user.find (api.user.find → /database/search). BC honors filters under `query`.
  const r = await csrPost('/database/search', { collectionName: 'users', query: { email: em } }, jar);
  const docs = (r && (r.docs || r.raws || r.data)) || (Array.isArray(r) ? r : []);
  const hit = docs.find((d) => String(d.email || '').toLowerCase() === em) || docs[0];
  return hit ? (hit._id || hit.id) : null;
}

function extractUrl(r) {
  if (!r) return null;
  if (typeof r === 'string') return r;
  return r.url || r.loginLink || r.autoLoginUrl || r.link
    || (r.data && (r.data.url || r.data.loginLink || r.data.autoLoginUrl))
    || (r.getData && (() => { try { const d = r.getData(); return d && (d.url || d.loginLink); } catch { return null; } })())
    || null;
}

/**
 * @param {string} email     the abandoner (consumer) whose session to mint
 * @param {string} redirect  post-login destination path (e.g. /name/landing/v3?fn=…)
 * @returns {Promise<{url:string|null, userId:string|null, error?:string}>}
 */
export async function mintAutoLoginUrl(email, redirect) {
  if (!hasBcAutoLogin()) return { url: null, userId: null, error: 'not configured' };
  try {
    const jar = await csrLogin();
    const userId = await resolveUserId(email, jar);
    if (!userId) return { url: null, userId: null, error: 'user not found' };
    const r = await csrPost('/user/management/getAutoLoginUrl', { userId, redirect }, jar);
    const url = extractUrl(r);
    return { url, userId, error: url ? undefined : 'no url in response', raw: url ? undefined : r };
  } catch (e) {
    _session = null; // drop a possibly-stale session so the next call re-logs in
    return { url: null, userId: null, error: String((e && e.message) || e) };
  }
}
