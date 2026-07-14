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

**Phase 2b — richer affinity tease: SHIPPED 2026-07-14 (engine live; occupation needs the pipeline).**
`buildWsfySummary` computes per-searcher affinity tags → richer lines ("1 who may be a relative · 1 in
your area · 1 near San Diego · Carol King (works in healthcare) · and 1 more"). Corpus-derived (live, no
COGS): relative (searcher's OWN surname == subject's), local (same city→"in your area"), other-city
("N near X"), frequent (>=2). Enrichment SEAM: `member_enrichment` table (occupation/employer/verified
relatives) + `POST /api/member-enrichment` (upsertMemberEnrichment); wsfy.mjs LEFT-joins optionally
(empty→degrades). Paid events carry affinities[]+occupation. Verified vs Neon.
**Enrichment PIPELINE — BUILT 2026-07-14 (two sources → member_enrichment).** Owner chose member-initiated
self-report + user-provided profile fields. Overlap affinities now work (need BOTH searcher+subject
enrichment): high_school→"went to your high school", college, colleague(same employer), + searcher
occupation→"works in {industry}". Sources: (1) `SearchResultDetailPage` fires `enrichFromReport()` when a
report is confidently the member (name AND state match), extracts occupation/relatives/city via extractAll;
(2) `EnrichProfileCard` dashboard/onboarding form (occupation/employer/**high school/college**/city) →
`saveMemberProfile()`. Both POST /api/member-enrichment (upsert partial-merge). member_enrichment +
high_school/college/attributes cols. Consumer bundle public.1b6ae080.js (not yet on BC). **The
user-provided high_school UNLOCKS the "went to your high school" affinity the report data can't give.**

**Self-identify flow (SelfIdentifyCard, dashboard, SHIPPED 2026-07-14):** enter name/location/age →
`api.searchPeople` → disambiguate ("which one is you?") → select → (paid) `createReportForIdentity(extId)`
→ `getReportDetail` → `enrichFromReport(report, selfPerson)`. **Canonical id = the created report's
`commerceContentId`** (STABLE, re-fetchable — NOT the ephemeral extId; see [[reference_bc_extid_ephemeral]])
→ stored in `member_enrichment.report_id` + `self_person`. Association stored in OUR OWN Neon/endpoint
(owner: "create our own data structure + endpoint with idlookup.me infra"), independent of BC. Report-pull
gated on isPaid (free can't create reports → stores confirmed identity only). Then a schools step. Bundle
public.41a4e73c.js. EnrichProfileCard (manual occupation/school) still exists, no longer on dashboard.

**Owner's next sequence (2026-07-14):** (1) [done] enrich-from-report self-identify flow → (2) **auth-harden**
(ingest + /api/wsfy tier, client-asserted) → (3) **payment flows** — free user wants to see who's searching
for them; design the WSFY paywall/teaser on the payment page. Backlog: mobile payment page = vCard first
(not the $1 trial price) — see [[project_backlog]].

**App-key gate + cross-device (SHIPPED 2026-07-14, interim before real WSFY-AUTH):** owner wanted WSFY/
identity cross-device now, accepting non-per-user auth. `seo/lib/app-auth.mjs` `checkAppKey` — X-App-Key
header must match `WSFY_APP_KEY` env; gates /api/wsfy + /api/member-enrichment (GET+POST); OPEN when env
unset. NOT unbreakable (key ships in bundle, extractable) — raises the bar vs casual scraping only; real
per-user auth still = WSFY-AUTH BC ask. **Cross-device read:** GET /api/member-enrichment?userId= →
mapped-identity summary (keyed on opaque BC userId); consumer `memberEnrichment.fetchMappedIdentity()`
refreshes the localStorage mirror; Account 'My Identity' tab fetches on mount → works any device. Live
verified. **Owner TODO:** set `WSFY_APP_KEY` (Vercel) + `REACT_APP_WSFY_APP_KEY` (consumer .env) same value.

**Account (SHIPPED):** defaults to a clean 'This is your account' Overview landing (was Security/password);
new 'My Identity' tab views/updates the mapped identity (embeds SelfIdentifyCard forceShow when not mapped).

**STILL OPEN:** real per-user WSFY-AUTH (BC ask); payment WSFY teaser (#3 next); onboarding placement of self-identify.

**NOT built (no data source at all):** "just got married" — no marital/life-event field (per bc_report_field_map).
"Went to high school" now DOES work via user-provided profile. Never fabricate.

**Phase 3:** "someone searched for you" alert emails, reusing the SendGrid platform ([[project_email_recovery_pipeline]]).
