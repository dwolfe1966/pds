---
name: project_growth_plan_2026_07_11
description: "Master growth plan across 5 areas (idlookup.me GA, funnels, Identity/WSFY, email, freemium) — one lifecycle, waves, open questions"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Strategic planning session 2026-07-11. Owner raised 5 areas; framed as ONE lifecycle
(Acquire → Convert → Retain), not five silos. Master doc: `docs/design/2026-07-11-master-growth-plan.md`
(top-level index + opinionated wave sequence). Deep docs:
- (i) idlookup.me GA: `docs/seo/idlookup-me-ga-readiness-2026-07.md`
- (ii) funnels: `docs/design/funnel-mimic-plan.md` + first-hand `docs/design/beenverified-funnel-teardown-2026-07.md`
- (iii) Identity/WSFY/Alerts: `docs/design/identity-management-wsfy-plan.md`
- (iv) email: `docs/design/email-platform-plan.md` + `docs/design/email-platform-current-state.md`
- (v) freemium: `docs/design/freemium-strategy-plan.md` + `docs/design/freemium-current-state.md`

**Owner refocus (2026-07-11):** front three waves = **Convert + Retain** (funnels + free experience).
SEO/idlookup.me + BC-blocked features demoted to a parallel trickle (Wave 4). Re-cut waves:
- **Wave 0 — instrument, don't re-ship.** Make funnel measurable end-to-end (loader_complete +
  teaser_view as distinct GA4 steps, split by ad-unit + variant) + baseline free→paid + free return
  rate. **"Deploy the 2026-07-03 redesign" was DROPPED** — that was a stale mislabel; git shows the
  funnel/SUP/SERP work shipped incrementally (e.g. `921ae0b … compare live vs Trust Blue` = a live
  experiment). No single undeployed redesign exists.
- **Wave 1 — improve existing funnel:** richer anticipation loader, bulk-plan price anchor,
  progressive-input skip escapes. A/B each.
- **Wave 1 pulled forward:** owner wants the **BeenVerified mimic EARLY, built as an OPTIONAL FLOW** —
  a separate parallel funnel route (`…/landing/v7` or `?flow=bv`/flag), NOT a replacement. Existing
  funnel untouched; a controlled slice A/B-routed through it; winner earns traffic. Additive+reversible
  → safe to go early. Structure = progressive drip → long anticipation loader that CARRIES the payoff
  (loader-replaces-teaser, no blurred SUP) → paywall + price anchor. **Decisions locked 2026-07-11:**
  gating = **manual feature flag, OFF by default** (internal/manual test FIRST, no live A/B split until
  validated); fidelity = **structure-faithful + TEST email capture mid-loader** (before value; = a
  remarketing lead, not an account; needs a consent line), but **KEEP guardrails** (disclosed trial +
  self-serve cancel; NO hidden exit-intent trial, NO phone-only cancel). New route `…/landing/v7` or
  `?flow=bv`. Ties email-mid-loader to the remarketing/email backend (iv).
- **Wave 2 — first real free experience (MyLife partial reveal).**

**Key strategic calls:**
- **Seams:** Identity/WSFY/Alerts (iii) ARE the freemium retention hooks (v); email (iv) is the delivery
  layer; a server-side backend unlocks iii+iv+v at once (prod idlookup.ai is a pure SPA — can't hold a
  key/schedule/listen). Backend = separate isolated Vercel/Neon service (NOT the public idlookup.me app
  — consumer PII must not live in the public SEO DB).
- **NO "confidential search" messaging (owner):** counter to our TWO-SIDED model — the searched-for is
  also a customer (WSFY). Never promise searchers invisibility; it guts WSFY. Differentiates us from
  one-sided tools (BeenVerified/TruthFinder).
