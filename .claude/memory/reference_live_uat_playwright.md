---
name: live-uat-via-playwright-real-browser-galaxy-s5
description: "How to drive the live consumer + CSR apps with Playwright for real verification — device emulation, the BC captcha wall, and the serve-admin-prod Forbidden workaround."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2a7937d0-2c0b-462e-b57c-c5bc0b3fde3f
---

We CAN do real-browser UAT, not just code inspection. Playwright 1.58 + Chromium
are installed; `devices['Galaxy S5']` exists (the device most bugs are filed on).
Write a throwaway script under `scripts/` (must run from repo root for module
resolution), drive the app, read rendered DOM, intercept network, screenshot.

**Genuine walls (don't fight them, design around):**
- **BC "Input Password" captcha gates EVERY search** (anonymous AND authenticated
  member) on dev — confirmed dev-only by owner. So SRP/report flows can't be
  auto-completed from a search. To exercise a member report, open an EXISTING
  report from the dashboard library (no new search → no captcha).
- **serve-admin-prod (localhost:3004) returns "Forbidden resource"** on
  CSR-protected fetches (e.g. getUserOrder) — the session cookie isn't forwarded
  cross-origin to BC. Workaround: capture the real JSON from the REAL host
  (dev.admin.www.bytecrtrs.com) first, then `page.route(/getUserOrder/, r =>
  r.fulfill({ body: JSON.stringify({order}) }))` against the local build to verify
  rendering. Login itself works on serve-admin-prod; only protected API fetches 404.
- Credentials (member + CSR) are passed via ENV VARS to the scripts, NEVER hardcoded
  or written to memory (memory is committed to git; the CSR password contains the
  forbidden `bcEdgeApiPass` secret — see [[feedback_no_secrets_in_bundle]]).

**Local hosts:** consumer `node scripts/serve-prod.js` → :3000 (proxies /api →
dev.www.idlookup.ai); admin `node scripts/serve-admin-prod.js` → :3004/csr/ (proxies
→ dev.admin.www.bytecrtrs.com). See [[reference_local_prod_bundle_test]].

**Open a member report by CLICKING the library link, NOT page.goto(/people/:id)**
(learned 2026-06-08): a full navigation to `/people/:id` re-boots the SPA and the
narrow paywall ([[feedback_narrow_paywall]]) redirects to `/dashboard` before
`getOrders()` re-hydrates paid status — so goto silently lands you on the dashboard
and you read THAT as the "report" (all fields false). Clicking the dashboard link is
in-app nav with auth already hydrated → report renders. `scripts/live-smoke-0608.js`
does this. Creds load from gitignored `scripts/.smoke.env` (loader strips quotes incl.
smart quotes). Also: pass creds with STRAIGHT quotes — smart quotes ‘’ aren't shell
quoting and get baked into the value, breaking login.

**VERIFIED LIVE 2026-06-08** (consumer 772bfb29 / admin eff24bd1): report-parity
renders on the live O.J. report (test21 owns it) — county/zip4/ownership/residence-
duration/18 map links/assessed value/beds-baths/hair-eyes/Description line/liens all
present; mugshot empty (expected — BC photo field empty, open BC ask). CSR user-detail:
all 7 tabs present, Searches/Reports/Logins populate (8/3/18 rows — the fixed bug),
Notes & Messages both render. One thing NOT surfaced on the default user-detail view:
the "Collected" sum label (lives in the order drill-down, not top-level) — worth a
manual confirm but not a regression.

**Tracking verification:** intercept `*/tracking/create` and read `postDataJSON().refer`
to confirm `data.refer` attribution emits. NOTE: the first cold event needs the page
to actually CALL track — landing_view only fires where `useLandingTrack` is wired
(was missing on HomePage; that was the real #63 cause, not a warmth race).
