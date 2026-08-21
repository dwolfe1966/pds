/**
 * webEvents — asynchronous, NON-BLOCKING push of every client event to our own activity log
 * (idlookup.me Neon `web_events`). Owner 2026-08-21: analyze the funnel BY VARIANT and by lifecycle
 * (visitor/member/paid) in a DB we own, independent of GA4 (org-blocked).
 *
 * HARD RULE (owner): posting must never block the UI. We use navigator.sendBeacon (fire-and-forget,
 * survives unload) with a text/plain blob (a CORS-simple content type → no preflight), falling back to
 * fetch({keepalive:true}). Every path is wrapped so a logging failure can never throw into the app.
 *
 * PII: this rides the same anon_id as search-activity but sends only funnel dims + whatever the caller
 * puts in pageData. Do NOT pass raw email/phone/zip here.
 */

const LS_ANON = 'sa_anon_id'; // shared with searchActivity so a visitor stitches across both logs

let _paidHint = false; // runtime-only paid hint (never persisted — BC billing stays the authority)
export function setPaidHint(isPaid) { _paidHint = !!isPaid; }

function endpointUrl() {
  if (process.env.REACT_APP_WEB_EVENTS_URL) return process.env.REACT_APP_WEB_EVENTS_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/web-events');
  const base = process.env.REACT_APP_API_URL || '';
  return base ? `${base.replace(/\/$/, '')}/web-events` : '';
}

function rid() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* ignore */ }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function anonId() {
  try {
    let id = localStorage.getItem(LS_ANON);
    if (!id) { id = rid(); localStorage.setItem(LS_ANON, id); }
    return id;
  } catch { return null; }
}

function currentUserId() {
  try { const u = JSON.parse(localStorage.getItem('user') || 'null'); return (u && String(u.id || u.userId || u._id || u.uniqueId || '')) || null; } catch { return null; }
}

function userState(ctx) {
  const s = ctx && ctx.userState;
  if (s === 'visitor' || s === 'member' || s === 'paid') return s;
  if (_paidHint) return 'paid';
  try { return localStorage.getItem('accessToken') ? 'member' : 'visitor'; } catch { return 'visitor'; }
}

function attribution() {
  const out = {};
  try {
    const p = new URLSearchParams(window.location.search);
    out.shn = p.get('shn') || sessionStorage.getItem('shn') || null;
    out.partner = sessionStorage.getItem('idlPartnerBrand') || p.get('partner') || null;
  } catch { /* ignore */ }
  return out;
}

/**
 * logWebEvent(event, pageData?, ctx?) — fire-and-forget. NEVER await this in a UI path.
 * ctx: { sessionId, userId, userState, variant } (trackingService passes these through).
 */
export function logWebEvent(event, pageData = {}, ctx = {}) {
  try {
    if (!event || typeof window === 'undefined') return;
    const url = endpointUrl();
    if (!url) return;
    const { shn, partner } = attribution();
    const payload = {
      event,
      clientTs: new Date().toISOString(),
      userId: ctx.userId || currentUserId(),
      userState: userState(ctx),
      anonId: anonId(),
      sessionId: ctx.sessionId || null,
      variant: ctx.variant || pageData.variant || pageData.sup_variant || null,
      shn, partner,
      page: window.location.pathname,
      referrer: document.referrer || null,
      pageData: pageData && typeof pageData === 'object' ? pageData : {},
    };
    const bodyText = JSON.stringify(payload);
    // Primary: sendBeacon with a simple content type (no CORS preflight, survives unload).
    if (navigator && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(url, new Blob([bodyText], { type: 'text/plain;charset=UTF-8' }));
      if (ok) return;
    }
    // Fallback: keepalive fetch, still non-blocking (not awaited); swallow all errors.
    fetch(url, { method: 'POST', body: bodyText, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
  } catch { /* logging must never break the app */ }
}
