/**
 * General email-capture mechanism.
 *
 * Owner directive (2026-07-11): "anytime we capture an email, push it to an API
 * endpoint (can be ours) and store in a db or local file." Use this ONE function
 * everywhere we capture an email (BV mid-loader gate, and any future capture point)
 * so leads land consistently in two places:
 *   1. localStorage — a durable first-party lead log on the device (survives the
 *      rest of the session/flow), plus the latest email for signup pre-fill.
 *   2. Our lead API endpoint — fire-and-forget POST so a server can persist it to a
 *      db / local file. Dev = the mock server (`/api/v1/leads` → server/leads.jsonl).
 *      Prod endpoint is configurable (REACT_APP_LEAD_CAPTURE_URL) — point it at the
 *      first-party email backend (area iv) when it exists.
 *
 * PII boundary: the email VALUE goes here (this is the lead store, on purpose). It
 * must NEVER be put on the analytics `email_capture` event — see docs/EVENTS_CATALOG.md §2.
 */

const LS_LOG = 'capturedEmails';   // durable array of all captures on this device
const LS_LATEST = 'capturedEmail'; // latest email, for signup pre-fill

function leadUrl() {
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) return process.env.REACT_APP_LEAD_CAPTURE_URL;
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/leads`;
}

/**
 * Capture an email lead. Stores locally and pushes to our lead endpoint.
 * @param {string} email
 * @param {object} [meta]  non-PII context (source, variant, dest, searchType, …)
 */
export function captureEmail(email, meta = {}) {
  if (!email || typeof email !== 'string') return;
  const rec = { email, meta, ts: new Date().toISOString() };

  // 1) Durable local store (works with no backend) + latest-for-prefill.
  try {
    const log = JSON.parse(localStorage.getItem(LS_LOG) || '[]');
    log.push(rec);
    localStorage.setItem(LS_LOG, JSON.stringify(log));
    localStorage.setItem(LS_LATEST, email);
  } catch { /* storage unavailable */ }

  // 2) Push to our API endpoint (fire-and-forget; local store is the fallback).
  try {
    fetch(leadUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
      keepalive: true, // survive a navigation right after capture
    }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}

/** Latest captured email (for pre-filling the signup form). '' if none. */
export function getCapturedEmail() {
  try { return localStorage.getItem(LS_LATEST) || ''; } catch { return ''; }
}

function checkoutAbandonedUrl() {
  if (process.env.REACT_APP_CHECKOUT_ABANDONED_URL) return process.env.REACT_APP_CHECKOUT_ABANDONED_URL;
  return leadUrl().replace(/\/leads\/?$/, '/checkout-abandoned');
}

/**
 * Post an abandoned-checkout event to the growth backend (Vercel), so a recovery email
 * can be sent downstream. Fire-and-forget with `keepalive` because it's fired on page
 * unload (pagehide). Same independence as captureEmail: BC is not involved.
 * @param {object} payload  { email?, personId?, offer?, variant?, meta?, ts? }
 */
export function captureAbandonedCheckout(payload) {
  try {
    fetch(checkoutAbandonedUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}