- **Free tier = MyLife PARTIAL-reveal model, NOT a free report.** Give away PARTS of the user's OWN
  info ("see YOU") — exposure preview + score + teased/masked snippets (SupTeaserA mechanic pointed at
  the user) + "who's searching for you" hook. Creates anxiety that drives TOWARD conversion. A **full**
  self-report is DEFERRED — requires **CC on file + identity validation, segment-only** — because we
  often get **one crack at the conversion nut**. Report-pull COGS is minimal (NOT the blocker);
  conversion economics is the reason to defer.
- **(iii) split:** ship-now Identity **Exposure** snapshot (partial self-reveal + route to existing
  opt-out) needs NO BC; WSFY (1) + Alerts (4) stay BC-blocked coming-soon ([[bc-consumer-feature-asks]])
  — file asks, ship first-party interim monitoring via our own backend.
- **(ii):** our funnel is already more honest than BeenVerified. Mimic SAFE craft (richer loader, price
  anchor, skip escapes); REJECT dark patterns (email-before-value, fake progress, hidden $1 trial,
  phone-only cancel).

**Open questions:**
1. **BeenVerified experiment scope** — full separate arm vs fold tactics into Wave 1 variants (owner
   leaning full experiment).
2. **Retention-backend location** — lean SEPARATE isolated service (not the public SEO app).

**idlookup.me reality vs old memory:** LIVE + indexable, sitemap index ≈868k URLs but ~99.9% are thin
name-in-city doorway leaves (`/people/*` Census taxonomy, DB-free) vs 619 real profiles (`/profiles/*`,
Neon). Staged-rollout `indexable` gate is DEAD (gates nothing). `seo/DEPLOY.md`/`README.md` STALE
(say Phase-0/noindex/fixtures). Street-PII-in-JSON-LD worry is NOT live (teaser only captures city/state).
Supersedes forward-looking bits of [[project_seo_live_idlookup_me]] and [[project_seo_content_augmentation]].

**EXECUTION started 2026-07-11 (committed to main? NOT yet — build-verified, on disk):**
- **(a) Wave 0 instrumentation** — added `loader_start`/`loader_complete` (surface-A `track`) to all 3
  loaders (Name/Phone/Email `*LoaderPage.js`); added missing `search_failed` to Email loader; cancel
  flow gaps closed in `AccountPage.js` (`subscription_cancel_error`, `subscription_reactivate`,
  `subscription_reactivate_error` — reactivation + failed-cancel were untracked). `docs/EVENTS_CATALOG.md`
  updated (source of truth). Build clean.
- **(b) BV optional-flow scaffold** — `src/services/featureFlags.js` (`isBvFlowEnabled()`: OFF by
  default; enable per-tab via `?flow=bv`, or build via `REACT_APP_ENABLE_BV_FLOW=true`; `?flow=off`
  clears). New route `/name/landing/bv` → `src/pages/sales/NameSearchBvFlowPage.js` (self-guards →
  redirects to `/name/landing` when flag off). SCAFFOLD phases: drip (name→location, "I'm not sure"
  escape) → long anticipation loader that carries payoff → **email capture mid-loader** (fires
  `email_capture`, email VALUE never in analytics per PII boundary; consent line shown; lead stashed in
  `sessionStorage.bvLead` w/ TODO to POST to area-iv remarketing backend) → hands to `/name/search-result`
  (TODO: BV routes straight to PAYWALL/loader-replaces-teaser). Guardrails kept (consent, self-serve
  cancel downstream). Bundle `public.e82e262f.js`.
- **COMMITTED + pushed to main 2026-07-11** (docs `46df82c`, code `36cb257`). Deployable bundle
  `public.e82e262f.js` (secret scan clean).
- **UAT PASSED (local serve-prod + Playwright):** walked `/name/landing/bv?flow=bv` — flag gate works,
  drip (name→location) → loader-payoff → email-capture-mid-loader all render; event chain fired in
  order: `landing_view(bv) → search_step×2 → loader_start → email_capture → search_submit →
  loader_complete → results_view`; lead stashed in `bvLead`; `email_capture` carried NO email (PII
  boundary held); consent line shown. The 412 on the teaser search is BC's DEV captcha gate ("Input
  Password" modal), expected — NOT a scaffold bug (prod captcha removed 2026-06-24).
