---
name: Active backlog and known gaps
description: Forward-looking work — the five BACKLOG-X tracks plus known gaps not tied to a specific track. Captures intent and the most recent verified state; check code/git when acting.
type: project
---

Five named tracks the team plans against. Numbers are referenced in commits/PRs.

**BACKLOG-1 — Outbound Email Platform.** `server/emailService.js` wired with SendGrid + SES + SMTP + console fallback. Unsubscribe handler lives at `/admin/unsubscribe`. **Gap:** `EmailBroadcastPage.js` exists but is orphaned — the `/admin/email` route and nav link were removed in commit `2a9f31b`, so there is no UI entry to send broadcasts. `sendAlertDigest` is exported but never scheduled. No open/click tracking pixels in templates.

**BACKLOG-2 — Reporting / Tracking / Visualization.** `tracking-api/` is operational. **Storage migrated from NDJSON to SQLite** (`tracking-api/db.js`); the migration runs on boot. `landing_view` is now fired on every variant via `src/hooks/useLandingTrack.js` (Phone V6, Email V5, Name V2–V6). A/B variant tagging is sent in event properties. AnalyticsPage queries `/events/summary`. **Remaining:** retention policy / archival, dashboards beyond AnalyticsPage, alerting on funnel regressions.

**BACKLOG-3 — Tracking Platform (server-agnostic).** Only GTM → GA4 (`src/services/gtm.js`, `REACT_APP_GTM_ID=GTM-WV7N6WWP` in `.env.production`) is wired. No Segment / Mixpanel / PostHog. `cloudflare-worker.js` exists but is an API/CORS proxy, not an event ingest. Track is open if production drops `/server` and `/tracking-api`.

**BACKLOG-4 — Admin App (ByteCrtrs API).** Admin app builds via `scripts/build-admin.js` → `build-admin/`. `public/admin.html` loads the BC `csrWrapper` IIFE. Many CSR endpoints are wired in `src/services/apiWrapper.js`. The production-CSR-403 issue (commit `cddbcec` instrumented it) is **resolved**; the `[admin-auth-debug]` logging has been removed. Active focus has shifted to nav cleanup across the admin/CSR app.

**BACKLOG-5 — Member Experience Refinement.** Dashboard2 is the canonical `/dashboard` (commit `3108599`); old `DashboardHome` is orphaned but not deleted. WSFY page (`WhoIsSearchingPage.js`) is wired. AlertsPage redesigned as a search entry surface, not a fake-feed list. Visitor searches now persist across signup (`visitorSearchLog.js` → `POST /searches/import`). Active focus: building out the consumer-app test suite and cleaning up consumer nav.

## Known gaps (not tied to a single track)

- **CI/CD:** No `.github/workflows/`. `vercel.json` is deploy-config only.
- **Toast notifications:** Still inline `useState + setTimeout` patterns (e.g., `NotesPage.js`). No shared toast component / context.
- **`perPage: 5`** in `apiRouter.js` for history endpoints — verify BC handles >5 cleanly before raising.
- **Pre-existing Jest failures:** Last logged baseline was 26 failures (paymentFlow / signupFlow / dashboardHome / memberGeneralSearch / apiCallSignatures) as of 2026-03-17. Run `npm test` for current count before planning a cleanup sprint — the number may have moved.
- **`REACT_APP_USE_NEW_API_AUTH=true`** in `.env.production`. Consumer auth is now on BC; the mock-only auth note from older memories is stale.
