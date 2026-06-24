/**
 * Google Tag Manager dataLayer helpers.
 *
 * GTM is loaded at app boot via initGtm() below when REACT_APP_GTM_ID is set.
 * Push events to `window.dataLayer` for Google Analytics and Google Ads.
 *
 * Usage:
 *   initGtm();                 // once, in src/index.js
 *   gtmPageView('/some/path', 'Page Title');
 *   gtmEvent('sign_up', { method: 'email' });
 */

/**
 * DEPRECATED / NO-OP. GTM is loaded by the per-brand snippet in
 * public/index.html (maps hostname → the right container at runtime, covering
 * all four brands). This used to load a SECOND container from REACT_APP_GTM_ID,
 * which double-loaded GTM (double-counting Google Ads conversions) and loaded
 * the dev container `GTM-WV7N6WWP` on production. Kept as a no-op so any stray
 * import can't re-introduce the double-load; do NOT load GTM here.
 */
export function initGtm() {}

const REFERRAL_KEY = 'referralParams';
const REFERRAL_FIELDS = [
  'refer_partnerId', 'refer_afid', 'refer_abc',
  'utm_source', 'utm_medium', 'utm_campaign',
  // Ad-click IDs — captured for BC tracking `data.refer` attribution.
  // gclid = Google Ads, fbclid = Meta, msclkid = Microsoft Ads.
  'gclid', 'fbclid', 'msclkid',
];

/**
 * Capture campaign/referral parameters from the landing URL on first boot.
 * Safe to call multiple times — existing stored values are not overwritten by
 * subsequent navigations that lack query params.
 */
export function captureReferralParams() {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const captured = {};
    REFERRAL_FIELDS.forEach((f) => {
      const v = params.get(f);
      if (v) captured[f] = v;
    });
    if (Object.keys(captured).length === 0) return;
    const existing = readReferralParams();
    const merged = { ...existing, ...captured };
    sessionStorage.setItem(REFERRAL_KEY, JSON.stringify(merged));
  } catch {}
}

export function readReferralParams() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(REFERRAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Build attribution context attached to every push. */
function baseContext() {
  const ctx = { ...readReferralParams() };
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    ctx.user_status = token ? 'member' : 'guest';
  } catch {
    ctx.user_status = 'guest';
  }
  // Funnel entry attribution — the ad-unit the user arrived on, persisted at
  // landing by trackingService.persistFunnelEntry() (same `funnel.*` sessionStorage
  // keys). Additive: lets the conversion events (purchase/sign_up) attribute back
  // to the ad variant. Uses DISTINCT `funnel_`-prefixed names so it never collides
  // with an event's own `search_type` param (which may be undefined and would
  // otherwise clobber the entry value). `variant` alone is ambiguous (v2 exists for
  // name/phone/email), so both dims are carried.
  try {
    if (typeof sessionStorage !== 'undefined') {
      const v = sessionStorage.getItem('funnel.variant');
      const st = sessionStorage.getItem('funnel.searchType');
      if (v) ctx.funnel_variant = v;
      if (st) ctx.funnel_search_type = st;
    }
  } catch { /* ignore */ }
  return ctx;
}

// Delegating push: routes through gtmContext so every event automatically
// carries the 27 canonical fields alongside the legacy referral/user_status
// context.
function push(data) {
  if (typeof window === 'undefined') return;
  const { event: eventName, ...rest } = data || {};
  // Lazy import to keep this module side-effect-light if gtmContext fails to load.
  // eslint-disable-next-line global-require
  const { push: ctxPush } = require('./gtmContext');
  ctxPush(eventName, { ...baseContext(), ...rest });
}

/** Virtual page view — call on every SPA route change */
export function gtmPageView(path, title) {
  push({
    event: 'virtualPageview',
    pagePath: path,
    pageTitle: title || document.title,
  });
}

/** Custom event — maps to GA4 events and Google Ads conversions */
export function gtmEvent(eventName, params = {}) {
  push({ event: eventName, ...params });
}

// ─── Typed pushers for the funnel ──────────────────────────────────────────
// Each pushes a canonical event name and canonical field names so GTM tags
// can map GA4 events consistently. All accept a `search_type` of name/phone/email
// where applicable so downstream tags can distinguish funnels.

export function gtmSearchSubmit({ search_type, result_count, state }) {
  push({ event: 'search_submit', funnel_step: 'search', search_type, result_count, state });
}

export function gtmTeaserView({ search_type, identity_id, result_count }) {
  push({ event: 'teaser_view', funnel_step: 'teaser', search_type, identity_id, result_count });
}

export function gtmPaymentStart({ offer_key, plan }) {
  push({ event: 'payment_start', funnel_step: 'payment', offer_key, plan });
}

export function gtmPurchase({ value, currency = 'USD', offer_key, item_name }) {
  push({
    event: 'purchase',
    funnel_step: 'purchase',
    value: typeof value === 'number' ? value : Number(value) || 0,
    currency,
    offer_key,
    items: [{ item_name: item_name || offer_key || 'Membership', item_id: offer_key }],
  });
}

export function gtmSignUp({ method = 'email', search_type } = {}) {
  push({ event: 'sign_up', funnel_step: 'signup', method, search_type });
}

export function gtmLogin({ method = 'email' } = {}) {
  push({ event: 'login', method });
}

export function gtmSelectContent({ content_type, content_id, search_type }) {
  push({ event: 'select_content', content_type, content_id, search_type });
}
