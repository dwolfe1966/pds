// Local login history — last N sign-in events for the current browser.
//
// BC records `USER:login` server-side and we additionally record `CLIENT:login`
// via apiWrapper.api.tracking.create, but neither is queryable from the
// consumer side today (tracking.findUser is a CSR-only endpoint). This module
// keeps a small per-browser ring buffer in localStorage so the member dashboard
// can show recent sign-ins.

const KEY = 'loginHistory';
const MAX = 20;

function readRaw() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeRaw(arr) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX)));
  } catch {}
}

/**
 * Record a sign-in event. Safe to call multiple times — duplicates within the
 * same minute are coalesced so a refresh doesn't pile up entries.
 *
 * @param {object} meta
 * @param {string} [meta.method] - 'password' | 'signup' | 'auto'
 * @param {string} [meta.source] - which page initiated the sign-in
 * @param {string} [meta.email]
 */
export function recordLogin(meta = {}) {
  const now = Date.now();
  const existing = readRaw();
  const last = existing[0];
  if (last && now - new Date(last.timestamp).getTime() < 60_000 && last.method === (meta.method || 'password')) {
    return;
  }
  const entry = {
    timestamp: new Date(now).toISOString(),
    method: meta.method || 'password',
    source: meta.source || null,
    email: meta.email || null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };
  writeRaw([entry, ...existing]);
}

export function readLoginHistory() {
  return readRaw();
}

export function clearLoginHistory() {
  writeRaw([]);
}
