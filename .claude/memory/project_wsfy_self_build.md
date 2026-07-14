---
name: project_wsfy_self_build
description: "WSFY (Who's Searching For You) built by us on the SEO Vercel+Neon backend — Phase 1 ingest shipped, reveal parked on privacy posture"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

WSFY built ourselves (BC has no inbound-activity finder — see [[project_bc_consumer_feature_asks]]),
on the idlookup.me growth backend, independent of BC. The consumer `/who-is-searching`
(`WhoIsSearchingPage`, member) already exists as a finished "coming soon" sample → plugs into this
data in Phase 2. Full plan: docs/design/wsfy-self-build.md.

**Idea:** copy every search (searcher + terms + time, and the result set with max detail) to our
own store; WSFY = the reverse join "find searches whose terms OR results match this subscriber."

**Phase 1 — ingest (SHIPPED 2026-07-13, consumer bundle `public.b62e03de.js`, NOT yet uploaded to BC):**
- Capture at `api.searchPeople` (single choke point for name/phone/email, sales teaser + member),
  AFTER the response returns, beside the existing `recordSearchToHistory` — search REQUEST path untouched
  ([[feedback_search_contextkey]]). Fires for anon funnel AND members.
- `src/services/searchActivity.js` `captureSearchActivity()` → fire-and-forget POST; resolves searcher
  (member userId | stable anon `sa_anon_id`); trims heavy BC raw blobs; PII server-side only, never GA4.
- `seo/app/api/search-activity/route.js` + `seo/lib/search-activity-db.mjs` (`insertSearchActivity`) +
  tables `search_activity`/`search_results` (`seo/db/search-activity-schema.sql`, applied to Neon).
  Match on normalized name+city+state, NEVER extId ([[reference_bc_extid_ephemeral]]). URL derives from
  `REACT_APP_LEAD_CAPTURE_URL`; no new env.

**Phase 2 — reverse-join + tiered reveal: SHIPPED 2026-07-14 (bundle `public.03ee67a5.js`, not yet on BC).**
Posture (owner): free = obfuscated tease (bait), paid = full detail; masking is SERVER-SIDE (real names
never reach a free client). Capture now also stores the SEARCHER's own name/location (member) →
`searcher_name/_norm/_first/_city/_state`. `seo/lib/wsfy.mjs` `buildWsfySummary()` reverse-joins (term OR
result match, self excluded), returns `{count, teaseSummary:{headline,lines}, events}`. `seo/app/api/wsfy`
POST. `WhoIsSearchingPage` wired: tease banner "N people are searching for you: 2 in Los Angeles, Carol
King…", server-tiered rows, viewers tab = honest empty. Verified vs live Neon.

**Two open items before wide launch:** (1) AUTH — `tier` is client-asserted (spoof → paywall bypass to
searcher names); fix = validate BC token server-side, derive tier from it (flagged in the route). (2)
`isSuppressed()` stub → wire IDI/index opt-out + result-PII retention window (30–90d).

**NOT built (no data):** "went to high school"/"just got married" — licensed BC/IDI data has employment/
relatives/property but NO education/marital field (per bc_report_field_map). Ship sourceable subset only,
never fabricate. Employer/relative-overlap affinity = natural Phase 2b enrichment.

**Phase 3:** "someone searched for you" alert emails, reusing the SendGrid platform ([[project_email_recovery_pipeline]]).
