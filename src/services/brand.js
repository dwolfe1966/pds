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

const idlookupLogo = new URL('../assets/idlookup_icon_transparent.png', import.meta.url).href;

export const BRANDS = {
  'idlookup.ai': {
    id: 'idlookup',
    name: 'IDLookup.AI',
    domain: 'idlookup.ai',
    supportEmail: 'support@idlookup.ai',
    legalEmail: 'legal@idlookup.ai',
    privacyEmail: 'privacy@idlookup.ai',
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
  },
  'peoplesearcher.ai': {
    id: 'peoplesearcher',
    name: 'PeopleSearcher.AI',
    domain: 'peoplesearcher.ai',
    supportEmail: 'support@peoplesearcher.ai',
    legalEmail: 'legal@peoplesearcher.ai',
    privacyEmail: 'privacy@peoplesearcher.ai',
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
  },
  'inmatefinderhub.com': {
    id: 'inmatefinder',
    name: 'InmateFinderHub',
    domain: 'inmatefinderhub.com',
    supportEmail: 'support@inmatefinderhub.com',
    legalEmail: 'legal@inmatefinderhub.com',
    privacyEmail: 'privacy@inmatefinderhub.com',
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
