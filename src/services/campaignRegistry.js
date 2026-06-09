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
    // BC's per-shN "optout" flag (comp.client.theme.optout). Drives the SUP consent
    // block on PaymentPage + the OptOutNotice on SRP/detail. Default TRUE = compliant
    // (show both) — matches BC's default theme (optout:'yes') and is the safe fallback
    // if the shape fetch fails. Affiliate shNs set optout:'no' to strip the UI.
    optOut:  true,
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

  // ── Partners (from the shN spreadsheet, refreshed 2026-06-08) ───────────────
  // Keyed by `<shn>:*` (partner-wide, any page) — the resolver matches `?shn=X`
  // against `X:*`. Keys are the REAL shN tokens (24-hex BC shConIds).
  //
  // Sheet `theme` config → registry fields:
  //   landing "/"             → landing.route null (no redirect, stays on current route)
  //   landing "name/landing/3"→ '/name/landing/v3'  (inmate funnel)
  //   landing "name/landing/4"→ '/name/landing/v4'  (death funnel)
  //   landing "name/landing/6"→ '/name/landing/v6'  (divorce funnel)
  //   sup "ver=a"             → detail.variant 'a'
  //   optout "yes"            → optOut true
  //   thinmatch "yes"         → search.zeroState 'thinMatch' (ThinMatchPreview upsell
  //                             on 0/sparse results instead of "no records found", #51)
  //
  // `identity` rides into reporting (data.refer + GTM). `landing.route` is the one
  // thing BC can't drive client-side. Payment acceptance / cascade / risk is BC-side,
  // keyed on shn — not configured here. (The old cascade placeholder rows 2:*/3:* were
  // dropped 2026-06-08 — not in the refreshed sheet.)

  // IDL Default — internal default partner. landing "/" = no redirect (stays home).
  // NOTE: this is the keyed entry for traffic arriving with THIS shn; the universal
  // `default` fallback above is intentionally left strict for unknown/no-shn traffic.
  '69a2380b53ecf9b049d01fbb:*': {
    identity: { shnName: 'IDL Default', brand: 'IDL', partner: 'Internal', channel: 'Default' },
    landing: { route: null },                                       // "/" → no redirect
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' },  // thinmatch: yes
    detail:  { variant: 'a' },                                      // sup: ver=a
    optOut:  true,                                                  // optout: yes
  },

  // Google Inmates Upper — inmate funnel (v3). Real token live.
  '6a22ff83ca16ad4ef68b84b5:*': {
    identity: {
      shnName: 'Google Inmates Upper', brand: 'IDL', partner: 'Google', channel: 'Search',
      purpose: 'Capture search intent re: incarcerated individuals → capture trials',
    },
    landing: { route: '/name/landing/v3' },     // "name/landing/3" → inmate funnel (reliable /name/loader path)
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' },  // thinmatch: yes
    detail:  { variant: 'a' },                  // sup: ver=a → SearchDetailPreviewVariantA
    optOut:  true,                              // optout: yes
  },

  // ── Real shN tokens swapped in 2026-06-09 (owner provided the minted IDs). All
  // Upper/Lower pairs share the same landing + config — they differ only by ad
  // position (bid/reporting on the Google side), so they resolve to identical UX.

  // Google Inmates Lower — inmate funnel (v3).
  '6a273f983ee3447608a3aae5:*': {
    identity: { shnName: 'Google Inmates Lower', brand: 'IDL', partner: 'Google', channel: 'Search',
      purpose: 'Capture search intent re: incarcerated individuals → capture trials' },
    landing: { route: '/name/landing/v3' },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },
  // Google Death Upper — death funnel (v4).
  '6a273f983ee3447608a3aae6:*': {
    identity: { shnName: 'Google Death Upper', brand: 'IDL', partner: 'Google', channel: 'Search',
      purpose: 'Capture search intent related to deceased individuals → capture trials' },
    landing: { route: '/name/landing/v4' },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },
  // Google Death Lower — death funnel (v4).
  '6a273f983ee3447608a3aae7:*': {
    identity: { shnName: 'Google Death Lower', brand: 'IDL', partner: 'Google', channel: 'Search',
      purpose: 'Capture search intent related to deceased individuals → capture trials' },
    landing: { route: '/name/landing/v4' },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },
  // Google Divorce Upper — divorce funnel (v6).
  '6a273f983ee3447608a3aae8:*': {
    identity: { shnName: 'Google Divorce Upper', brand: 'IDL', partner: 'Google', channel: 'Search',
      purpose: 'Capture search intent related to divorced individuals → capture trials' },
    landing: { route: '/name/landing/v6' },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },
  // Google Divorce Lower — divorce funnel (v6).
  '6a273f983ee3447608a3aae9:*': {
    identity: { shnName: 'Google Divorce Lower', brand: 'IDL', partner: 'Google', channel: 'Search',
      purpose: 'Capture search intent related to divorced individuals → capture trials' },
    landing: { route: '/name/landing/v6' },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },
};
