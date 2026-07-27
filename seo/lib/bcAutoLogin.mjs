// Mint a BC password-less auto-login link for a CONSUMER, redirecting to a destination — using ONLY existing
// BC methods (no BC ask). Path: headless CSR service login → resolve email→userId → getAutoLoginUrl(userId,
// redirect). BC returns a link like https://www.idlookup.ai/api/auth/loginLink?loginHash=<token+dest> that
// auto-logs the user in and redirects. Powers abandon-recovery auto-login.
//
// ⚠️ SECURITY: requires CSR ADMIN credentials in this backend (it can impersonate any user). Owner-accepted
// 2026-07-27. Env: BC_CSR_API_URL (e.g. https://admin.www.bytecrtrs.com/api), BC_CSR_USERNAME, BC_CSR_PASSWORD.
// Never returns creds to the client; only the short-lived login link. Degrades to null (never throws upstream)
// when unconfigured or BC errors.

// Tolerate a pasted-in slip: strip whitespace/table-border junk, repair a single-slash scheme, drop trailing /.
const BC = () => {
  let raw = (process.env.BC_CSR_API_URL || '').replace(/[│|\r\n\t"'<>]/g, ' ').trim();
  raw = raw.replace(/(https?):\/(?!\/)/i, '$1://'); // https:/host → https://host
  const m = raw.match(/https?:\/\/\S+/i);           // first clean http(s) token, if any survived
  return (m ? m[0] : raw).replace(/\/+$/, '');
};
export const hasBcAutoLogin = () => !!(BC() && process.env.BC_CSR_USERNAME && process.env.BC_CSR_PASSWORD);

// BC requires ?clientId=&apiId= on every request (see apiWrapper _loginDirectly / _generateRandomId):
// 32-char alphanumeric. Missing them → 400 on /auth/login.
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomId() {
  const arr = new Uint32Array(32);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (v) => CHARSET[v % CHARSET.length]).join('');
}
const withIds = (path) => `${BC()}${path}${path.includes('?') ? '&' : '?'}clientId=${randomId()}&apiId=${randomId()}`;

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
  const res = await fetch(withIds('/auth/login'), {
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
  const res = await fetch(withIds(path), {
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
  // user.find (api.user.find → /database/search). BC honors filters ONLY under `query`, and REQUIRES
  // brandId (an unbranded query returns nothing / the wrong brand's docs). See apiWrapperCsr csrFindUsers.
  const brandId = process.env.BC_BRAND_ID || 'idlookup';
  const r = await csrPost('/database/search', { brandId, collectionName: 'users', query: { email: em } }, jar);
  const docs = (Array.isArray(r) && r)
    || r?.docs || r?.data || r?.raws || r?.results || r?.users
    || r?.data?.docs || [];
  const list = Array.isArray(docs) ? docs : [];
  const hit = list.find((d) => String(d.email || '').toLowerCase() === em) || list[0];
  // Diagnostics (no PII): how many docs came back + the response's top-level keys, so a miss is debuggable.
  const debug = { docCount: list.length, keys: r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r).slice(0, 12) : (Array.isArray(r) ? ['<array>'] : []) };
  return { userId: hit ? (hit._id || hit.id) : null, debug };
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
    const { userId, debug } = await resolveUserId(email, jar);
    if (!userId) return { url: null, userId: null, error: 'user not found', debug };
    const r = await csrPost('/user/management/getAutoLoginUrl', { userId, redirect }, jar);
    const url = extractUrl(r);
    return { url, userId, error: url ? undefined : 'no url in response', raw: url ? undefined : r };
  } catch (e) {
    _session = null; // drop a possibly-stale session so the next call re-logs in
    return { url: null, userId: null, error: String((e && e.message) || e) };
  }
}
