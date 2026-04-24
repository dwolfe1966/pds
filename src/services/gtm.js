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

let gtmInitialized = false;

export function initGtm() {
  if (gtmInitialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  const id = process.env.REACT_APP_GTM_ID;
  if (!id) return;
  gtmInitialized = true;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  const first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) {
    first.parentNode.insertBefore(s, first);
  } else {
    document.head.appendChild(s);
  }

  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);
}

const REFERRAL_KEY = 'referralParams';
const REFERRAL_FIELDS = ['refer_partnerId', 'refer_afid', 'refer_abc', 'utm_source', 'utm_medium', 'utm_campaign'];

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
  return ctx;
}

function push(data) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ...baseContext(), ...data });
  }
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