- **BV flow FILLED OUT (commit `825daf5`, bundle `public.1b228139.js`):** now a **3-step drip**
  (name → location+city → details: age/middle + FCRA consent, each with "I'm not sure"; fires
  `search_step×3` + `fcra_agree`); loader **elongated 9s→15s** + enriched (checklist checks off +
  carouseled anticipation panels + personalized email gate). **THREE hand-off versions via `?dest=`**
  (owner ask): `serp`→/name/search-result, `sup`→/search/:id (top match), `payment`→/payment (faithful
  BV). Each a distinct arm: variant `bv-serp|bv-sup|bv-payment`. sup/payment **fall back to serp** when
  no top match. Re-verified via Playwright: chain fires in order, variant=bv-payment, lead dest
  captured; dest=payment fell back to SERP only because dev search 412'd (0 results) — on prod it hits
  /payment. Loader still ~15s (BV is 60-90s — tune later).
- **BV flow polish (commit `a5b473d`):** (1) **extended post-email tail** — two-phase loader freezes
  at 75% for email, then longer 75→100 "Finalizing your report" tail (~16s, POST_EMAIL_MS) w/ rotating
  status lines + all checklist done. (2) **removed "Step X of 3"** drip counter (owner: friction; BV
  hides drip length — verified BV has no step counter). (3) **`BvSocialProof.js`** — inline SVG/CSS
  (CSP-safe, no trademark risk): ReviewStars, TrustBadges, LiveStat (animated "reports generated"
  counter), Testimonials rotator, use-case DONUT infographic. Wired into drip (trust footer +
  testimonial + donut on step 1) + loader (counter + testimonial). ⚠️ **ALL figures/testimonials are
  PLACEHOLDER** (`PLACEHOLDER_*` consts) — OWNER MUST APPROVE real/substantiated numbers before live
  traffic; do NOT run fabricated stats as fact. Verified via Playwright.
  BV social-proof assets we mirrored (from teardown): live counter, testimonials, ★ reviews, use-case
  donut, trust badges. NOT copied: real brand-logo badges (DigiCert/MTV/Trustpilot — trademark).
- **BV flow figures + ending (commit `e18eb77`):** `BvSocialProof` figures split into
  **DEFENSIBLE_STATS** (industry-true: billions of records / 10,000+ sources / all 50 states — LexisNexis;
  shown via `StatStrip`, safe to run) vs **company PLACEHOLDER** (rating/reviews/live counter — owner
  must substantiate). Testimonials refined to 6, use-case varied (still placeholder/illustrative).
  **`payment` hand-off now ends on `/signup?redirect=/payment`** (create account → payment; can't pay
  without an account). redirect MUST be `/payment` (whitelisted in `useSignup SAFE_REDIRECT_PREFIXES`);
  bare `Payment` fails the open-redirect guard. Verified.
- **PRODUCTION DEPLOYMENT SPEC (owner, do AFTER flow finalized — NOT started):** (1) rename `bv`→a real
  numbered variant — ⚠️ **`v10` already taken** (`NameSearchLandingV10Page` warm-safety); repurpose that
  slot or use `v11` — OWNER TO CONFIRM. (2) **capture emails for real** — currently tab-local
  `sessionStorage.bvLead`; OPEN pick: BC `managedContact.create` (closest) vs BC `tracking.create` vs
  first-party endpoint (area iv). (3) **shN mapping split**: PAID traffic split `bv|/name/landing/v3`;
  SEO traffic split `bv|/name/landing/v2` — scope where the split lives (shN registry/resolver). Full
  spec in `docs/design/funnel-mimic-plan.md` "Production deployment spec".
