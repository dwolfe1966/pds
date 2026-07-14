---
name: project_bc_teaser_city_added
description: BC added CITY to the teaser search API (2026-07-14) — revisit apiRouter city-strip + SEO city-grain after WSFY
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

**BC added `city` to the teaser search API (owner told me 2026-07-14).** Tackle AFTER WSFY.

This reverses a core assumption. Previously the teaser ran on **name + STATE only** — `apiRouter.js`
**stripped `city`/`age`** because they returned status:failed/0 ([[feedback_search_contextkey]]), and the
whole SEO directory city-grain gate was calibrated around "teaser strips city → resolves at state grain."

**Why:** city narrowing now works, so results can be city-specific instead of state-wide.

**How to apply (the after-WSFY work):**
1. **`src/services/apiRouter.js`** — stop stripping `city` from teaser (the `?debug_extras=1` path kept
   it). Verify BC now returns results (not status:failed/0) with city passed. Move ONE change at a time —
   contextKey/teaserInput are fragile ([[feedback_search_contextkey]]); test before/after.
2. **SEO directory ([[project_seo_content_augmentation]], [[project_seo_live_idlookup_me]])** — the
   city-grain gate in `seo/lib/directory.js` and the name-in-city leaf were generalized to state because
   city didn't narrow. Re-evaluate: city pages/SERP hand-offs can now carry city and resolve city-specific.
   The name-in-state recovery pages + city SERP hand-offs currently pass state only; can add city back.
3. **WSFY** — search-activity capture already stores city terms; nothing breaks, and city-precise result
   matching improves once teaser city works. The `apiRouter` city-strip is upstream of capture.
4. Re-verify the block-era calibration notes in `directory.js` (already flagged for a fresh headed sweep).

Confirm the exact BC request-shape change (does teaser now accept `city` in the query, or a new field?)
before editing — check the BC API CSVs / probe ([[reference_bc_iife_request_shapes]]).
