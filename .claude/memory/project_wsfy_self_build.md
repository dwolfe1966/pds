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

**Phase 2 — reverse-join + reveal: PARKED on one decision = reveal posture.** Recommended aggregate/
teased only (MyLife/FTC-safe): "3 searched for you, one near Dallas" — never expose searcher identity.
Guardrails: honor IDI/index opt-out suppression, retention window on result PII (30–90d), non-FCRA, no
stalking-confirmation. Anon capture already decided YES.

**Phase 3:** "someone searched for you" alert emails, reusing the SendGrid platform ([[project_email_recovery_pipeline]]).
