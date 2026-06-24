---
name: project_adunit_funnel_review
description: "Ad-unit (name/phone/email landing) UX+conversion review 2026-06-24 — what's fixed and the outstanding punch list"
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

Read-only UX/conversion review of the 15 paid landing funnels (name/phone/email × V2–V6), 2026-06-24. The funnels split into loader-delegating variants (fire conversion signals) and inline-search variants (bypass the loader → Ads-invisible).

**FIXED + runtime-verified (commits 46b923b name, 1826c64 phone):**
- Name V2/V5 and Phone V2–V6 now delegate search to /name/loader and /phone/loader (the V1/V3-proven path). Closes: (a) Ads-invisibility (inline searches fired NONE of gtmSearchSubmit/track('search_submit')/appendSearch/persistThinMatch), (b) Phone error dead-end (inline error nav dropped ?phone= → results page redirected to /phone/landing; loader carries ?phone= on success+error), (c) Name V5 raw-error leak. Verified via scripts/verify-funnel-loader.js (serve-prod → walked name/v2 + phone/v2 → both reach the loader with correct params + full client_* dataLayer funnel).

**ALSO FIXED 2026-06-24:**
- Name state-required labeling contradiction (commit d96473b): V2 "All States" / V3/V4/V5 "Select state (optional)" → "Select a state"; V5 location helper "Optional — you can skip" → "Your state is required…". State IS required (continueFromLocation blocks).
- Phone SRP responsive container (commit b000932): added PhoneSearchResultsPage.module.css (.page/.card + 640px breakpoint); desktop unchanged, mobile padding tightened. Full inline→tokens rewrite still deferred.

**OWNER DECISIONS 2026-06-24:**
- Fake "matches found before search runs" (name details step "Possible Matches Found!" etc.) — owner says **LEAVE IT** (keep the hook). Do not soften.
- Promise→payoff mismatch (V3 inmate / V6 criminal / V5 business / Email V6) — owner will **optimize content SPECIFICALLY per ad unit later this week** (~week of 2026-06-24). Don't touch copy now; surface-the-data-on-SRP is part of that.

**OUTSTANDING (lower priority):**
- Fake "Searching…" interstitial runs BEFORE collecting all inputs (phone & email) — incoherent ordering.
- Discarded "state/context" step: phone & email collect `state` but never pass it to searchPeople — friction. (Phone search is by number; state genuinely unused.)
- First wizard screen fires only landing_view, no search_step. NOTE: step-1 drop-off IS already derivable (landing_view − searching-one); a mount-time entry event would just duplicate landing_view. A first-INPUT engagement event would be non-redundant but is a ~15-file change for a marginal signal — deferred unless owner wants the uniform GA4 series.
- V1 landings (name/phone/email) have NO FCRA consent step while V2–V6 gate on it — legal-consistency decision.

Full per-family punch lists were produced by product-quality-reviewer agents this session.
