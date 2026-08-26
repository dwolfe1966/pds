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

**Retroactive matching VERIFIED + 3-tier subject identity (2026-07-16, commits c0b4ad7 + f6fd73e; seo auto-deploys, consumer bundle `public.ab25eee4.js` NOT yet on BC).**
- **Fundamental question (owner): "do new accounts match HISTORICAL searches?" → YES, verified.** `buildWsfySummary`
  is a QUERY-TIME reverse-join keyed on normalized name (selfUserId only EXCLUDES your own searches), so a
  brand-new account matches history purely on name. Empirically: a fresh never-seen selfUserId for "David Wolfe"
  matched 9 historical searchers. Both sides are open: searchers include ANON (86) + members (17), and the subject
  does NOT need to have mapped — name alone works.
- **Corpus starts 2026-07-14** (when ingest shipped). Pre-7/14 searches were never captured = gone. Owner said
  don't pursue a BC backfill of older logs.
- **`resolveSubjectIdentity` hierarchy (owner-specified):** (1) MAPPED self-identify record (`self_person.name`,
  real record incl. middle names → exact result-matches + overlap affinities) > (2) CARD INFO (cardholder name
  captured at checkout, `attributes.cardName`) > (3) SELF-PROVIDED (`attributes.providedName`, then live client
  value). **NEVER the account `fullName`** — that's the SEARCH TARGET (selectedPerson), not the member. Returns
  `matchedVia` so we can see the tier. Verified card_info→9, mapped→10, self_provided→9.
- **Store form info regardless of mapping:** `saveIdentityFormInfo()` (memberEnrichment.js) persists the member's
  OWN name → `member_enrichment.attributes` (merged upsert), keyed by userId. Wired at PaymentPage successful
  sale → captures cardholder first+last as `cardName`, so every PAYING member gets WSFY coverage even without
  mapping. (Self-identify mapping is still prompted for the precision upgrade.)
- **Verification probe:** `seo/scripts/wsfy-match-check.mjs "<Name>" [ST]` (new-account sim) or `--user <id>`
  (resolves via self_person). Answers "does this account match history?" on demand — killed the "we don't know".

**Recall + precision architecture (2026-07-16, commit `c3417b9`; seo auto-deploys).** Owner: maximize
matches (wide net for the count) but SEPARATE high-precision/high-value matches as key signals.
- **Recall widened:** result-matching now also catches middle-name variants (`First % … % Last`) so a
  searcher who saw "David L Wolfe" matches subject "David Wolfe" without the confirmed record.
- **Per-match precision:** `result_exact` or exact first+last typed = **high**; middle-name variant =
  **medium**; same-last + fuzzy-first (nickname/typo) = **low** (the recall net). Best confidence per
  searcher; carried on each event (`event.confidence`).
