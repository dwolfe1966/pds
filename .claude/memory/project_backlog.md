---
name: Active backlog and known gaps
description: Forward-looking work — the five BACKLOG-X tracks plus known gaps not tied to a specific track. Captures intent and the most recent verified state; check code/git when acting.
type: project
originSessionId: ed6a1fb6-9daf-4f36-a40e-b2ed117467bc
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
- **Jest baseline (2026-05-04):** 0 failures, 225 passing, 56 skipped across 14 suites. Two fully-skipped suites remain — both depend on `hooks/useSignup`:
  - **signupFlow** — all 13 fail. Form reduced to email+password+optin (no fullName/zip), logic moved into `hooks/useSignup` which pulls in `gtm`, `loginHistory`, `visitorSearchLog`, `api.createTracking`, `api.post('/searches/import')` — none mocked. Real rewrite. Pair with signupTransitions T1.
  - **signupTransitions** — T1 surfaces the same `useSignup` drift; T2/T4 cover PaymentPage but use the new "You're in!" / click-through model now exercised in paymentFlow.test.js, so those should be partially salvageable; T5 (apiRouter unit) is closest to current reality.
- apiCallSignatures has one inline skip: `member/SettingsPage — handlePrivacyToggle`.
- The earlier 26-failure baseline (2026-03-17) was resolved by skipping rather than fixing. Three suites revived this session: **adminPageUnwrapping** (commit `6919afd`, +7 tests), **memberGeneralSearch** (commit `dbafe68`, +18 tests), **paymentFlow** (+15 tests — copy drift + new click-through success model captured as positive assertion).
- **Side note (resolved 2026-05-07):** `MemberGeneralSearchPage.js` `COMMON_US_CITIES` Orlando, FL duplicate is gone — only one entry now (line 22).
- **Recommended next investment:** signupFlow + signupTransitions as a paired rewrite. Reuse the `useSignup` mock surface across both files.
- **`REACT_APP_USE_NEW_API_AUTH=true`** in `.env.production`. Consumer auth is now on BC; the mock-only auth note from older memories is stale.
