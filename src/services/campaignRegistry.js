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
    // identity feeds reporting (data.refer + GTM). null = unknown/no-partner.
    // When BC models partners (#77-Q6/Q4), identity comes from getShapeCompiled
    // and these local values shrink to just landing/offer overrides.
    identity: { shnName: null, brand: null, partner: null, channel: null },
    landing: { route: null },                   // null = no redirect; current route stays
    // search.type drives the landing route choice (consumed via landing.route)
    // search.perPage is currently advisory — BC teaser ignores perPage and
    // returns its default page size (~5); additional results come from
    // response.getMore(). See apiRouter.js:591.
    // zeroState (bug #51): SRP behavior when a search returns no/sparse results.
    // 'noRecords' (strict default) → "no records found" panel. Affiliate shNs can
    // set 'thinMatch' to show the ThinMatchPreview upsell instead.
    search:  { type: 'name', perPage: 5, zeroState: 'noRecords' },
    detail:  { variant: '1' },                  // matches the v1 layout default in SearchDetailPreviewPage

    signup:  { variant: 'stepped', fields: ['email', 'password', 'optin'] },
    // requireTermsCheckbox (bug #34): on the default shN we SHOW + REQUIRE the
    // SUP terms checkbox. Affiliate shNs can set `requireTermsCheckbox: false`
    // to hide the checkbox and not gate submit on it (disclosure text still shows).
    // Strict by default — only an explicit `false` relaxes it.
    payment: { methods: ['card'], requireTermsCheckbox: true },
    offer:   { shmName: null, trial: false },   // null = let BC pick default offer
    optOut:  false,                             // partner "optout: yes" flag (behavior TBD)
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
    // Exercises the affiliate-style relaxations end-to-end (bugs #34/#51):
    //   - search.zeroState 'thinMatch' → SRP shows ThinMatchPreview, not "no records"
    //   - payment.requireTermsCheckbox false → SUP checkbox hidden + not required
    search:  { type: 'name', perPage: 10, zeroState: 'thinMatch' },
    detail:  { variant: 'b' },
    signup:  { variant: 'stepped', fields: ['email', 'password', 'optin'] },
    payment: { methods: ['card'], requireTermsCheckbox: false },
    offer:   { shmName: 'membership.offer.default.1', trial: false },
  },

  // ── Partners (from the shN spreadsheet) ────────────────────────────────────
  // Keyed by `<shn>:*` (partner-wide, any page) — the resolver matches `?shn=X`
  // against `X:*`. NOTE: the keys below use the sheet's ROW NUMBERS as
  // PLACEHOLDERS. Replace `1:*`..`5:*` with the real shN strings (long tokens)
  // when partner links are minted — the resolver is key-agnostic so no code
  // change is needed, only these keys.
  //
  // `identity` is for reporting (rides into data.refer + GTM). `landing.route`
  // is the one thing BC can't drive client-side. Payment acceptance / cascade /
  // risk (shN 2/3 and 4/5 Hi-vs-Lo) is BC-side, keyed on shn — not configured here.

  '1:*': {
    identity: { shnName: 'IDL Default', brand: 'IDL', partner: 'Internal', channel: 'Default' },
  },

  // Internal cascade variants — BC adjusts payment acceptance by shn; identity-only.
  '2:*': {
    identity: { shnName: 'Cascade Decliner', brand: 'IDL', partner: 'Internal', channel: 'Cascade Decliner', purpose: 'Cascade $0 pass' },
  },
  '3:*': {
    identity: { shnName: 'Cascade Exit', brand: 'IDL', partner: 'Internal', channel: 'Cascade Exit', purpose: 'Cascade $1 pass' },
  },

  // Google paid-search, inmate keyword → inmate funnel. HHI Hi/Lo differ only in
  // BC payment-type/risk (BC-side); same client UX (inmate landing).
  '4:*': {
    identity: { shnName: 'Google Inmates HHI Hi', brand: 'IDL', partner: 'Google', channel: 'Search' },
    landing: { route: '/name/landing/v3' },     // inmate-themed funnel
  },
  '5:*': {
    identity: { shnName: 'Google Inmates HHI Lo', brand: 'IDL', partner: 'Google', channel: 'Search' },
    landing: { route: '/name/landing/v3' },     // inmate-themed funnel
  },

  // ── First REAL shN token (replaces the placeholder rows above for this partner).
  // Source config: { landing: "name/landing/5", sup: "ver=c", optout: "yes" }.
  '6a22ff83ca16ad4ef68b84b5:*': {
    identity: {
      shnName: 'Google Inmates Upper', brand: 'IDL', partner: 'Google', channel: 'Search',
      purpose: 'Capture search intent re: incarcerated individuals → capture trials',
    },
    landing: { route: '/name/landing/v3' },     // inmate funnel (config said "5", corrected to v3 — the reliable /name/loader path the other Google Inmates rows use)
    detail:  { variant: 'c' },                  // config sup "ver=c" → SearchDetailPreviewVariantC
    optOut:  true,                              // config optout "yes" — see resolver; behavior TBD
  },
};
