// Tracking service — fire-and-forget event logging
// Never throws; errors are silently swallowed so tracking never breaks the app.

const SESSION_KEY = 'trackingSessionId';

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
  // Fire and forget — do not await, do not surface errors
  fetch('http://localhost:3001/api/v1/admin/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export default { track };
