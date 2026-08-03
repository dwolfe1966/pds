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

// App-level gate (WSFY-AUTH interim, same key as memberEnrichment): proves the call came from our app.
function appKeyHeaders() {
  const k = process.env.REACT_APP_WSFY_APP_KEY;
  return k ? { 'X-App-Key': k } : {};
}

function currentUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u && String(u.id || u.userId || u._id || u.uniqueId || '');
  } catch { return ''; }
}

/**
 * A member's OWN search history, read back cross-device from the corpus we already capture (the same
 * searches WSFY is built on). Shape matches the localStorage ring buffer (utils/searchHistory). Returns
 * [] on any failure so the caller can fall back to the local cache.
 */
export async function fetchSearchHistory() {
  const userId = currentUserId();
  if (!userId) return [];
  try {
    const res = await fetch(`${endpointUrl()}?userId=${encodeURIComponent(userId)}`, { headers: { ...appKeyHeaders() } });
    if (!res.ok) return [];
    const d = await res.json();
    return Array.isArray(d && d.history) ? d.history : [];
  } catch { return []; }
}

/** Delete one server-side captured search (best-effort). id is the server row id. */
export async function deleteServerSearch(id) {
  const userId = currentUserId();
  if (!userId || !id) return false;
  try {
    const res = await fetch(`${endpointUrl()}?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { ...appKeyHeaders() } });
    return res.ok;
  } catch { return false; }
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

/**
 * Identify the searcher: signed-in member (userId + their own name/location) or anonymous
 * (stable session id only). The member's own identity is what lets WSFY later say
 * "Taylor Alldercie searched for you" — captured here, server-side only.
 */
function resolveSearcher() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const userId = u && (u.id || u.userId || u._id);
    if (userId) {
      const firstName = u.firstName || u.firstname || (u.name || '').trim().split(/\s+/)[0] || '';
      const lastName = u.lastName || u.lastname || (u.name || '').trim().split(/\s+/).slice(1).join(' ') || '';
      const name = (u.name || `${firstName} ${lastName}`).trim();
      return {
        type: 'member',
        userId: String(userId),
        name: name || undefined,
        firstName: firstName || undefined,
        city: u.city || u.addressCity || undefined,
        state: u.state || u.addressState || undefined,
      };
    }
  } catch { /* ignore */ }
  return { type: 'anon', sessionId: getOrCreateAnonId() };
}

/**
 * The current searcher's ids, for WSFY self-exclusion — so a lead's OWN self-check searches don't get
 * counted as "someone searched for you". Member → userId (search_activity.searcher_user_id); anon → session
 * (search_activity.session_id, since anon searcher_user_id is null). Stamped onto a self-check lead at capture.
 */
export function currentSearcherIds() {
  const s = resolveSearcher();
  return { searcherUserId: s.userId || null, searcherSession: s.sessionId || null };
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

function viewEndpointUrl() {
  if (process.env.REACT_APP_PROFILE_VIEW_URL) return process.env.REACT_APP_PROFILE_VIEW_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/profile-view');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/profile-view`;
}

/**
 * Capture one PROFILE VIEW — a member opened someone's full profile/report (higher intent than a
 * search). Fire-and-forget. Feeds "who viewed my profile": viewer = the current member
 * (resolveSearcher), subject = the person viewed. Server drops self-views by userId.
 * @param {object} p  { subject:{name|fullName, first|firstName, last|lastName, state, profileId}, source?, meta? }
 */
export function captureProfileView(p) {
  if (!p || typeof p !== 'object' || !p.subject) return;
  const s = p.subject;
  const name = s.name || s.fullName || '';
  if (!name) return;
  const payload = {
    viewer: resolveSearcher(),
    subject: {
      name,
      first: s.first || s.firstName || null,
      last: s.last || s.lastName || null,
      state: s.state || null,
      profileId: s.profileId || null,
    },
    source: p.source || 'app',
    meta: p.meta || {},
    ts: new Date().toISOString(),
  };
  try {
    fetch(viewEndpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}
