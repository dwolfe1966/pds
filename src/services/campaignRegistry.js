/**
 * Campaign registry — sparse UX overrides keyed by shConId+shColId.
 *
 * This registry only contains entries where we want to **override** BC's
 * default UX. BC's shape (resolved via `getShapeCompiled()` with the IIFE's
 * `initialShParams: { shn, shl, cascade: true }`) supplies the partner /
 * brand metadata; this registry layers UX-specific choices on top:
 * landing route, search type, perPage, variant, signup fields, payment
 * methods, offer reference.
 *
 * Lookup uses a fallback chain — see `campaignResolver.js`:
 *   1. `<shConId>:<shColId>` — exact match
 *   2. `<shConId>:*`         — partner-wide default
 *   3. `*:<shColId>`         — page-wide default
 *   4. `default`             — universal fallback
 *
 * Add entries as marketing campaigns come online; leave undefined for
 * sensible BC-default UX.
 */

export const CAMPAIGN_REGISTRY = {
  // Universal fallback — applied when neither the exact key nor any
  // partner-wide or page-wide partial match has an entry.
  default: {
    landing: { route: null },                   // null = no redirect; current route stays
    // search.type drives the landing route choice (consumed via landing.route)
    // search.perPage is currently advisory — BC teaser ignores perPage and
    // returns its default page size (~5); additional results come from
    // response.getMore(). See apiRouter.js:591.
    search:  { type: 'name', perPage: 5 },
    detail:  { variant: '1' },                  // matches the v1 layout default in SearchDetailPreviewPage

    signup:  { variant: 'stepped', fields: ['email', 'password', 'optin'] },
    payment: { methods: ['card'] },
    offer:   { shmName: null, trial: false },   // null = let BC pick default offer
  },

  // ── Placeholders. Replace shConId/shColId values with real ones from BC
  // as campaigns come online. Entries below are illustrative only and
  // currently do not match any real partner.
  // 'PARTNER_A:PAGE_1': {
  //   landing: { route: '/name/landing/v5' },
  //   search:  { type: 'name', perPage: 10 },
  //   detail:  { variant: 'B' },
  //   signup:  { variant: 'stepped', fields: ['email', 'password', 'optin'] },
  //   payment: { methods: ['card'] },
  //   offer:   { shmName: 'membership.offer.default.1', trial: false },
  // },
};
