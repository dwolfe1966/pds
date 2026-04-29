/**
 * Visitor search log — persists every search a logged-out visitor runs to
 * localStorage so we can re-attach those searches to their account when they
 * sign up. Without this, search intent is lost the moment a visitor converts.
 *
 * Storage shape (under key VISITOR_SEARCH_LOG_KEY):
 *   { sessionId: '<trackingSessionId>', items: [{ type, query, resultCount, ts }, ...] }
 *
 * - `type`: 'name' | 'phone' | 'email'
 * - `query`: { firstName, lastName, state, phone, email, ... } — same shape /searches/me uses
 * - `resultCount`: number of results returned (0 if not known yet)
 * - `ts`: ISO timestamp
 *
 * Bounded at MAX_ITEMS to avoid unbounded localStorage growth on power users
 * who never sign up.
 */

const VISITOR_SEARCH_LOG_KEY = 'visitorSearchLog';
const TRACKING_SESSION_KEY = 'trackingSessionId';
const MAX_ITEMS = 50;

function readSessionId() {
  try {
    return sessionStorage.getItem(TRACKING_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

function readRaw() {
  try {
    const raw = localStorage.getItem(VISITOR_SEARCH_LOG_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeRaw(value) {
  try {
    localStorage.setItem(VISITOR_SEARCH_LOG_KEY, JSON.stringify(value));
  } catch {
    /* localStorage may be unavailable (private mode, quota) — non-fatal */
  }
}

/**
 * Append a single search to the log. Idempotent on rapid duplicates within
 * 5 seconds of the same query (covers React StrictMode double-render).
 */
export function appendSearch({ type, query, resultCount = 0 } = {}) {
  if (!type || !query) return;
  const log = readRaw() || { sessionId: readSessionId(), items: [] };
  const now = Date.now();
  const last = log.items[log.items.length - 1];
  if (last && last.type === type && now - new Date(last.ts).getTime() < 5000) {
    const sameQuery = JSON.stringify(last.query) === JSON.stringify(query);
    if (sameQuery) return;
  }
  log.items.push({
    type,
    query,
    resultCount,
    ts: new Date(now).toISOString(),
  });
  if (log.items.length > MAX_ITEMS) {
    log.items = log.items.slice(-MAX_ITEMS);
  }
  // Refresh sessionId in case it was assigned after first append.
  if (!log.sessionId) log.sessionId = readSessionId();
  writeRaw(log);
}

/**
 * Read the full log. Returns { sessionId, items } or { sessionId: null, items: [] }.
 */
export function readLog() {
  return readRaw() || { sessionId: null, items: [] };
}

/**
 * Clear the visitor log. Call after successful import on signup.
 */
export function clearLog() {
  try {
    localStorage.removeItem(VISITOR_SEARCH_LOG_KEY);
  } catch {
    /* non-fatal */
  }
}
