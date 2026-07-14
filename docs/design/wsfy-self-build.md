# WSFY ("Who's Searching For You") — self-build

BC exposes no inbound-activity finder (it's a long-standing BC consumer-feature ask, mock/
coming-soon). So we build WSFY ourselves on the idlookup.me growth backend (Vercel + Neon),
independent of BC — same pattern as leads/email. The consumer `/who-is-searching` member page
already exists as a finished "coming soon" sample; it plugs into this data later.

## Idea
Every search the consumer runs (sent to BC, results returned) is also copied to our own store:
(1) the searcher + terms + time, and (2) the result set with as much per-person detail as
possible. WSFY = the reverse join: "find searches whose terms OR results match this subscriber."

## Phase 1 — ingest (SHIPPED 2026-07-13, bundle public.b62e03de.js)
Corpus-building only; nothing user-facing changes. Start logging now so there's history to show
when the reveal ships.
- **Capture point:** `api.searchPeople` (single choke point for name/phone/email across sales
  teaser + member), fired AFTER the response returns, beside the existing `recordSearchToHistory`
  block — the fragile search REQUEST path is untouched.
- **Client:** `src/services/searchActivity.js` `captureSearchActivity()` — resolves searcher
  (member `userId` | stable anon `sa_anon_id` session), trims heavy BC raw blobs, fire-and-forget
  POST. Fires for anonymous funnel searches AND members. PII stays server-side, never the dataLayer.
- **Endpoint:** `seo/app/api/search-activity/route.js` (POST, CORS, cap 50 results, no-op w/o DB).
- **DB:** `seo/lib/search-activity-db.mjs` `insertSearchActivity()`; tables `search_activity` +
  `search_results` (`seo/db/search-activity-schema.sql`, applied to Neon). Match keys = normalized
  name + city + state (never extId — it's ephemeral). Result rows inserted via jsonb_to_recordset.
- URL derives from `REACT_APP_LEAD_CAPTURE_URL` (`/leads`→`/search-activity`); no new env.
- **Pending owner:** upload `public.b62e03de.js` to BC to start real capture in prod.

## Phase 2 — reverse-join + tiered reveal (SHIPPED 2026-07-14, bundle public.03ee67a5.js)
Reveal posture (owner 2026-07-13): **free members = obfuscated tease (conversion bait), paid =
full detail.** Masking is SERVER-SIDE — real searcher names never reach a free client.

- **Capture enhancement:** `searchActivity.js` now also captures the SEARCHER's own name/location
  when they're a signed-in member (→ `search_activity.searcher_name/_norm/_first/_city/_state`,
  applied to Neon). That's what lets WSFY name a searcher. Anon searchers = session id only.
- **Engine:** `seo/lib/wsfy.mjs` `buildWsfySummary(identity,{tier})` — reverse-join, aggregates per
  distinct searcher, returns `{count, teaseSummary:{headline,lines}, events[]}`.
- **Fuzzy matching (owner 2026-07-14):** we only reliably know a user's first + last name, so a search
  counts when it has the **EXACT last name + a FUZZY first name**. Exact-last is enforced in SQL
  (`term_last`, indexed via `idx_sa_term_last`); `fuzzyFirst()` filters the first name in JS — exact,
  nickname-prefix (Dave/David, Chris/Christopher), or small typo distance (Jon/John, Sara/Sarah, ≤1–2
  Levenshtein). Result-set matches (subject appeared in someone's results, exact full name) still count.
  Verified: Dave/Davld/Davey Davis match; John Davis (wrong first) + David Davies (wrong last) don't.
  FREE = masked names (`T••••• A•••••`), coarse location, tease line; PAID = full.
- **Endpoint:** `seo/app/api/wsfy/route.js` (POST). URL derives from `REACT_APP_LEAD_CAPTURE_URL`.
- **Page:** `WhoIsSearchingPage` fetches real data, renders the tease banner ("N people are
  searching for you: 2 in Los Angeles, Carol King…"), server-tiered rows, charts from real data.
  Viewers tab = honest empty (profile-open tracking not captured yet).
- Verified end-to-end vs live Neon: self-exclusion, result-match, masking, proof name, both tiers.

**Two open items (not blocking the tease, but before wide launch):**
1. **AUTH hardening (the important one):** `tier` is currently client-asserted — a crafted request
   could assert `paid` and get the detail (searcher names), i.e. bypass the paywall. FIX: validate
   the caller's BC token server-side (identity + paid status) and derive `tier` from that, not the
   body. Flagged in `seo/app/api/wsfy/route.js`.
2. **Opt-out suppression:** `isSuppressed()` in wsfy.mjs is a stub — wire it to the IDI/index
   opt-out list. Also add a retention window on stored result-set PII (30–90 day rolling).

**Richer affinity descriptors** (your "went to your high school", "just got married") are NOT built:
the licensed BC/IDI person data has employment/relatives/property/criminal but **no education or
marital-status field** (checked BC_REPORT_FIELD_MAP). We ship the sourceable subset (count, location,
one proof name) and never fabricate. Employer/relative-overlap affinities ARE sourceable and are a
natural Phase 2b enrichment (resolve+enrich each searcher, compute overlap vs the subscriber).

## Phase 3 — "someone searched for you" alert emails
Reuses the SendGrid platform (see docs/design/growth-email.md). Strong retention hook.
