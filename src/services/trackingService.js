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
// attribution — the queryable client-side path while BC's order-level
// `commerceorders.refer` isn't persisting (#77). Read straight from
// sessionStorage to keep this module import-light and never-throw.
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
    return Object.keys(refer).length ? refer : undefined;
  } catch { return undefined; }
}

export function track(eventName, properties = {}) {
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString();

  // BC tracking — primary. type prefix keeps client events distinct from
  // BC's auto-recorded USER:* events. `refer` carries first-touch attribution
  // (shn/shl + ad params) per BC's data.refer convention.
  const refer = buildRefer();
  try {
    api.createTracking({
      type: `CLIENT:${eventName}`,
      sessionId,
      timestamp,
      ...(refer ? { refer } : {}),
      ...properties,
    });
  } catch (_) {}

  // Local NDJSON mirror — dev-only. Shape unchanged for backwards compat with
  // the existing admin analytics page that reads this log.
  if (LOCAL_TRACKING_URL) {
    try {
      fetch(LOCAL_TRACKING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventName, timestamp, sessionId, properties: { ...(refer ? { refer } : {}), ...properties } }),
      }).catch(() => {});
    } catch (_) {}
  }
}

export default { track };
