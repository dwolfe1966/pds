---
name: project_session_end_2026_07_21
description: "Session-end 2026-07-21 — pickup state, current bundles, pending owner actions"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

**Big arcs this session:**
1. **Inmate/incarceration MOAT scaled** — crawled ~all state adapters into `inmates` (526k rows / 47 states, +FL 670k in fl_inmates); daily GitHub cron `crawl-inmates.yml` (07:00 UTC, VINE-first + MO added). Found+fixed the shared **dedup 0-write bug** in inmatesDb + sexOffenderDb (in-batch dup ids → silent 0). Still-zero adapters: MO(cron will get)/AK/NM. SO grid → 67k rows/104 juris.
2. **SEO recovery COMPLETE (dedup sequence 1-2-3-4)** — differentiate (inmate/SO on name-in-state + county hubs) → noindex residue → canonical hygiene → **Step 4 de-template** (name-in-state intro data-driven + facts compacted). County-hub taxonomy live. Bing URL-submission cron + IndexNow; sitemap fix (submit sitemap-directory.xml in GSC+Bing — OWNER UI). GSC: 13.7k indexed, recovering (impressions 0→627); keep old sitemap to flush thin pages.
3. **SOCIAL PRESENCE vertical (experimental)** — full research (docs/research/social-presence-*.md). Built: seo/lib/{socialFootprint,socialPresence}.mjs (PDL+Gravatar, liveness-verify [drop only 404/410], confidence tiers) + /api/social-presence + /api/pdl-usage + pdlBudget (track spend, PDL_DAILY_CAP cap). Consumer: SocialPresenceTeaser on has-results SERP (name-key, confidence-gated) + report "Online presence" enriched (email-key, rich, liveness-filtered, confidence-badged). PDL_API_KEY LIVE in Vercel. Thin-match payment fix earlier.
4. **Onboarding-reveal** — OnboardingReveal (~15s enrichment reveal + email gate) between SERP and SUP/Payment, per-flow (campaign.onboarding OR ?onboard=1).

**CURRENT CONSUMER BUNDLE (social ON + onboarding, for testing): `public.859e900c.js`** (default/production build without REACT_APP_SIGNALS_SOCIAL keeps social OFF). NOT on BC.

**PENDING OWNER ACTIONS:** (1) upload consumer bundle to BC when ready; (2) submit **sitemap-directory.xml** in GSC + Bing WMT (both were on the thin sitemapv2); (3) Spokeo + Pipl outreach (FCRA-clean social display; drafts in vendor-eval doc) + resolve PDL display terms; (4) 16 Dependabot vulns (4 high) — untouched. **NEXT CANDIDATES:** MO/AK/NM adapter check; death-vertical BC ask; wire social on more surfaces; city/state intro de-template (optional).

See [[project_social_presence]], [[project_seo_recovery]], [[project_thinmatch_payment_fix]].
