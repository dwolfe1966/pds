/**
 * Search-activity capture — the client half of WSFY ("Who's Searching For You"), which we
 * build ourselves (BC doesn't expose an inbound-activity finder). After every search returns,
 * we POST a copy of the terms + result set to our growth backend (idlookup.me Vercel + Neon),
 * fire-and-forget, INDEPENDENT of BC (BC just served the search).
 *
 * Phase 1 = ingest only (build the corpus). The reverse-join / reveal UI is Phase 2.
 *
 * PII boundary: this stores names, the searcher, and result people SERVER-SIDE on purpose —
 * it IS the corpus. It must NEVER be put on the analytics dataLayer. See emailCapture.js.
 */

const LS_ANON = 'sa_anon_id';

function endpointUrl() {
  if (process.env.REACT_APP_SEARCH_ACTIVITY_URL) return process.env.REACT_APP_SEARCH_ACTIVITY_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/search-activity');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/search-activity`;
}

/** Stable per-device id for anonymous (logged-out) searchers. */
function getOrCreateAnonId() {
  try {
    let id = localStorage.getItem(LS_ANON);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `a-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LS_ANON, id);
    }
    return id;
  } catch { return null; }
}

/** Identify the searcher: signed-in member (userId) or anonymous (stable session id). */
function resolveSearcher() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const userId = u && (u.id || u.userId || u._id);
    if (userId) return { type: 'member', userId: String(userId) };
  } catch { /* ignore */ }
  return { type: 'anon', sessionId: getOrCreateAnonId() };
}

/** Drop heavy nested payloads (raw BC blobs) so the POST body stays small. */
function trimResult(r) {
  if (!r || typeof r !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    if (['rawResponse', 'raws', 'commerceContent', '_raw', 'raw'].includes(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Capture one search. Fire-and-forget.
 * @param {object} p  { type, terms, results, source, meta? }
 */
export function captureSearchActivity(p) {
  if (!p || typeof p !== 'object') return;
  const results = Array.isArray(p.results) ? p.results.slice(0, 50).map(trimResult) : [];
  const payload = {
    searcher: resolveSearcher(),
    type: p.type || null,
    terms: p.terms || {},
    results,
    source: p.source || null,
    meta: p.meta || {},
    ts: new Date().toISOString(),
  };
  try {
    fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}
