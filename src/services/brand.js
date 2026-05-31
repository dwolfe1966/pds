/**
 * Multi-domain branding registry.
 *
 * The same SPA bundle is served on idlookup.ai, peoplesearcher.ai, and
 * inmatefinderhub.com. Brand-specific name/email/colors are resolved at
 * runtime from window.location.hostname.
 *
 * To add a new brand:
 *   1. Add an entry below keyed by the bare hostname (no leading "www.").
 *   2. If a real PNG/SVG logo exists, drop it in src/assets/ and reference
 *      it in `logoAsset`. Otherwise leave logoAsset null and BrandLogo
 *      will render a color-tinted SVG chip placeholder.
 *
 * Hostname is matched case-insensitively with the leading "www." stripped.
 * Any unknown hostname (localhost, preview deploys, etc.) falls back to
 * the IDLookup brand.
 */

import idlookupLogo from '../assets/idlookup_icon_transparent.png';

export const BRANDS = {
  'idlookup.ai': {
    id: 'idlookup',
    name: 'IDLookup.AI',
    domain: 'idlookup.ai',
    // Inbound support is routed through /contact — no public inbound email surfaces.
    supportPhone: '833-861-9230',
    // Pricing surfaced in checkout copy. BC's offer (findByShmName) is the
    // server-side source of truth for what actually gets charged; these
    // values are the marketing display + GTM transactionAmount. Keep in
    // sync with BC's offer.commercePrice when BC ships price updates.
    // TEMPORARY OVERRIDE (TRX approval): display $1.00 / $49.98 even though
    // BC's commercePriceRules currently say $0.98 trial / $39.01 monthly.
    // When BC updates its offer to match these values, this comment can be
    // removed. The actual charge is BC's price, not these — keep this gap
    // tight; current marketing display is 2¢ / $10.97 higher than BC charge.
    trialPrice: 1.00,
    trialDays: 7,
    recurringPrice: 49.98,
    logoAsset: idlookupLogo,
    primaryColor: '#0d5d2f',
    accentColor: '#0d5d2f',
    initials: 'ID',
    // Home-page surfaces. heroBg accepts any background value (gradient
    // or solid). featureCardBg is the per-card surface in the "Why
    // Choose" grid. featureCardAccent is the colored top-border / hover
    // tint that ties the cards back to the brand.
    heroBg: 'linear-gradient(135deg, rgb(236, 253, 245) 0%, rgb(239, 246, 255) 100%)',
    heroTitleColor: '#111827',
    heroSubtitleColor: '#6b7280',
    featuresBg: '#ffffff',
    featureCardBg: '#f9fafb',
    featureCardAccent: '#0d5d2f',
    // Translucent variants of the primary color, used by the sticky
    // header bar and the mobile nav active-state tint.
    headerBg: 'rgba(13, 93, 47, 0.95)',
    headerActiveTint: 'rgba(13, 93, 47, 0.05)',
  },
  'peoplesearcher.ai': {
    id: 'peoplesearcher',
    name: 'PeopleSearcher.AI',
    domain: 'peoplesearcher.ai',
    // Inbound support is routed through /contact — no public inbound email surfaces.
    supportPhone: '833-958-3677',
    // TEMPORARY OVERRIDE (TRX approval): display $1.00 / $49.98 even though
    // BC's commercePriceRules currently say $0.98 trial / $39.01 monthly.
    // When BC updates its offer to match these values, this comment can be
    // removed. The actual charge is BC's price, not these — keep this gap
    // tight; current marketing display is 2¢ / $10.97 higher than BC charge.
    trialPrice: 1.00,
    trialDays: 7,
    recurringPrice: 49.98,
    logoAsset: null,
    primaryColor: '#1e3a8a',
    accentColor: '#f97316',
    initials: 'PS',
    heroBg: 'linear-gradient(135deg, #eef2ff 0%, #fff7ed 100%)',
    heroTitleColor: '#1e3a8a',
    heroSubtitleColor: '#475569',
    featuresBg: '#ffffff',
    featureCardBg: '#f8fafc',
    featureCardAccent: '#f97316',
    headerBg: 'rgba(30, 58, 138, 0.95)',
    headerActiveTint: 'rgba(30, 58, 138, 0.05)',
  },
  'inmatefinderhub.com': {
    id: 'inmatefinder',
    name: 'InmateFinderHub',
    domain: 'inmatefinderhub.com',
    // Inbound support is routed through /contact — no public inbound email surfaces.
    supportPhone: '833-632-7173',
    // TEMPORARY OVERRIDE (TRX approval): display $1.00 / $49.98 even though
    // BC's commercePriceRules currently say $0.98 trial / $39.01 monthly.
    // When BC updates its offer to match these values, this comment can be
    // removed. The actual charge is BC's price, not these — keep this gap
    // tight; current marketing display is 2¢ / $10.97 higher than BC charge.
    trialPrice: 1.00,
    trialDays: 7,
    recurringPrice: 49.98,
    logoAsset: null,
    primaryColor: '#334155',
    accentColor: '#d97706',
    initials: 'IF',
    heroBg: 'linear-gradient(135deg, #f1f5f9 0%, #fef3c7 100%)',
    heroTitleColor: '#0f172a',
    heroSubtitleColor: '#475569',
    featuresBg: '#ffffff',
    featureCardBg: '#f8fafc',
    featureCardAccent: '#d97706',
    headerBg: 'rgba(51, 65, 85, 0.95)',
    headerActiveTint: 'rgba(51, 65, 85, 0.05)',
  },
};

