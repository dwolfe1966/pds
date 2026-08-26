// Tracking service — fire-and-forget consumer event logging.
// Never throws; errors are silently swallowed so tracking never breaks the app.
//
// Primary target: BC `apiWrapper.api.tracking.create({ type, ...data })`
// via api.createTracking. Events are namespaced `CLIENT:<eventName>` so they
// are distinct from BC's server-recorded `USER:*` events and can be queried
// in admin via csrWrapper.api.tracking.findUser.
//
// Optional mirror to the standalone tracking-api (DEPRECATED — not in the prod
// path; real analytics go to BC via createTracking + GA4/GTM). Only fires when
// REACT_APP_TRACKING_API_URL is explicitly set; no dev auto-fallback to :3002
// (that just threw connection-refused noise since the service isn't run).

import api from '../api';
import { getContextSnapshot } from './gtmContext';
import { logWebEvent } from './webEvents';

const SESSION_KEY = 'trackingSessionId';

const LOCAL_TRACKING_URL = process.env.REACT_APP_TRACKING_API_URL
  ? `${process.env.REACT_APP_TRACKING_API_URL}/track`
  : null;

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
// True when this visit is SEO/referral traffic from our directory idlookup.me — either
// tagged (?utm_source=idlookup.me / seo) or referred by idlookup.me. Used to override the
// shN-derived (default) partner/channel so SEO thin-matches aren't booked as paid.
// (Attribution audit 2026-07-11 — docs/reporting/thin-match-attribution-2026-07.md.)
function isIdlookupReferral(params) {
  try {
    const src = ((params && params.utm_source) || '').toLowerCase();
    if (src === 'idlookup.me' || src === 'seo') return true;
    const ref = (typeof document !== 'undefined' && document.referrer) || '';
    return ref ? /(^|\.)idlookup\.me$/i.test(new URL(ref).hostname) : false;
  } catch { return false; }
}

// Derived, partner-specific attribution (source/medium/campaign/partnerId) resolved from the campaign
// registry `identity.refer` block and persisted by CampaignContext. Used to gap-fill BC attribution when
// the inbound link carried NO utm/refer_ of its own — e.g. shn-only HomeFacts links, where BC tracking
// would otherwise show empty source/medium/campaign/partnerId. Deliberately scoped to the utm/refer_
// namespace: it NEVER carries shn/partner/channel field names (those overrode + nullified BC's own
// tracking.partner automation on 2026-08-06). Never throws.
function derivedRefer() {
  if (typeof sessionStorage === 'undefined') return {};
  try { return JSON.parse(sessionStorage.getItem('attribution.refer') || '{}') || {}; } catch { return {}; }
}

