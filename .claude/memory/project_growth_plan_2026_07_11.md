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
- **NEXT:** runtime UAT of the flow needs a live BC search (Turnstile-gated, owner-present); switch the
  loader hand-off from results → paywall; tune loader length toward BV's ~60–90s; wire the lead POST
  once the email backend (area iv) exists. Only name vertical scaffolded (phone/email later).

Related: [[project_funnel_redesign_2026_07_03]],
[[project_backlog]] (BACKLOG-1 email, PayPal, PDS email platform), [[feedback_innovate_dont_wait_for_bc]].