const DEFAULT_BRAND_KEY = 'idlookup.ai';
const OVERRIDE_STORAGE_KEY = 'brand-override';

function normalizeHost(host) {
  return (host || '').toLowerCase().replace(/^www\./, '');
}

function isLocalLikeHost(host) {
  return host === 'localhost'
    || host === '127.0.0.1'
    || host.endsWith('.local')
    || host.endsWith('.vercel.app');
}

function brandById(id) {
  return Object.values(BRANDS).find((b) => b.id === id) || null;
}

/**
 * Dev/preview-only override: read `?brand=<id>` from the URL and persist
 * it in sessionStorage so it survives client-side navigation. Pass
 * `?brand=reset` to clear. Only honored on localhost / *.vercel.app etc.
 * so the production hostnames remain canonical.
 */
function readOverride() {
  if (typeof window === 'undefined' || !window.location) return null;
  const host = normalizeHost(window.location.hostname);
  if (!isLocalLikeHost(host)) return null;

  let storage = null;
  try { storage = window.sessionStorage; } catch { /* private mode */ }

  const params = new URLSearchParams(window.location.search);
  const param = params.get('brand');
  if (param) {
    if (param === 'reset') {
      try { storage?.removeItem(OVERRIDE_STORAGE_KEY); } catch {}
    } else {
      const match = brandById(param);
      if (match) {
        try { storage?.setItem(OVERRIDE_STORAGE_KEY, match.id); } catch {}
        return match;
      }
    }
  }

  try {
    const stored = storage?.getItem(OVERRIDE_STORAGE_KEY);
    if (stored) return brandById(stored);
  } catch {}
  return null;
}

/**
 * Resolve the active brand from the current hostname. SSR-safe: returns
 * the default brand if window is not defined. Honors a dev-only
 * `?brand=<id>` override on local-like hostnames.
 */
export function getBrand() {
  if (typeof window === 'undefined' || !window.location) {
    return BRANDS[DEFAULT_BRAND_KEY];
  }
  const override = readOverride();
  if (override) return override;
  const host = normalizeHost(window.location.hostname);
  return BRANDS[host] || BRANDS[DEFAULT_BRAND_KEY];
}

/**
 * Hook wrapper. Hostname doesn't change at runtime within a session, so
 * this returns the same object every call — no React state needed.
 */
export function useBrand() {
  return getBrand();
}
