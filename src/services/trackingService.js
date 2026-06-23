// Tracking service — fire-and-forget consumer event logging.
// Never throws; errors are silently swallowed so tracking never breaks the app.
//
// Primary target: BC `apiWrapper.api.tracking.create({ type, ...data })`
// via api.createTracking. Events are namespaced `CLIENT:<eventName>` so they
// are distinct from BC's server-recorded `USER:*` events and can be queried
// in admin via csrWrapper.api.tracking.findUser.
//
// Dev-only mirror: if REACT_APP_TRACKING_API_URL is set (or NODE_ENV=development
// and port 3002 is running), also posts to the local NDJSON service for
// inspection via the admin analytics pages.

import api from '../api';

const SESSION_KEY = 'trackingSessionId';

const LOCAL_TRACKING_URL = process.env.REACT_APP_TRACKING_API_URL
  ? `${process.env.REACT_APP_TRACKING_API_URL}/track`
  : (process.env.NODE_ENV === 'development' ? 'http://localhost:3002/track' : null);

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Attribution captured at first touch (gtm.captureReferralParams →
// 'referralParams'; CampaignContext → 'attribution.shn'/'shl'). Assembled into
// BC's `data.refer` convention so every tracked event carries partner/ad
// attribution. (Order-level `commerceorders.refer` DOES persist — confirmed by
// BC 2026-06-04 — and is now fed the first-touch refer_* params at checkout via
// `buildReferQueryString`; this tracking-store path remains the broader signal.)
// Read straight from sessionStorage to keep this module import-light and never-throw.
function buildRefer() {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    let params = {};
    try { params = JSON.parse(sessionStorage.getItem('referralParams') || '{}') || {}; } catch { params = {}; }
    const refer = {};
    // BC sample uses `source`; alias from utm_source.
    if (params.utm_source) refer.source = params.utm_source;
    // Pass click IDs, utm, and refer_* through verbatim when present.
    ['gclid', 'fbclid', 'msclkid', 'utm_medium', 'utm_campaign',
     'refer_partnerId', 'refer_afid', 'refer_abc'].forEach((k) => {
      if (params[k]) refer[k] = params[k];
    });
    const shn = sessionStorage.getItem('attribution.shn');
    const shl = sessionStorage.getItem('attribution.shl');
    if (shn) refer.shn = shn;
    if (shl) refer.shl = shl;
    // Resolved partner identity (CampaignContext) for per-partner/channel reporting.
    const shnName = sessionStorage.getItem('attribution.shnName');
    const partner = sessionStorage.getItem('attribution.partner');
    const channel = sessionStorage.getItem('attribution.channel');
    if (shnName) refer.shnName = shnName;
    if (partner) refer.partner = partner;
    if (channel) refer.channel = channel;
    return Object.keys(refer).length ? refer : undefined;
  } catch { return undefined; }
}

// First-touch attribution as a BC `queryString` for commerce calls
// (billing.sale/signup). BC ingests ONLY `refer_`-prefixed params into
// `commerceorders.refer`, stripping the prefix (`refer_partnerId` → `refer.partnerId`,
// confirmed persisting 2026-06-04). A raw `gclid=` is therefore DROPPED at the order
// (verified 2026-06-15: refer_* reached commerce, raw gclid did not). So we send the
// click-join keys under the same proven convention — `refer_gclid` → `refer.gclid`
// etc. — to get the §M6 click-grain join key (gclid) onto the billable order, not
// just the tracking-store `data.refer`. Returns undefined when no attribution is
// present. Never throws (sensitive checkout path).
export function buildReferQueryString() {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    let params = {};
    try { params = JSON.parse(sessionStorage.getItem('referralParams') || '{}') || {}; } catch { params = {}; }
    const out = [];
    const push = (k, v) => { if (v != null && v !== '') out.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`); };
    // Sub-publisher params — already round-trip onto commerceorders.refer.
    ['refer_partnerId', 'refer_afid', 'refer_abc'].forEach((k) => push(k, params[k]));
    // Click-join keys under the refer_ convention so BC lands them as refer.gclid /
    // refer.fbclid / refer.msclkid on the order (raw gclid= is dropped — no slot).
    push('refer_gclid', params.gclid);
    push('refer_fbclid', params.fbclid);
    push('refer_msclkid', params.msclkid);
    return out.length ? out.join('&') : undefined;
  } catch { return undefined; }
}

// BC's IIFE tracking endpoint is cold on the first paint, so the earliest event
// (landing_view, #63) gets dropped. Rather than guess when it's warm, retry the
// send with backoff until BC accepts it (createTracking returns null on failure,
// a truthy response on success). Warm events succeed on attempt 0 — no retry.
const RETRY_BACKOFF_MS = [2000, 5000, 12000];

async function _sendToBC(eventName, payload, attempt = 0) {
  let res = null;
  try {
    res = await api.createTracking({ type: `CLIENT:${eventName}`, ...payload });
  } catch (_) { res = null; }
  if (res != null) return; // BC accepted it
  const delay = RETRY_BACKOFF_MS[attempt];
  if (delay != null) {
    setTimeout(() => { _sendToBC(eventName, payload, attempt + 1); }, delay);
  }
}

// GAP-7 (reporting): stamp logged-in state + userId on EVERY CLIENT:* event so
// visitor-vs-member is unambiguous at the source (no need to infer from surrounding
// events). Read straight from localStorage; never throw. BC's server-side USER:*
// events already carry the user — this covers the client-emitted CLIENT:* stream.
function memberContext() {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const loggedIn = !!token;
    let userId;
    if (loggedIn) {
      try { const u = JSON.parse(localStorage.getItem('user') || 'null'); userId = u?.id || u?._id || undefined; } catch { /* ignore */ }
    }
    return { loggedIn, ...(userId ? { userId } : {}) };
  } catch { return { loggedIn: false }; }
}

export function track(eventName, properties = {}) {
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString();

  // BC tracking — primary. `refer` carries first-touch attribution (shn/shl + ad
  // params) per BC's data.refer convention. Retries cover the cold-start window.
  const refer = buildRefer();
  const member = memberContext(); // GAP-7: loggedIn + userId on every event
  _sendToBC(eventName, { sessionId, timestamp, ...member, ...(refer ? { refer } : {}), ...properties });

  // Local NDJSON mirror — dev-only. Shape unchanged for backwards compat with
  // the existing admin analytics page that reads this log.
  if (LOCAL_TRACKING_URL) {
    try {
      fetch(LOCAL_TRACKING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventName, timestamp, sessionId, ...member, properties: { ...(refer ? { refer } : {}), ...properties } }),
      }).catch(() => {});
    } catch (_) {}
  }
}

export default { track };
