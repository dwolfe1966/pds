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

  // ── Test placeholder. Hit `?shn=demo&shl=v5` to exercise the redirect +
  // detail-variant + offer-shmName plumbing end-to-end. Three values differ
  // from `default`, making each easy to spot during QA:
  //   - landing.route → redirect from /  to /name/landing/v5
  //   - detail.variant → SearchDetailPreviewPage renders variant B
  //   - offer.shmName  → PaymentPage's billing.sale carries this key in
  //     `commerceOfferKeys[0].key` (visible in Network panel). BC may
  //     reject this specific shmName as unknown — that's expected for the
  //     placeholder. Replace with a real BC-provisioned shmName when a
  //     real partner campaign goes live.
  'demo:v5': {
    // Points at V1 (/name/landing) — the V2–V6 wizard variants have an inline
    // runSearch path that's currently broken (search fails silently with no
    // HTTP call, navigates to /name/search-result?error=true). V1 delegates
    // to /name/loader which is the same path /search/all uses and is known
    // to work. Restore to '/name/landing/v5' once the V5 wizard bug is fixed.
    landing: { route: '/name/landing' },
    search:  { type: 'name', perPage: 10 },
    detail:  { variant: 'b' },
    signup:  { variant: 'stepped', fields: ['email', 'password', 'optin'] },
    payment: { methods: ['card'] },
    offer:   { shmName: 'membership.offer.default.1', trial: false },
  },
};
