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
    // Default 'thinMatch' → ThinMatchPreview upsell on no-results (owner 2026-06-09:
    // organic/no-shn gets the promo too). BC's per-shN thinmatch flag overrides this;
    // an shN with thinmatch:'no' resolves to 'noRecords' ("no results found").
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' },
    detail:  { variant: 'a' },                  // shared SupTeaserA design (green); legacy '1' inline layout retired 2026-07-04
    // onboarding (optional, owner 2026-07-21): set `onboarding: true` on a campaign/flow to insert the ~15s
    // OnboardingReveal (enrichment reveal + email capture) between the SERP and the SUP/Payment. Absent =
    // default funnel (no interstitial). Also force-testable on any flow via the ?onboard=1 URL param.
    // onboarding: true,

    signup:  { variant: 'stepped', fields: ['email', 'password', 'optin'] },
    // requireTermsCheckbox (bug #34): on the default shN we SHOW + REQUIRE the
    // SUP terms checkbox. Affiliate shNs can set `requireTermsCheckbox: false`
    // to hide the checkbox and not gate submit on it (disclosure text still shows).
    // Strict by default — only an explicit `false` relaxes it.
    payment: { methods: ['card'], requireTermsCheckbox: true },
    offer:   { shmName: null, trial: false },   // null = let BC pick default offer
    // BC's per-shN "optout" flag (comp.client.theme.optout). SOLE effect: the SUP
    // consent text + checkbox above the CTA on PaymentPage. Default TRUE = compliant
    // (show it) — matches BC's default theme (optout:'yes') and is the safe fallback if
    // the shape fetch fails. Affiliate shNs set optout:'no' to hide that block + not gate
    // submit on it. (It does NOT add an opt-out link to the search/detail header — that
    // was a 2026-06-05 misread, reverted 2026-06-09; the removal link lives in the Footer.)
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
    // A/B test: BC's theme randomizes landing (v3a/v3b) + sup (i/j) per request. awaitTheme
    // makes the `/` boot redirect wait for the BC shape so it routes to the assigned arm
    // instead of this static fallback. route/variant here are the safe fallback if the shape
    // fails/times out. (Non-A/B campaigns omit awaitTheme → they redirect immediately.)
    landing: { route: '/name/landing/v3', awaitTheme: true },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' },  // thinmatch: yes
    detail:  { variant: 'a' },                  // sup fallback; theme.sup (ver=i/j) overrides
    optOut:  true,                              // optout: yes
  },

  // ── Homefacts partner traffic (records intent, 2026-07-23). One PLACEHOLDER shN per records experience so
  // BC + GTM attribute each URL distinctly (partner=Homefacts, channel=the intent). The partner links go
  // DIRECTLY to /records/* so landing.route stays null (no boot redirect). Finer placement within an intent
  // (OffenderD_Text vs offender-details1, etc.) is carried by the `type` param → the partner_landing event.
  // Swap these keys for real BC-provisioned shConIds when minted (like the Google tokens above); identity's
  // partner/channel is what feeds reporting today. Hit as `?shn=homefacts-so` (no shl → resolves `…:*`).
  'homefacts-so:*': {
    identity: { shnName: 'Homefacts — Sex Offender', brand: 'IDL', partner: 'Homefacts', channel: 'Sex Offender',
      purpose: 'Homefacts offender-detail traffic → criminal/offender report' },
    landing: { route: null },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },
  'homefacts-bg:*': {
    identity: { shnName: 'Homefacts — Background Check', brand: 'IDL', partner: 'Homefacts', channel: 'Background Check',
      purpose: 'Homefacts arrest/records traffic → background report' },
    landing: { route: null },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },
  'homefacts-pr:*': {
    identity: { shnName: 'Homefacts — Public Records', brand: 'IDL', partner: 'Homefacts', channel: 'Public Records',
      purpose: 'Homefacts general records traffic → public-records report' },
    landing: { route: null },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },

  // ── Honest People-Search challenger (2026-07-29). The /people-search general-PS flow (honest landing +
  // loader + real-signal teaser + honest zero-state + transparent checkout), built to A/B against the
  // standard funnels. PLACEHOLDER shN so trials + trial→paid attribute distinctly (partner=Direct,
  // channel=Honest PS); swap for a minted BC shConId (or a per-source token) when the campaign goes live.
  // Tag campaign URLs `?shn=honest-ps` — boots to /people-search from any entry. zeroState 'noRecords' (never
  // the fabricated thin-match cards — the challenger's whole promise).
  'honest-ps:*': {
    identity: { shnName: 'Honest People Search', brand: 'IDL', partner: 'Direct', channel: 'Honest PS',
      purpose: 'Honest general people-search challenger → measure cost-per-trial + trial→paid vs standard funnels' },
    landing: { route: '/people-search' },
    search:  { type: 'name', perPage: 5, zeroState: 'noRecords' },
    detail:  { variant: 'a' }, optOut: true,
  },

  // ── Proof-First challenger (Flow B, 2026-07-29). Reveals ONE real finding in the clear pre-paywall (never a
  // fabricated card); checkout sells "unlock the rest". Hypothesis: concrete evidence beats promises/fear. Same
  // general PS core; zeroState 'noRecords' (honest degrade when there's nothing real to prove). PLACEHOLDER shN.
  'proof-first:*': {
    identity: { shnName: 'Proof-First People Search', brand: 'IDL', partner: 'Direct', channel: 'Proof First',
      purpose: 'Evidence-before-paywall challenger → measure SRP→pay CTR + refund rate vs standard/honest funnels' },
    landing: { route: '/proof-check' },
    search:  { type: 'name', perPage: 5, zeroState: 'noRecords' },
    detail:  { variant: 'a' }, optOut: true,
  },

  // ── Search-Yourself challenger (Flow C, 2026-07-29). Self-exposure hook → standing protection subscription
  // (claim + who's-searching monitoring). The one challenger that structurally targets RETENTION, not just
  // conversion. Same general PS core; the 'self' treatment rides on ?variant=self. PLACEHOLDER shN.
  'self-check:*': {
    identity: { shnName: 'Search Yourself', brand: 'IDL', partner: 'Direct', channel: 'Self Check',
      purpose: 'Self-exposure → protection-subscription challenger → measure month-2/3 retention + LTV vs lookup funnels' },
    landing: { route: '/my-exposure' },
    search:  { type: 'name', perPage: 5, zeroState: 'noRecords' },
    detail:  { variant: 'a' }, optOut: true,
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

  // People Search & Background Check — "people search free" ad units. Real BC token (owner 2026-08-03).
  // Ad lands directly on /name/landing/v2 (?intent=people_search&adgroup=people_search_free); landing.route here
  // mirrors that so any /?shn= boot traffic also routes to v2. Google Ads (adgroup=…). Standard name funnel:
  // thinmatch upsell, sup variant a, optout compliant. v2's search is fixed (delegates to /name/loader).
  // NOTE: the ad URL must carry ?shn=6a70dee8368ec934bb214554 for this entry (and its attribution) to apply.
  '6a70dee8368ec934bb214554:*': {
    identity: { shnName: 'People Search & Background Check', brand: 'IDL', partner: 'Google', channel: 'Background Check',
      purpose: 'People-search-free ad units → free-to-search v2 funnel → capture trials' },
    landing: { route: '/name/landing/v2' },
    search:  { type: 'name', perPage: 5, zeroState: 'thinMatch' }, detail: { variant: 'a' }, optOut: true,
  },

  // ── "Who's Looking For You" WSFY display campaign (2026-08-03). Reverse angle — discover who's searching
  // for YOU → boots to the self-check funnel (/my-exposure). PLACEHOLDER shN; swap for the minted BC token
  // when the display campaign is provisioned (as with the v2 token above). Tag URLs ?shn=wsfy-display.
  'wsfy-display:*': {
    identity: { shnName: "Who's Looking For You", brand: 'IDL', partner: 'Google', channel: 'WSFY',
      purpose: 'WSFY "who searched you" display ads → self-check funnel → trials + retention' },
    landing: { route: '/my-exposure' },
    search:  { type: 'name', perPage: 5, zeroState: 'noRecords' }, detail: { variant: 'a' }, optOut: true,
  },
};
