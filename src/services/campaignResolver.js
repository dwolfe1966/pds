/**
 * Campaign resolver — turns a (shConId, shColId) tuple into a fully
 * realized campaign config by walking a fallback chain over the local
 * registry and merging on top of BC's shape data.
 *
 * Lookup order:
 *   1. `<shConId>:<shColId>` — exact (most specific)
 *   2. `<shConId>:*`         — partner-wide default
 *   3. `*:<shColId>`         — page-wide default
 *   4. `default`             — universal fallback
 *
 * BC's shape (fetched separately via apiWrapper.getShapeCompiled with
 * initialShParams { shn, shl, cascade: true }) supplies partner/brand
 * metadata. The resolver doesn't fetch the shape itself — callers pass
 * a `shape` object if they have one, and the resolver enriches the
 * resolved config with shape-derived properties.
 *
 * Resolution is cached in-memory by tuple key so repeated lookups in the
 * same session are free.
 */

import { CAMPAIGN_REGISTRY } from './campaignRegistry';

const cache = new Map();

const KEY = (shn, shl) => `${shn || '*'}:${shl || '*'}`;

/**
 * Walk the fallback chain and return the FIRST registry entry that hits,
 * or null. Skip entries whose key components don't actually match the
 * request — e.g., if the request has shn=A and shl=B, we shouldn't pick
 * up registry['PARTNER_X:*'] just because the wildcard form exists.
 */
function findRegistryEntry(shn, shl) {
  const candidates = [];
  if (shn && shl) candidates.push(`${shn}:${shl}`);
  if (shn) candidates.push(`${shn}:*`);
  if (shl) candidates.push(`*:${shl}`);
  candidates.push('default');
  for (const key of candidates) {
    if (CAMPAIGN_REGISTRY[key]) {
      return { entry: CAMPAIGN_REGISTRY[key], matchKey: key };
    }
  }
  return { entry: CAMPAIGN_REGISTRY.default, matchKey: 'default' };
}

/**
 * Pull a few well-known fields out of a BC ShapeCompiled object. The shape
 * is opaque to us; we read it via `getShComp(componentName)`. Add lookups
 * here as BC documents new comp names.
 */
function extractShapeProps(shape) {
  if (!shape || typeof shape.getShComp !== 'function') return {};
  const tryKey = (key) => {
    try { return shape.getShComp(key); } catch { return undefined; }
  };
  // BC delivers the per-shN theme (landing/sup/optout/thinmatch — the same object
  // from the shN sheet) as comp.client.theme. getShComp may return it parsed
  // (type 'json') or as a raw JSON string — handle both.
  let theme = tryKey('comp.client.theme');
  if (typeof theme === 'string') { try { theme = JSON.parse(theme); } catch { theme = null; } }
  if (!theme || typeof theme !== 'object') theme = null;
  const yes = (v) => /^(yes|true|1)$/i.test(String(v ?? '').trim());

  return {
    brandName: tryKey('comp.brand.name'),
    partnerName:
      tryKey('comp.tracking.partner.name') ||
      tryKey('comp.partner.name') ||
      tryKey('comp.connection.name'),
    // BC-driven per-shN flags (source of truth — override the local registry).
    // optout:'yes' → optOut true; thinmatch:'yes' → zeroState 'thinMatch' (show the
    // promo + signup CTA on no-results) else 'noRecords' ("no results found").
    optOut:    theme ? yes(theme.optout) : undefined,
    zeroState: theme ? (yes(theme.thinmatch) ? 'thinMatch' : 'noRecords') : undefined,
    // landing kept on the registry — BC's theme uses '/name/landing/3' while our
    // routes are '/name/landing/v3'; don't drive routing off it without a mapping.
  };
}

/**
 * Resolve a campaign config for the given (shn, shl).
 *
 * @param {string|undefined} shn       — shConId (partner / advertiser / ad unit)
 * @param {string|undefined} shl       — shColId (web page / funnel)
 * @param {object}           options
 * @param {object}           options.shape  — BC ShapeCompiled (optional)
 * @returns {object} resolved campaign config with `_matchKey` and `_shape` metadata
 */
export function resolveCampaign(shn, shl, { shape = null } = {}) {
  // Shape-aware cache key: the pre-shape mount resolution and the shape-enriched
  // re-resolution must NOT collide, or BC enrichment (optOut/zeroState/identity)
  // gets dropped when the cached pre-shape result is returned.
  const cacheKey = KEY(shn, shl) + (shape ? '#shape' : '');
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const { entry, matchKey } = findRegistryEntry(shn, shl);
  const shapeProps = extractShapeProps(shape);

  // BC's theme drives BOTH UX flags for ALL traffic (owner 2026-06-09, reversing the
  // 2026-06-08 strict-default): organic/no-shn gets the thinmatch promo + optout
  // compliance messaging, same as default-shN traffic. Registry defaults (zeroState
  // 'thinMatch', optOut true) are the safe fallback when the shape fetch fails and match
  // BC's default theme (thinmatch/optout:'yes').

  // Merge: registry default → matched entry → shape-derived extras.
  // Local registry wins for UX choices; shape supplies partner metadata.
  const defaults = CAMPAIGN_REGISTRY.default;
  // identity for reporting: registry value, then BC shape OVERRIDES when present
  // (BC is the source of truth for partner/brand identity — #77-Q4).
  const identity = {
    ...defaults.identity,
    ...entry.identity,
    ...(shapeProps.brandName ? { brand: shapeProps.brandName } : {}),
    ...(shapeProps.partnerName ? { partner: shapeProps.partnerName } : {}),
  };
  const resolved = {
    identity,
    landing: { ...defaults.landing, ...entry.landing },
    // BC's thinmatch flag overrides the registry when present (source of truth).
    search:  { ...defaults.search,  ...entry.search, ...(shapeProps.zeroState ? { zeroState: shapeProps.zeroState } : {}) },
    detail:  { ...defaults.detail,  ...entry.detail  },
    signup:  { ...defaults.signup,  ...entry.signup  },
    payment: { ...defaults.payment, ...entry.payment },
    offer:   { ...defaults.offer,   ...entry.offer   },
    // BC's optout flag overrides the registry when present (compliant default = true).
    optOut:  shapeProps.optOut ?? entry.optOut ?? defaults.optOut,
    // Metadata for analytics / debugging
    _matchKey: matchKey,
    _shn: shn,
    _shl: shl,
    _shape: shapeProps,
  };
  cache.set(cacheKey, resolved);
  return resolved;
}

/** Clear the resolver cache. Useful if shn/shl change mid-session and the
 *  caller opts in to re-resolution rather than first-touch lock. */
export function clearCampaignCache() { cache.clear(); }