- **Local-test note:** BC dev `password.v0` captcha ("Input Password") gates the search on local only;
  removed on PROD (2026-06-24). Never suppress it. Flow runs around it (handoff still fires).
- **⚠️⚠️ IDI (our search provider) RETURNED **NO RESULTS 2026-07-08 → 07-12** (account blocked for
  non-payment; found Sun 7/12).** ANY conclusion about common-name searches or city filtering drawn in
  that window is INVALID — including the **2026-07-10 directory calibration** (the estInCity∈[2,750)
  rare-name gate + the EST_IN_STATE_MAX=1000 ceiling, both decided MID-OUTAGE, so they optimized against
  an all-zeros provider). Also suspect: any thin-match spike / attribution reads from that window. Only
  data from **2026-07-13+ (post-unblock)** is trustworthy. Re-verify anything calibrated 7/8–7/12.
  While blocked, common-name searches thin-matched → we misread it as "name too common" and built the
  SEO directory to favor RARE names + strip city. Live re-test after unblock (2026-07-13) inverts it:
  Michael Smith/CA (estInState 4,938) → 30+ results; James Johnson/NY 1,288 → works; Robert Williams/FL
  904 → works; Maria Garcia/TX 758 → TooManyMatches (name-specific, NOT predicted by estInState). Owner
  messaging IDI to confirm ALL searches were blocked. **City param:** IDI now accepts city (no more
  status:failed/0) but does NOT narrow accurately (James Johnson "New York" → upstate cities) → KEEP the
  `delete query.city` strip in apiRouter (searches stay name+state; city is client-side filter). Both
  prod (Cloudflare Turnstile) + dev (password captcha) block AUTOMATED search testing — owner runs them.
- **SEO directory REGENERATED gate (commit `16f5799`, `seo/lib/directory.js`):** flipped from rare
  (estInCity∈[2,750)) to COMMON: a name earns a city page when estInState∈[200,10000] (common → rich
  name+state results, since search strips city) AND estInCity≥2 (real presence). ~335k pages / 1,509
  cities (was ~866k rare). Band = STARTING values, **re-calibrate with a fresh HEADED sweep now that the
  account is live** (sweep is Turnstile-gated, owner-present, `seo/scripts/sweep-profiles.mjs`).
  EST_IN_STATE_MAX raised 1,000→10,000 (old ceiling was block-polluted). **idlookup.me is seeing traffic
  growth.** City page: moved "Most common names" to #2 below "at a glance" (`5b4dd0b`, verified render).
- **⚠️ CORRECTION (owner 2026-07-13): the sweep is IRRELEVANT to what matters.** The **location/city/name
  directory `/people/*` is 100% DB-FREE** — computed at build from Census slices (`lib/directory` + gate)
  + `lib/facts` JSON; NEVER touches Neon (directory.js header says so). To regenerate it with the new
  common-name gate → **just REDEPLOY the SEO app on Vercel** (rebuild recomputes taxonomy + sitemap,
  ~335k pages). NO sweep, NO Turnstile, NO Playwright, NO Neon. The **`/profiles/*` (619 individual
  captured people) are LEGACY — owner says ignore them.** The sweep ONLY populates those legacy profiles,
  which is why the whole Turnstile/Playwright detour was moot. Don't run the sweep for the directory.
  (Sweep from datacenter/CI also endless-captcha-loops now — Cloudflare bot-flag and/or IDI account not
  fully restored for direct teaser API; funnel searches work but direct searchTeaser loops.)