- **`keySignals[]` + `keySignalCount`:** the high-confidence OR high-value subset (has affinity /
  repeat / member / contact-info search), each with a human `reason` ("Worked at Google", "May be
  family", "Searched you by phone", "Searched your exact name"). `count` stays the broad net; keySignals
  is the signal within it. Verified recall=2 / keySignals=1 on a mixed case.

**Profile views — "who viewed my profile" (2026-07-16, commit `9cecf98`; consumer bundle `public.0ff2aa73.js`
NOT yet on BC).** A distinct, higher-intent stream alongside searches (they opened the FULL profile).
- New **`profile_views`** table (`seo/db/profile-views-schema.sql`) + `insertProfileView`; **POST
  `/api/profile-view`** (ingest, open posture like search-activity POST).
- `queryProfileViewers` reverse-joins on the viewed subject (exact norm, or same-last + fuzzy-first
  recall net; self-views excluded; suppressed viewers dropped; free=masked, paid=named), folded into
  `buildWsfySummary` as **`profileViews:{count,viewers[]}`** — separate from the searches `count`.
- Consumer: `captureProfileView()` (searchActivity.js) fired once per report in SearchResultDetailPage,
  skipping self-views (viewing your OWN profile isn't signal). Verified end-to-end (POST→200, reverse-join
  count 1, masked viewer). This is a first concrete step of [[project_freemium_identity_community]].

**Summary shape now:** `{ count (recall), keySignalCount, keySignals[], sameStateCount, highlights[],
profileViews:{count,viewers[]}, matchedVia, teaseSummary, events[] }`.

**Client surfacing (2026-07-16, commit `989c4a2`, consumer bundle `public.d9614a76.js` NOT yet on BC).**
- **DashboardWsfyCount** (new component) — compact "N searched for you · M viewed your profile" + top key
  signal, full-width below the search row on Dashboard2. Doubles as the **"add your name" on-ramp** (→
  /my-identity) when there's no identity to match yet, so a new member immediately sees potential matches.
- **WhoIsSearchingPage** — the **Viewers tab is now populated** from `profileViews.viewers` (was an
  honest-empty stub — the tab structure was pre-built); new **"Key signals"** section (confidence badge +
  reason) above the tabs; times chip kind-aware (Viewed vs Searched).

**STILL OPEN:** real per-user WSFY-AUTH (BC ask, tier still client-asserted); SEO profile-page view capture
(currently app-only; SEO views are anon/bot-heavy — deferred); onboarding placement of self-identify;
WsfyPaymentTeaser could also consume keySignals/profileViews (currently uses highlights only).

**NOT built (no data source at all):** "just got married" — no marital/life-event field (per bc_report_field_map).
"Went to high school" now DOES work via user-provided profile. Never fabricate.

**Phase 3 — alert / re-engagement emails: v1 BUILT 2026-08-03 (seo/, gated OFF).** Goal = WSFY as a
top-of-funnel conversion hook (paid campaign + free lead re-engagement). `renderWsfyAlert` template +
`wsfy_alert` campaign in `seo/lib/email/send.mjs` (TWO honest modes: realCount>0 → "N searched for you";
realCount=0 → general "who's searching for you?" offer, NEVER fabricated). `getWsfyAlertCandidates`
(leads-db.mjs) de-dupes via email_sends. Cron `seo/app/api/cron/wsfy-alerts/route.js` (every 8h in
vercel.json) — v1 sends the general-offer hook to the un-converted lead list → /my-exposure. OFF until
`WSFY_ALERTS_ENABLED=1` + `EMAIL_POSTAL_ADDRESS` (CAN-SPAM). Depends on Resend domain-auth (owner) — same as
[[project_email_recovery_pipeline]]. Test mode: `WSFY_ALERTS_TEST_EMAIL` (+ `WSFY_ALERTS_TEST_REALCOUNT`) → one inbox.
**LEAD real-signal LOOP CLOSED 2026-08-03:** self-check leads (`variant='self'`, e.g. /my-exposure) → `captureEmail`
stamps `meta.self`+`selfName` (src/services/emailCapture.js, reuses their own search, no new PII); cron Pass 1
`getWsfySelfLeads` → `buildWsfySummary(selfName)` → REAL "N searched for you"; Pass 2 = general offer. Flywheel:
general-offer email → /my-exposure self-map → real-signal thereafter. (Member real-signal via BC userId still a follow-up.)
This session also added: WSFY zero-state pivot in `ZeroResultsPanel` → /my-exposure; `wsfy-display:*` campaign
registry entry (placeholder shN → /my-exposure); removed 16 confidentiality/"never notify" funnel claims
(contradicted WSFY). See [[project_marketing_angles]] + the WSFY campaign brief.

**Self-flow (/my-exposure) polish + DECLARED-IDENTITY persistence (2026-08-03, walkthrough fixes; consumer STAGED, not on BC).**
- **Progressive middle-name refine (SERP):** middle name added to the always-visible "Refine Search" (all name searches). Sends to BC as `mName` (server-side narrow, same as the loader — NOT client-stripped like city/age; verify BC actually narrows). `SearchResultsPage.js` reads `middleNameParam` → `searchParams.middleName`. ⚠️ VERIFY with a common name (David Bruno Wolfe) that mName narrows and doesn't 0-out.
- **Two DIFFERENT "self" flags in PaymentPage — do not conflate:** `selfFunnel = getVariant()==='self'` (the /my-exposure FUNNEL) vs `isSelfContext = upgradeReason==='wsfy'|'identity'` (the member UPGRADE path). `isSelfContext` HIDES the person card; the /my-exposure funnel does NOT set it. Owner (2026-08-03): in the WSFY/self flow KEEP the name visible (user typed it) — just self-frame it. So `selfFunnel` shows an "Is this you?" badge (`selfBadge`), does NOT hide.
- **SUP self-framing:** `SearchDetailPreviewPage` read no funnel-variant → reused search-for-others teaser. Now shows "Is this you?" badge + subhead when `getVariant()==='self'` (default render; self flow sets no `?v=` marketing variant).
- **C1 DECLARED IDENTITY (durable, first-party):** the self-flow data was written ONLY to ephemeral sessionStorage `selfIdentity` + the lead store → LOST on session end / no-pay. New `src/services/identityProfile.js` (`saveDeclaredIdentity`/`getDeclaredIdentity`, localStorage `myIdentityProfile`, merge non-empty). Written at declaration in `MyExposurePage.runSearch` + SERP `submitRefine` (self-gated on `getVariant()==='self'` so a normal search never captures the SEARCHED person). `/my-identity` (AccountPage) pre-fills `SelfIdentifyCard` via `prefill={getDeclaredIdentity()}` — surfaces what the user told us, ready to CONFIRM, NOT faked as a confirmed public record. This is DECLARED identity (user-typed) — distinct from BC RECORD data ([[feedback_bc_is_source_of_truth]] governs records, not self-input). v1 = single-device localStorage; cross-device later. See [[project_identity_management]] / [[project_modular_profile]] / [[feedback_honest_approach_flag]].

**Legal — right to reveal searcher identity CONFIRMED (owner 2026-08-03).** We have the right to reveal the searcher's identity to the searched-for person. Resolves the "reveal parked on privacy posture" open question → the built posture (free=masked tease, paid=full searcher names) is cleared, and the "Who's Looking For You" campaign payoff can promise the FULL identity reveal (paid), not just masked city/count teasers. TWO constraints still apply and are INDEPENDENT of this: (1) only REAL searchers — never fabricate an alert (FTC fined competitors $5.8M for fabricated/exaggerated notifications); (2) the AD CREATIVE must still follow Google's personalized-ads policy — the ad is a GENERAL offer ("find out who's looking for you"), it must NOT imply we know who searched THIS specific viewer. Product-can-reveal (yes) ≠ ad-can-claim-personal-knowledge (no). See [[project_marketing_angles]].
