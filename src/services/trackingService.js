// Tracking service — fire-and-forget event logging
// Never throws; errors are silently swallowed so tracking never breaks the app.
//
// Target: REACT_APP_TRACKING_API_URL (standalone tracking-api service, port 3002).
// Falls back to the legacy mock-server endpoint so existing dev flows keep working
// if the tracking API is not running.

const SESSION_KEY = 'trackingSessionId';

const TRACKING_URL = process.env.REACT_APP_TRACKING_API_URL
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

export function track(eventName, properties = {}) {
  const payload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    properties,
  };
  if (!TRACKING_URL) return;
  // Fire and forget — do not await, do not surface errors
  fetch(TRACKING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export default { track };