- **[SUPERSEDED — legacy profiles only] RE-SWEEP: Runbook `docs/seo/resweep-runbook.md` (`63182c6`).**
  `sweep-profiles.mjs` needs NO change: `data/name-pairs.ndjson` is ALREADY ranked common-first (rank1=
  Michael Smith), so `--names N` = top-N most common × 50 states. Sweep is BLOCK-SAFE (blocked/error/empty
  NOT marked done → auto re-capture; only TooManyMatches marks done). Cmd: `cd seo && DATABASE_URL=… HEADED=1
  node scripts/sweep-profiles.mjs --names 200` (resumable, ~4.5s/call). Safe pre-step: `DELETE FROM sweep_log
  WHERE swept_at >= '2026-07-08' AND swept_at < '2026-07-13'` (re-verify outage-window combos). Two pieces:
  `/people/*` = gate-computed (regenerates on REDEPLOY, no sweep); `/profiles/*` = real data (the sweep).
  **SEQUENCE: re-sweep → then back to LEAD-ENDPOINT deploy (`docs/design/lead-endpoint-deploy-runbook.md`).**
- **Email-capture mechanism + end-in-search (commit `057e6d1`):** `src/services/emailCapture.js`
  `captureEmail(email, meta)` = ONE function for all email capture → localStorage (`capturedEmails` log +
  `capturedEmail` latest) AND fire-and-forget POST to our lead endpoint (dev: mock server
  `POST /api/v1/leads` → `server/leads.jsonl`, gitignored; prod: `REACT_APP_LEAD_CAPTURE_URL`). Email
  VALUE stays OUT of analytics. `SignupPage` pre-fills email from `getCapturedEmail()` (?email= wins) →
  feeds the existing email+pre-gen-pw→BC path at signup; no separate BC call at capture. BV email gate
  now calls captureEmail (removed tab-local stashBvLead). **BV launch ending = SEARCH** (dest defaults
  serp); payment/signup-direct ending DEFERRED (owner: "needs more app tuning"), kept behind ?dest.
  Verified e2e: localStorage + leads.jsonl + signup prefill all populate. Local dev note: BC captcha
  overlay intercepts the email-gate click on local — clicked via JS in test; not a code issue.
- **DEPLOY DECISIONS LOCKED (owner):** (a) rename `bv`→**`v11`** (v10 taken). (b) email home = localStorage
  + our endpoint (DONE) + keep for signup prefill (DONE). (c) shN split — PAID `v11|v3`, SEO `v11|v2`.
- **Flow cleanup + push (commit `48ce474`):** locked down funnel chrome — added `/name/landing/bv` to
  `SELF_CHROME_PREFIXES` (Header.js) → suppresses global nav AND footer across drip+loader (they share
  the route); flow renders its own minimal logo-only header. **Sky-blue theme** (owner: BV CTAs use sky
  blue not green): **ONLY the view/discovery CTA buttons are sky blue `#0284c7`** — corrected `b4fa458`
  after over-applying it to the whole flow; chrome/logo/stats/loader stay funnel green. Chrome lockdown
  (self-header, no nav/footer) kept. Verified via screenshot.
- **OWNER SEQUENCE:** clean up flow ✅ → push ✅ → **wire shN split** (NEXT) → **prod endpoint on
  Vercel+Neon** (like the SEO project) for the email leads.
- **Flow-issue fixes (commit `db25757`):** (1) **CTAs back to GREEN `#16a34a`** (owner: sky blue was too
  much — went through skyblue→only-buttons→green; final = green like other flows). (2) **SERP result
  click → PAYMENT, no email re-ask.** BV flow captures email mid-loader → sets session flag
  `bvAutoCheckout`; `SearchResultsPage.handleResultClick` → if flag+captured-email+not-logged-in →
  `/signup?selected=<id>&redirect=/payment&auto=1` (else normal SUP); `SignupPage` on `?auto=1`
  auto-submits signup w/ captured email + `generatePassword()` (optin true = consented at gate), shows
  "Setting up your account…", redirects to /payment; falls back to form on no-email/error. Verified
  e2e: lands on /payment. NOTE: this is the "SERP→payment app tuning" the payment-dest ending needed.
