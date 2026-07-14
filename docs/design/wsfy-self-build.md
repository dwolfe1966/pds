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

## Phase 2 — reverse-join + reveal (PARKED on privacy posture)
Query: for a subscriber (their name + city/state, and their claimed profile), find matching
`search_activity` (term-match) and `search_results` (result-match) rows → tease on the existing
`WhoIsSearchingPage`. Behind the IDI/index opt-out suppression list.

**Two decisions to settle before building Phase 2:**
1. **Capture anonymous funnel searches?** — decided YES in Phase 1 (bulk of volume; searcher shown
   as region only). Revisit only if privacy posture changes.
2. **Reveal posture** — the real open question. Options:
   - **Aggregate/teased only** (recommended, MyLife-safe): "3 people searched for you this month,
     one near Dallas." Store more than we show; never expose exact searcher identity.
   - Show searcher detail to paid members (higher risk — stalking/safety, FTC exposure).

**Guardrails (non-negotiable for Phase 2):**
- Don't reveal searcher identity; tease/aggregate (region, count, timeframe).
- Honor the IDI/index opt-out suppression list.
- Retention window on stored result-set PII (third-party PII liability) — e.g. 30–90 day rolling.
- Keep non-FCRA framing; don't let WSFY become a stalking-confirmation tool.

## Phase 3 — "someone searched for you" alert emails
Reuses the SendGrid platform (see docs/design/growth-email.md). Strong retention hook.
