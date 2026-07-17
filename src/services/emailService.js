/**
 * First-party email — client half. Fires lifecycle/marketing sends through our own /api/email/send on
 * the idlookup.me Vercel server (SendGrid, suppression-aware, logged), independent of BC's transactional
 * mail. Fire-and-forget: a no-op until SendGrid is configured server-side (endpoint returns 'disabled'),
 * so wiring triggers now is safe.
 */
function endpointUrl() {
  if (process.env.REACT_APP_EMAIL_SEND_URL) return process.env.REACT_APP_EMAIL_SEND_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/email/send');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/email/send`;
}

// Same app-key gate as WSFY/enrichment (the send endpoint is app-key protected).
function appKeyHeaders() {
  const k = process.env.REACT_APP_WSFY_APP_KEY;
  return k ? { 'X-App-Key': k } : {};
}

/**
 * Send a registered campaign (rendered server-side) or a pre-rendered email. Fire-and-forget.
 * @param {object} p  { to, campaign?, vars?, subject?, html?, text?, meta? }
 */
export function sendCampaignEmail(p) {
  if (!p || !p.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.to))) return;
  try {
    fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify(p),
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}