function buildRefer() {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    let params = {};
    try { params = JSON.parse(sessionStorage.getItem('referralParams') || '{}') || {}; } catch { params = {}; }
    const refer = {};
    // BC sample uses `source`; alias from utm_source.
    if (params.utm_source) refer.source = params.utm_source;
    // Pass click IDs, utm, and refer_* through verbatim when present.
    // utm_term (keyword) + utm_content (creative) added so reporting can analyze
    // conversion by keyword/creative, not just campaign.
    ['gclid', 'fbclid', 'msclkid', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
     'refer_partnerId', 'refer_afid', 'refer_abc'].forEach((k) => {
      if (params[k]) refer[k] = params[k];
    });
    // Affiliate sub-IDs: carry every captured refer_* into the tracking refer too, so
    // data.refer and the order's commerceorders.refer stay in sync. shn/shl excluded.
    Object.keys(params).forEach((k) => { if (/^refer_/i.test(k) && params[k] && !(k in refer)) refer[k] = params[k]; });
    // Gap-fill from the derived partner attribution (real utm/refer_ from the URL always wins).
    const d = derivedRefer();
    if (!refer.source && d.source) refer.source = d.source;
    if (!refer.utm_medium && d.medium) refer.utm_medium = d.medium;
    if (!refer.utm_campaign && d.campaign) refer.utm_campaign = d.campaign;
    if (!refer.refer_partnerId && d.partnerId) refer.refer_partnerId = d.partnerId;
    // Partner/channel LABELS for reporting. Removed 2026-08-06 on the theory BC's tracking.partner.*
    // was authoritative — but our reporting reads data.refer, so that removal blacked out partner/channel
    // classification SITE-WIDE from Aug 7 (all traffic incl. Google). Restored 2026-08-13. To eliminate the
    // 8/06 concern (our value overriding/diverging from BC's): prefer BC's OWN resolved value (mirrored from
    // the shape into attribution.bc.*) so what we report IS BC's value; fall back to the registry identity
    // only where BC has none. Lowercased to BC's stored form (kills the 'Search' vs 'search' miscasing that
    // motivated 8/06). shn/shl still NOT sent — those are the fields most entangled with BC's own automation
    // and bigbot confirms the shN itself is fine.
    const lc = (v) => (typeof v === 'string' && v ? v.toLowerCase() : undefined);
    const partner = lc(sessionStorage.getItem('attribution.bc.partner') || sessionStorage.getItem('attribution.partner'));
    const channel = lc(sessionStorage.getItem('attribution.bc.channel') || sessionStorage.getItem('attribution.channel'));
    const shnName = sessionStorage.getItem('attribution.shnName');
    if (shnName && !refer.shnName) refer.shnName = shnName;
    if (partner && !refer.partner) refer.partner = partner;
    if (channel && !refer.channel) refer.channel = channel;
    // SEO/referral from idlookup.me has NO shN → partner/channel above resolve to the DEFAULT shN (which
    // reads as "paid"). Override to an explicit referral channel so reporting books it as SEO, not paid —
    // the 7/31 proven-good pattern (partner idlookup.me / channel referral). Only mutates the reported
    // refer object, not the stored attribution.
    if (isIdlookupReferral(params)) {
      refer.source = 'idlookup.me';
      refer.channel = 'referral';
      refer.partner = 'idlookup.me';
    }
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
    const seen = new Set();
    const push = (k, v) => { if (v != null && v !== '' && !seen.has(k)) { seen.add(k); out.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`); } };
    const d = derivedRefer();
    // Sub-publisher params — already round-trip onto commerceorders.refer. Fall back to the derived
    // partner attribution for partnerId so shn-only partner links (HomeFacts) still book to the partner.
    push('refer_partnerId', params.refer_partnerId || d.partnerId);
    ['refer_afid', 'refer_abc'].forEach((k) => push(k, params[k]));
    // Affiliate sub-IDs: emit EVERY captured refer_* param verbatim so BC lands each
    // on commerceorders.refer (prefix stripped) — the arbitrary partner join keys
    // (refer_clickid, refer_s1, …) the postback echoes back. `seen` dedups the
    // explicit keys above; refer_source/medium/campaign are still set below.
    Object.keys(params).forEach((k) => { if (/^refer_/i.test(k)) push(k, params[k]); });
    // Click-join keys under the refer_ convention so BC lands them as refer.gclid /
    // refer.fbclid / refer.msclkid on the order (raw gclid= is dropped — no slot).
    push('refer_gclid', params.gclid);
    push('refer_fbclid', params.fbclid);
    push('refer_msclkid', params.msclkid);
    // Traffic source onto the ORDER so revenue books to the right channel, not the default
    // shN. SEO/referral from idlookup.me is the key case (attribution audit 2026-07-11):
    // its thin-match orders were misbooked as paid. ⚠️ NEEDS BC CONFIRM that refer_source /
    // refer_channel persist onto commerceorders.refer like refer_partnerId does.
    if (isIdlookupReferral(params)) {
      push('refer_source', 'idlookup.me');
      push('refer_channel', 'referral');
    } else if (params.utm_source) {
      push('refer_source', params.utm_source);
    }
    // Derived partner attribution — fills refer_source/medium/campaign for shn-only partner links
    // (HomeFacts). `push` dedupes via `seen`, so any real utm/referral value set above wins. BC strips
    // the refer_ prefix → commerceorders.refer.{source,medium,campaign}. (utm namespace only — no shn.)
    push('refer_source', d.source);
    push('refer_medium', d.medium);
    push('refer_campaign', d.campaign);
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
    // `actor` is the human-readable form of loggedIn for reporting: every search
    // is either pre-signup ('visitor') or post-login ('member'). (We deliberately
    // do NOT split out 'subscriber'/paid here — derived paid state isn't cached
    // client-side; member vs visitor is the dimension we report on.)
    return { loggedIn, actor: loggedIn ? 'member' : 'visitor', ...(userId ? { userId } : {}) };
  } catch { return { loggedIn: false, actor: 'visitor' }; }
}

// Funnel attribution: the landing `variant` + `search_type` are persisted at the
// landing page (useLandingTrack → persistFunnelEntry) so EVERY later event —
// signup_complete, payment_complete, dashboard_*, etc. — can be attributed back
// to the ad-unit variant the user arrived on, not just the landing/step events.
// Read straight from sessionStorage; never throw. Session-scoped: a fresh tab
// with no landing visit carries nothing (correct — no funnel entry this session).
function funnelContext() {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const out = {};
    const variant = sessionStorage.getItem('funnel.variant');
    const searchType = sessionStorage.getItem('funnel.searchType');
    const supVariant = sessionStorage.getItem('funnel.supVariant');
    if (variant) out.variant = variant;
    if (searchType) out.search_type = searchType;
    if (supVariant) out.sup_variant = supVariant;
    return out;
  } catch { return {}; }
}

// Persist the funnel entry point. Called once at landing mount. Last-touch within
// the session wins (e.g. name/v2 then phone/v3 → phone/v3 is the entry of record).
export function persistFunnelEntry(searchType, variant) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (variant) sessionStorage.setItem('funnel.variant', variant);
    if (searchType) sessionStorage.setItem('funnel.searchType', searchType);
  } catch { /* ignore */ }
}

// Funnel step timing — ms between consecutive funnel-progression events
// (landing_view → search_step → search_step …). Computed centrally so no
// per-wizard change is needed. landing_view starts the clock (no duration);
// each search_step reports time-on-previous-step. Answers "which step is slow /
// where do they hesitate" without touching every funnel file.
function funnelStepDuration(eventName) {
  if (typeof sessionStorage === 'undefined') return {};
  if (eventName !== 'landing_view' && eventName !== 'search_step') return {};
  try {
    const now = Date.now();
    const prev = parseInt(sessionStorage.getItem('funnel.lastStepTs') || '0', 10) || 0;
    sessionStorage.setItem('funnel.lastStepTs', String(now));
    return (eventName === 'search_step' && prev) ? { step_duration_ms: now - prev } : {};
  } catch { return {}; }
}

// Fire a structured drop-off signal. `reason` is an enumerated cause (e.g.
// 'fcra_not_agreed', 'name_required', 'state_required', 'invalid_phone',
// 'invalid_email', 'password_too_short'). Carries search_type/variant/step via
// the normal envelope so reporting can see WHY users stall at a step, not just
// that they did.
export function trackValidationError(reason, extra = {}) {
  track('validation_error', { reason, ...extra });
}

export function track(eventName, properties = {}) {
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString();

  // BC tracking — primary. `refer` carries first-touch attribution (shn/shl + ad
  // params) per BC's data.refer convention. Retries cover the cold-start window.
  const refer = buildRefer();
  const member = memberContext(); // GAP-7: loggedIn + actor + userId on every event
  // Funnel entry (variant/search_type) on EVERY event for conversion attribution.
  // Placed before ...properties so a per-call explicit value (landing_view /
  // search_step pass their own) overrides — same value, so it's a no-op there.
  const funnel = funnelContext();
  const stepTiming = funnelStepDuration(eventName); // { step_duration_ms } on search_step
  _sendToBC(eventName, { sessionId, timestamp, ...member, ...funnel, ...stepTiming, ...(refer ? { refer } : {}), ...properties });

  // Mirror to our own web_events activity log (idlookup.me). Async, non-blocking, best-effort —
  // logWebEvent never awaits or throws (owner: posting must never block the UI).
  logWebEvent(eventName, properties, { sessionId, userId: member && member.userId, variant: funnel && funnel.variant });

  // GA4/GTM bridge — surface every CLIENT event on window.dataLayer so the GTM
  // container can forward it to GA4, segmentable by partner/channel and by
  // `actor` (visitor vs member).
  //
  // We push a CURATED object straight to window.dataLayer — deliberately NOT via
  // gtmContext.push(), which force-merges the full 27-field canonical state
  // (email/phone/zip + the searched person's target*/search* fields). That PII
  // must NEVER reach GA4 (Google ToS / property-suspension risk). So we whitelist:
  //   - namespaced event `client_<eventName>` — never collides with gtm.js's
  //     canonical conversion events (purchase/sign_up/login/search_submit/
  //     payment_start/select_content) or GA4's reserved `page_view`.
  //   - funnel dims (step/search_type/variant) — carried in `properties`.
  //   - actor/loggedIn/userId — pseudonymous; userId IS GA4's `user_id`.
  //   - attribution only (partnerName/partnerChannel/shn/shl/shnName).
  //   - `trackingSessionId` — the BC stream's session key, exposed here as the
  //     shared join key between the BC tracking store and GA4 (GTM has its own
  //     UUID sessionId; we do NOT clobber it).
  try {
    if (typeof window !== 'undefined') {
      const ctx = getContextSnapshot() || {};
      const attribution = {};
      ['partnerName', 'partnerChannel', 'shn', 'shl', 'shnName'].forEach((k) => {
        if (ctx[k] != null && ctx[k] !== '') attribution[k] = ctx[k];
      });
      // For SEO/referral from idlookup.me the ctx partnerName is the DEFAULT shN (reads as
      // paid). buildRefer already flagged this visit (refer.partner==='idlookup.me'); mirror
      // that into the GA4 stream so the paid-vs-organic split isn't polluted there either.
      if (refer && refer.partner === 'idlookup.me') {
        attribution.partnerName = 'idlookup.me';
        attribution.partnerChannel = 'referral';
        attribution.source = 'idlookup.me';
      }
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: `client_${eventName}`,
        trackingSessionId: sessionId,
        ...member,
        ...funnel,
        ...stepTiming,
        ...attribution,
        ...properties,
      });
    }
  } catch (_) {}

  // Local NDJSON mirror — dev-only. Shape unchanged for backwards compat with
  // the existing admin analytics page that reads this log.
  if (LOCAL_TRACKING_URL) {
    try {
      fetch(LOCAL_TRACKING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventName, timestamp, sessionId, ...member, properties: { ...funnel, ...stepTiming, ...(refer ? { refer } : {}), ...properties } }),
      }).catch(() => {});
    } catch (_) {}
  }
}

export default { track };