- **shN DECISIONS LOCKED:** paid = ONLY v3 (inmate) family; SEO = tag OR referrer=idlookup.me; ratio 50/50.
- **v11 rename DONE (`27334e6`):** route /name/landing/v11, variant `v11-${dest}`, SELF_CHROME+catalog.
- **v11 guard REMOVED + SUP-bypass FIXED (`cb5e46b`):** (0) /name/landing/v11 renders directly (was
  redirecting when QA flag off — flag guard removed; exposure now via the split not a page gate).
  (1) SUP-bypass moved to `ResultCard.handleViewDetails` non-member branch (the 'View Details' CTA
  uses ResultCard's own nav + stopPropagation, so the SearchResultsPage handler never ran). Now: any
  non-member SERP click WITH a captured email → `/signup?selected=<id>&redirect=/payment&auto=1` →
  straight to payment. Verified e2e (seeded → View Details → /payment).
- **v3-STYLE HEADER + GREEN CTA (`0f4e106`):** BV flow reuses v3's `NameLandingV3Incarceration.module.css`
  — self-chrome #0d5d2f header (no nav links) + v3 `.cta`/`.buttonSecondary` (dark green). /name/landing/bv
  re-added to SELF_CHROME_PREFIXES→v11.
- **shN SPLIT: helper built, NOT WIRED (`2bca30a`, `src/services/funnelSplit.js`).** ⚠️ Owner flagged:
  paid traffic currently → v3a/v3b via BC-theme A/B; must NOT overwrite it. Corrected design: PAID
  v3-FAMILY (v3/v3a/v3b) = 50% v11 / 50% KEEP the resolved arm (preserves the theme A/B). SEO = 50%
  v11 / 50% v2. Sticky stores decision (v11/keep). **Registry NOT retired (confirmed active).**
- **shN SPLIT WIRED + verified (`ab5b5e1`), owner-confirmed ratios:** PAID inmate (v3-family) = **75% v3
  / 25% v11**, OVERRIDES BC theme (drops v3a/v3b — not enough volume); wired in `HomePageRedirect`
  (`resolvePaidRoute`, skips awaitTheme when overriding; v4/v6 untouched). SEO/referral from idlookup.me
  lands DIRECTLY on `/name/landing/v2?utm_source=idlookup.me` → new `V2LandingSplit` wrapper splits **50%
  v2 / 50% v11** (redirect carries query); non-SEO v2 (utm_source=google) renders v2 unchanged. Deep
  `/name/search-result?firstName=…` idlookup.me links left as direct results (carry person context).
  `isSeoTraffic` = utm_source in {idlookup.me,seo} OR ?seo=1 OR referrer=idlookup.me. Sticky per visitor.
  VERIFIED LIVE: SEO both arms + non-SEO passthrough. ⚠️ PAID override NOT live-tested (can't simulate a
  v3 shn locally) — needs a with-owner dev check (land `/?shn=<inmate>` → ~75% v3 / ~25% v11, NO v3a/v3b).
  Two example idlookup.me URLs: `/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&state=AR`
  and `/name/search-result?firstName=John&lastName=Williams&state=AR&city=Texarkana&utm_source=idlookup.me…`.
- **EMAIL-CAPTURE EVERYWHERE (`8752e4b`):** every user-email capture now POSTs to `/api/leads` via
  `captureEmail`. Added to `useSignup.submit` (source `signup` — covers ALL signup surfaces: SignupPage,
  SignupPageStepped, SupTeaserA, SearchDetailPreviewPage) + `ContactPage` (source `contact`, carries
  marketing optin). BV loader gate already had it. Excluded: login/forgot-pw/unsubscribe + email-SEARCH.
- **v12 (DIVORCE) + v13 (DEATH) flows (`235b331`):** duplicated the v3 inmate flow via a new cfg-driven
  `VerticalIntentLanding.js` (v3 file untouched); v12/v13 are thin config wrappers (copy-only). Routes
  `/name/landing/v12` + `/v13`, in SELF_CHROME_PREFIXES, tracked v12/v13, search_type name → /name/loader.
  Both render-verified. NOTE: to route paid divorce/death campaigns here, point their shN registry entries
  at v12/v13 (old death=v4, divorce=v6 — owner decides if superseding).
- **✅ (3) /api/checkout-abandoned BUILT (`7c8cd3d`) — first email-marketing endpoint on the growth
  backend.** `seo/app/api/checkout-abandoned/route.js` + `abandoned_checkouts` Neon table (created;
  `emailed_at`/`recovered_at` cols for the future recovery-email cron) + `insertAbandonedCheckout`
  (leads-db.mjs). email OPTIONAL. Consumer: `emailCapture.captureAbandonedCheckout()` (keepalive POST,
  fires on pagehide; URL derives from REACT_APP_LEAD_CAPTURE_URL → /checkout-abandoned, NO new env);
  `PaymentPage.fireAbandon` POSTs {email:getCapturedEmail(), personId, offer, variant}. Verified DB
  insert + consumer build (`a9ccf83d`). Endpoint auto-deploying (404 until Vercel finishes, like /api/leads).
  **NEXT (future): recovery-email Vercel Cron reading pending abandoned_checkouts → SendGrid (needs the
  sending subdomain e.idlookup.ai + SendGrid key). Owner uploads consumer bundle to BC for (1)+(2)+(3).**
- **🏗️ DECISION (owner 2026-07-13): the idlookup.me Vercel+Neon app = the "GROWTH BACKEND"** — hosts SEO
  content (done) + lead capture/storage (done, `/api/leads`) + **email marketing infra (next)**. This IS
  the area-iv email-platform keystone with a confirmed home. Add on the same pattern (endpoint + Neon
  table + Vercel Cron + auto-deploy): SendGrid send, `/api/checkout-abandoned` event, drip/digest crons,
  subscriber/campaign/send-log tables. Independent of BC (BC serves only the static consumer, which makes
  ONE fire-and-forget POST — the ONLY cross-system dependency, and it's soft: localStorage fallback).
  **TWO boundaries to set:** (1) PII isolation — consumer PII in dedicated tables / optionally a SEPARATE
  Neon DB via `LEADS_DATABASE_URL`; public SEO pages must never query them. (2) Send FROM a dedicated
  subdomain (e.g. `e.idlookup.ai`) w/ own SPF/DKIM/DMARC — NOT from idlookup.me (protect SEO ranking +
  don't touch BC transactional deliverability). Host logic on idlookup.me Vercel; send-identity separate.
- **✅ PROD LEAD ENDPOINT LIVE (2026-07-13):** `https://idlookup.me/api/leads` is DEPLOYED + persisting
  to the SEO Neon DB. Task 1 (leads table created via `seo/scripts/init-leads-table.mjs` — fixed to use
  the tagged-template Neon driver, `ada04fd`) + Task 2 (SEO app auto-deployed from main) DONE & verified:
  live POST → row in Neon (email/source/variant/ip/received_at), OPTIONS→204+CORS, cleaned up. Consumer
  bundle rebuilt with `REACT_APP_LEAD_CAPTURE_URL` baked in (`public.78e61e15.js`, secret-scan clean).
  **ONLY REMAINING: owner uploads build/ to the BC VPS** (normal consumer deploy). Neon IS reachable from
  the agent sandbox (unlike the Turnstile-gated sweep) — that's how the table was created + verified.
- **PROD LEAD ENDPOINT (build history `75cd119`):** `POST /api/leads` on the SEO app (Vercel+Neon),
  `seo/app/api/leads/route.js` + `seo/lib/leads-db.mjs` + `seo/db/leads-schema.sql`. Separate `leads`
  table; supports `LEADS_DATABASE_URL` for PII isolation later. CORS for idlookup.ai origins; no-DB path
  returns {ok:true,persisted:false}. Verified locally (valid→200, invalid→400, OPTIONS→204+CORS).
  **DEPLOY STEPS:** (1) run `seo/db/leads-schema.sql` on Neon; (2) deploy SEO app; (3) set consumer prod
  `REACT_APP_LEAD_CAPTURE_URL=https://idlookup.me/api/leads`. Main paid landing = `https://www.idlookup.ai/?shn=6a22ff83ca16ad4ef68b84b5` (Google Inmates→v3).
- **⚠️ ATTRIBUTION BUG CONFIRMED (owner's hypothesis right) — doc `docs/reporting/thin-match-attribution-2026-07.md`:**
  SEO/referral thin-matches ARE booked as PAID. Root cause: **attribution keys on shN; `utm_source=idlookup.me`
  is captured but NEVER used for paid-vs-organic split.** SEO deep link → no shN in URL → BC assigns DEFAULT
  shN → reporting groups by shN → SEO lands in internal/paid bucket. Confirmed flow: captureReferralParams
  DOES capture utm_source (gtm.js:41-55); `/name/search-result` runs a real teaser search + fires
  `results_view{thin_match_version}` (SearchResultsPage.js:66-68,111-155); ThinMatchPreview fires NO event
  (thin match only visible via empty results_view). **Two gaps:** (1) `buildReferQueryString` (trackingService.js:78-94)
  DROPS utm_source → the ORDER (commerceorders.refer, PaymentPage.js:396) has zero idlookup.me signal =
  revenue misbooked (highest value). (2) `setBcAttributionFromResponse` (apiRouter.js:243) stamps DEFAULT shN
  into GA4 for no-shn traffic. **FIXES:** client — override refer.channel='referral'/partner='idlookup.me' in
  buildRefer when idlookup.me; add refer_source/refer_channel to buildReferQueryString (1-line BC confirm key
  persists); stop backfilling default shN into GA4 for no-shn. BC/reporting — group by refer.source/channel not
  shN. **⚠️ THIS UNDERMINES THE v11 SPLIT METRICS until fixed — the paid/SEO A/B needs trustworthy source attribution.**
- **ATTRIBUTION FIX SHIPPED (`6ad7328`, `trackingService.js`):** when `isIdlookupReferral(params)`
  (utm_source in {idlookup.me,seo} OR referrer=idlookup.me), stamp explicit referral attribution in all
  3 surfaces: (1) `buildRefer` → refer.source/channel/partner = idlookup.me/referral (BC data.refer);
  (2) `buildReferQueryString` → adds `refer_source`/`refer_channel` to the order (revenue books referral,
  not paid) — ⚠️ **BC ASK: confirm refer_source/refer_channel persist onto commerceorders.refer like
  refer_partnerId does**; paid keeps refer_source=<utm_source>; (3) GA4 dataLayer push overrides
  partnerName/partnerChannel/source. Only mutates REPORTED attribution, NOT sessionStorage.attribution.*
  (conversion gates/GTM context untouched). VERIFIED e2e: SEO→partnerName=idlookup.me/channel=referral;
  paid(utm_source=google) unaffected. Now the v11 split metrics are trustworthy (paid vs SEO separable).
  Fix 3 (apiRouter default-shN GA4 backfill) NOT needed — overrode at the emission point instead.
- **NEXT (the deploy step — flow is now finalized):** (1) rename bv→v11 (flag/route/variant strings +
  EVENTS_CATALOG enum); (2) wire the shN split in the shN registry/resolver ([[project_shn_framework]]) —
  needs investigation of where routing/variant selection lives; (3) set prod `REACT_APP_LEAD_CAPTURE_URL`
  to a real endpoint (area iv). Then: tune loader toward 60-90s; extend flow+assets to phone/email. switch the
  loader hand-off from results → paywall; tune loader length toward BV's ~60–90s; wire the lead POST
  once the email backend (area iv) exists. Only name vertical scaffolded (phone/email later).

Related: [[project_funnel_redesign_2026_07_03]],
[[project_backlog]] (BACKLOG-1 email, PayPal, PDS email platform), [[feedback_innovate_dont_wait_for_bc]].
