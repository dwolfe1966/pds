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

import { readLog } from './visitorSearchLog';
import { getVariant } from './funnelFlow';
import { currentSearcherIds } from './searchActivity';

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
  // Enrich with the visitor's most recent search query so the re-engagement drip can PREFILL and resume
  // their own search (the b/friction-reducer, owner 2026-07-27). Their own prior search — no new PII exposed.
  if (!meta.query) {
    try {
      const items = (readLog() || {}).items || [];
      const last = items[items.length - 1];
      if (last && last.query) meta = { ...meta, query: last.query, searchType: last.type };
    } catch { /* best-effort — capture works without it */ }
  }
  // Self-check flow (variant 'self', e.g. /my-exposure): the searched name IS the lead's OWN name. Stamp
  // self + selfName so the WSFY "who searched YOU" email can reverse-join for this lead (REAL signal, not just
  // the general offer). No new PII — meta.query is already their own search. See project_wsfy_self_build.
  try {
    if (!meta.self && getVariant() === 'self') {
      // Prefer the explicit self-identity stash (MyExposurePage) — the data the user declared as THEIR OWN.
      // Fall back to the last search. Capture ALL of it as their identity (owner 2026-08-03).
      let ident = null;
      try { ident = JSON.parse(sessionStorage.getItem('selfIdentity') || 'null'); } catch { ident = null; }
      const q = (ident && typeof ident === 'object') ? ident : (meta.query && typeof meta.query === 'object' ? meta.query : null);
      const sn = q ? [q.firstName, q.lastName].filter(Boolean).join(' ').trim() : '';
      if (sn) {
        // Also stamp the lead's OWN searcher ids so WSFY excludes their self-check searches from their count.
        const { searcherUserId, searcherSession } = currentSearcherIds();
        meta = { ...meta, self: true, selfName: sn,
          selfIdentity: { firstName: q.firstName || undefined, middleName: q.middleName || undefined,
            lastName: q.lastName || undefined, city: q.city || undefined, state: q.state || undefined, age: q.age || undefined },
          selfState: q.state || undefined,
          searcherUserId: searcherUserId || undefined, searcherSession: searcherSession || undefined };
      }
    }
  } catch { /* best-effort — capture works without the self stamp */ }
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
  return leadUrl().replace(/\/leads\/?$/, '/email/checkout-abandoned');
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
