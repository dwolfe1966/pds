---
name: Project session log (sprints + status snapshot through 2026-03-18)
description: Running log of completed sprints, fixed bugs, test baselines, backlog items, and known gaps from the Windows side. Predates the per-topic memory split — newer entries belong in dedicated project_*.md files.
type: project
---

# Project Memory — idlookup-app-updated

## Architecture
- React 18 SPA + Parcel 2, Express mock API (`server/`) + CORS proxy
- Hybrid API router: ByteCrtrs new API (forced for reports/billing/opt-out) with mock fallback
- ByteCrtrs library loaded as IIFE (`window.ApiWrapper`) in `public/index.html`
- `npm run dev` starts both servers (Parcel on :3000, Express on :3001)
- **PRODUCTION**: `/server` may not be deployed at all — production target is a pure React SPA talking only to ByteCrtrs API. See `memory/project_production_architecture.md`.

## ByteCrtrs API (see full reference: memory/bytecrtrs_api_reference.md)
- Login: `wrapper.api.auth.login({ username, password })` — maps `email→username` in apiRouter.js
- Search: requires `contextKey: window.ApiWrapper.contextKey.sale.<type>.teaser` ← currently missing
- createReport: requires `teaserInput: teaserResponse.getTeaserInput()` + `contextKey` ← currently missing
- OptOut: BC recommends `ApiWrapper.goPage('optOut', { newPage: true })` not our custom form
- New: `wrapper.api.billing.tokenSale()` for card updates, `wrapper.api.contact.create()` for contact

## Key File Locations
- API routing: `src/services/apiRouter.js`
- Response adapter: `src/services/apiAdapter.js`
- Report service: `src/services/reportService.js`
- Search context: `src/services/searchContext.js`
- Member report view: `src/pages/member/SearchResultDetailPage.js`
- Feature flags: `.env` (`REACT_APP_USE_NEW_API_*`)

## Report Data Pipeline (completed)
- `adaptReportDetailResponse()` in apiAdapter.js handles 3 ByteCrtrs response shapes
- Returns: `{ commerceContentId, identities, fullContact, familyWatchdog, raws, reportData }`
- `raws[0].transient.identities`, `raws[1].transient.fullContact`, `raws[2].transient.familyWatchdog.offenders`
- All report service functions now return the rich struct
- `SearchResultDetailPage` stores full result in state (`setReport(result)` not `setReport(result.reportData)`)
- `REACT_APP_USE_NEW_API_REPORTS=true` — report endpoints are also in FORCE_NEW_API_ENDPOINTS

## Phone Search (member)
- `MemberGeneralSearchPage` phone tab → `createReportForPhone(phone)` → `report/create` with `type: 'reversePhone'`
- Navigates directly to `/people/:commerceContentId` (no teaser step)

## Tests
- Jest 29 + jsdom, `npm test`
- `src/tests/apiAdapter.test.js` — 12 tests
- `src/tests/reportService.test.js` — 27 tests
- `src/tests/reportExtract.test.js` — 73 tests (extractAll, formatDateRange, fmtPhone, dedup)
- `src/tests/memberGeneralSearch.test.js` — 18 tests (name/email/phone submit handlers)
- `src/tests/apiCallSignatures.test.js` — 7 tests (api.post/api.put 2-arg regression guard)
- `src/tests/adminPageUnwrapping.test.js` — 11 tests (admin list page data?.data unwrapping)
- `src/tests/signupFlow.test.js` — signup flow: paid path, unpaid path, error handling, teaser block
- `src/tests/paymentFlow.test.js` — payment flow: auth guard, form fields, success/failure, skip path
- `src/tests/dashboardHome.test.js` — dashboard: metrics, loading, empty state, quick action navigation
- `src/tests/paidRoute.test.js` — 18 tests: loading guard, paid/unpaid redirect, subscription pending, route layering
- `src/tests/tokenRefresh.test.js` — 13 tests: 401 retry contract, refresh success/failure, no refreshToken, non-401 bypass, infinite loop guard
- `src/tests/trackingService.test.js` — 12 tests: fetch POST, payload shape, sessionId stability, fire-and-forget error swallowing, properties forwarding
- `src/tests/signupTransitions.test.js` — 31 tests: T1 signup (9), T2 payment (6), T3 login (6), T4 subscribe (5), ByteCrtrs contract (3). JWT-from-mock gap documented in test.
- **BASELINE: 215 passing / 241 total, 10 suites (2026-03-17). 26 pre-existing failures in paymentFlow, signupFlow, dashboardHome, memberGeneralSearch, apiCallSignatures — not caused by recent work.**
- Utility module: `src/utils/reportExtract.js` — extractAll, formatDateRange, fmtPhone, dedup

## Completed Features
- Name/phone/email teaser search (live, ByteCrtrs)
- Member phone search via reversePhone report (no teaser)
- Report creation + detail view with structured UI (FullContact, FamilyWatchdog, Identities)
- Payment via ByteCrtrs commerceBilling/sale
- Opt-out search status check
- All three search funnels (sales flow)

## Systemic Bugs Fixed (2026-03-14)
**Bug 1 — api.post/api.put wrong signature (8 files)**
- Called `api.post(path, body, { token })` → silently dropped body + token
- Correct: `api.post(path, { body, token })`
- Fixed: AlertsPage.js (x2), ProfilePage.js (x2), SettingsPage.js (x2), DataRemovalPage.js

**Bug 2 — Response unwrapping wrong keys (6 files)**
- Mock API returns `{ data: [...], pagination: {} }` but pages checked `data.results`, `data.users` etc.
- Correct first fallback: `data?.data ||`
- Fixed admin: UsersPage, SessionsPage, PurchasesPage, CsRepManagementPage, DataRemovalPage
- Fixed member: WhoIsSearchingPage (also fixed `searcherLocation` field name)
- NOTE: Sales search result pages use sessionStorage `{ results: [] }` — `data.results` is correct there

## Still Mock-Only
- Admin endpoints, ByteCrtrs auth (`REACT_APP_USE_NEW_API_AUTH=false`)
- Signup/profile/alerts/subscription: mock API fully implemented and seeded (no longer gaps)

## Completed Features (updated 2026-03-14)
- Email member search refactored to URL-param pattern (consistent with name search)
- Opt-out form pre-populated from report page (firstName/lastName/state/zip via URL params)
- Visitor signup flow: fully implemented in SignupPage (verified)
- Visitor payment flow: fully implemented in PaymentPage (verified)
- Mock seed data: phone + alerts added for known test users

## New Files Added This Session
- `src/components/ErrorBoundary.js` — class component, wraps Routes + SearchResultDetailPage
- `src/pages/NotFoundPage.js` — 404 page with context-aware "Go Home/Dashboard" button
- `src/utils/reportExtract.js` — extractAll, formatDateRange, fmtPhone, dedup (extracted from SearchResultDetailPage)
- `src/tests/reportExtract.test.js`, `memberGeneralSearch.test.js`, `apiCallSignatures.test.js`, `adminPageUnwrapping.test.js`

## Sprint 2026-03-15 — Member Experience Uplift (completed)
**Signup/Payment Fixes:**
- SignupPage: `successRedirectTo` state drives correct "Redirecting to dashboard/payment" message
- SignupPage: password min 8 chars validated client-side; dev server hint removed from error
- PaymentPage: billing first/last name pre-filled from `userInfo` on mount
- PaymentPage: "I'll upgrade later" skip button → navigates to `/dashboard` (unpaid path)
- PaymentPage: success message branches on `selectedPerson` presence

**Member Page Enhancements:**
- DashboardHome: "Complete Your Profile" yellow banner when user missing fullName/zip
- DashboardHome: richer empty state with icon + sub-text
- AccountPage: subscription status badge (Active/Inactive), upgrade CTA for no-plan users
- AccountPage: cancel confirmation modal replaces `window.confirm`
- AccountPage: "All reports loaded" note when pagination exhausted
- SettingsPage: password min 8 chars, notification preferences section (email/digest/marketing)
- ProfilePage: phone field, save success banner, avatar initials, member-since display
- AlertsPage: fixed `useEffect` token dependency bug (was running with null token)

**CSS Modules added (designer):**
- `AccountPage.module.css`, `SettingsPage.module.css`, `ProfilePage.module.css`, `AlertsPage.module.css`, `SignupPage.module.css`

## Sprint 2026-03-16 — Visitor Experience (completed)
**Subscription context (AuthContext.js):**
- Added `subscription` state auto-fetched on token change via `api.getSubscription()`
- Added `isPaid` boolean: `subscription.status === 'active' && subscription.plan`
- Added `refreshSubscription()` — called by PaymentPage after successful payment
- Subscription cleared on logout

**DashboardHome — subscription-aware:**
- Paid members: "Pro Member / Active" banner
- Unpaid members: "Free Account" banner + "Upgrade to Pro — $29.99/mo" button → /payment
- Unpaid members: "Upgrade to Pro" quick action also appears in Quick Actions panel

**Landing page variants (all publicly routed):**
- Name: /name/landing (V1) through /name/landing/v6
- Phone: /phone/landing (V1) + /phone/landing/v2 through /phone/landing/v6
  - V2: Reverse Lookup, V3: Who Called Me, V4: Find Lost Contact, V5: Business Lookup, V6: Dating Safety
- Email: /email/landing (V1) + /email/landing/v2 through /email/landing/v6
  - V2: Email Lookup, V3: Unknown Sender, V4: Find Lost Contact, V5: Business Email, V6: Dating Safety
- All stepped variants (V2-V6) share NameSearchLandingV3Page.module.css

**Multi-step signup variant:**
- Route: /signup/v2 (SignupPageStepped.js + SignupPageStepped.module.css)
- 4 steps: Intent+Email → Password (with strength meter) → Name+ZIP → Consent+Submit
- Calls api.billingSignup() (ByteCrtrs) in parallel on final submit (same as /signup)
- Redirects to /payment if ?selected= present, else /dashboard

**Designer UX Research:**
- Full competitor analysis saved to memory/project_funnel_ux_research.md
- Key findings: lock/blur teaser pattern, "Most Likely Match" badge, sticky bottom CTA on mobile, remove nav from teaser+signup pages, progress context across all funnel pages

## Sprint 2026-03-17 — Conversion Funnel Uplift (completed)
- **PaidRoute** (`src/pages/PaidRoute.js`) guards `/people/:id` — redirects unpaid users to `/payment?upgrade=1`
- **Token refresh**: 401 → POST `/auth/refresh` → retry once → else logout; `setLogoutHandler` in apiRouter.js
- **ProtectedRoute** now passes `?redirect=` to `/login`; LoginPage consumes it after successful login
- **AuthContext.login()**: removed internal `navigate('/dashboard')` — LoginPage now owns redirect
- **502 fix**: removed `teaser-search` from `FORCE_NEW_API_ENDPOINTS` so it falls back to mock on ByteCrtrs errors
- **Search limit**: `perPage: 10` in apiRouter.js teaser-search case (revert to delete if ByteCrtrs returns malformed data)
- **Loader scanning animation**: `LoaderPage.module.css` (new), all 3 loader pages updated with phase cycling + indeterminate progress bar
- **Teaser page additions**: "recently viewed" italic note + mid-page amber CTA block
- **Playwright**: 35/35 passing. Fixed: placeholder case mismatches, disabled-button click, broken assertion chain, ByteCrtrs IIFE blocked via `page.route()` + `page.addInitScript()` stub injected in `02-member-search.spec.js` and `03-report-flow.spec.js`. No app source modified.

## Sprint 2026-03-17 — Tracking & Analytics (completed)
- **`src/services/trackingService.js`** — fire-and-forget `track(eventName, props)` POST to `/api/v1/admin/events`; sessionId via sessionStorage
- **Server event store**: `let eventLog = []` in server/index.js; POST (no auth), GET events (admin), GET events/summary (admin) with funnel + daily aggregation
- **Tracking wired**: `search_submit` in all 3 loader pages, `teaser_view` in SearchDetailPreviewPage, `signup_complete` in SignupPage, `payment_complete` in PaymentPage
- **AnalyticsPage**: Recharts BarChart (funnel steps) + LineChart (daily events); fetches from `/admin/events/summary`
- **Skeleton component**: `src/components/Skeleton.js` + `Skeleton.module.css` — CSS shimmer pulse; variants: text/textShort/title/avatar/card/button
- **Skeletons applied**: DashboardHome, AccountPage, AlertsPage (replaced spinners)
- **Test baseline**: 184 passing / 210 total; `src/tests/trackingService.test.js` (12 tests)

## Sprint 2026-03-17 — Email Platform MVP (completed)
- **`server/emailService.js`** — SendGrid transport (if `SENDGRID_API_KEY` set) or console.log fallback; exports `sendWelcome`, `sendPaymentConfirmation`, `sendAlertDigest`, `sendBroadcast`, `emailLog[]`
- **`server/templates/email.js`** — inline-HTML templates: `welcomeEmail`, `paymentConfirmationEmail`, `alertDigestEmail`, `broadcastEmail`
- **server/index.js** — 5 edits: require emailService, `sendWelcome` on signup, `sendPaymentConfirmation` on subscription activate, fixed `POST /api/v1/notifications` (was missing), `GET/POST /api/v1/admin/email-log` + `/admin/email-broadcast`
- **`src/pages/admin/EmailBroadcastPage.js`** + `EmailBroadcastPage.module.css` — compose form (subject/body/audience), send button, email log table; wired to api.getEmailLog + api.sendEmailBroadcast
- **`src/App.js`** — added `/admin/email` route; **`src/components/AdminNav.js`** — added Email nav link
- **`src/api.js`** — added `getEmailLog()`, `sendEmailBroadcast()`, pathMap entries `admin/email-log` + `admin/email-broadcast`
- **Tests**: `src/tests/emailBroadcastPage.test.js` (10 tests), `src/tests/notificationPreferences.test.js` (7 tests)
- To activate SendGrid: set `SENDGRID_API_KEY` + `EMAIL_FROM` in `.env`; run `npm run install-server` after adding `@sendgrid/mail` + `nodemailer` to `server/package.json`

## Sprint 2026-03-18 — Tracking API + Analytics Foundation (completed)
- **`tracking-api/`** — standalone Express service (port 3002), NDJSON file store (`events.ndjson`), zero native deps
- Endpoints: `POST /track` (no auth), `GET /events` (admin key), `GET /events/summary` (admin key)
- Summary returns: funnel counts, daily 14-day, KPI conversion rates, top events, landing variant breakdown
- **`trackingService.js`** — now targets `REACT_APP_TRACKING_API_URL/track` (default: `http://localhost:3002/track`)
- **`.env`** — added `REACT_APP_TRACKING_API_URL`, `REACT_APP_TRACKING_ADMIN_KEY`
- **`package.json`** — added `tracking` script, `install-tracking` script, updated `dev` to run all 3 servers
- **New events wired**: `results_view` (SearchResultsPage), `signup_start` (SignupPage), `payment_start` (PaymentPage), `report_view` (SearchResultDetailPage), `landing_view` (NameSearchLandingPage v1 — pattern for others)
- **AnalyticsPage** — fully redesigned: KPI cards, step conversion rate grid, funnel bar chart (all 9 steps), daily line chart, variant table, top events table; fetches from `REACT_APP_TRACKING_API_URL`
- **Tracking event taxonomy** (all 9 funnel steps): `landing_view`, `search_submit`, `results_view`, `teaser_view`, `signup_start`, `signup_complete`, `payment_start`, `payment_complete`, `report_view`
- **Still missing `landing_view`**: PhoneSearchLandingPage, EmailLandingPage, all V2-V6 variants — Analyst backlog

## Large Backlog Items
- **BACKLOG-1 — Outbound Email Platform** *(MVP shipped 2026-03-17)*: Core wired. Remaining: SendGrid production config, scheduled weekly digest job, email open/click tracking, unsubscribe link handler.
- **BACKLOG-2 — Reporting / Tracking / Visualization** *(MVP shipped 2026-03-17)*: Event tracking, in-memory store, AnalyticsPage Recharts charts. Remaining: persistent storage, A/B variant tagging, phone/email funnel events, landing variant click tracking.
- **BACKLOG-3 — Tracking Platform (server-agnostic)**: Event tracking that does NOT assume /server exists. Options: Segment, Mixpanel, or a serverless ingest function. Also includes admin reporting/visualization against that data.
- **BACKLOG-4 — Admin App (ByteCrtrs API)**: ByteCrtrs has admin API endpoints. All admin pages are currently mocked. Migrate admin to real ByteCrtrs API calls.
- **BACKLOG-5 — Member Experience Refinement**: Dashboard, search UX, profile, "Who's Searching For You" (WSFY) improvements.

## Known Remaining Gaps
- Opt-out email handler (ByteCrtrs optOut.request flow not fully wired)
- CI/CD pipeline not configured
- ByteCrtrs auth still mock-only
- Toast notification system (inline state only)
- ByteCrtrs search limit: `perPage: 10` set — monitor for malformed responses, revert to delete if needed
- 26 pre-existing Jest failures (paymentFlow, signupFlow, dashboardHome, memberGeneralSearch, apiCallSignatures) — needs dedicated cleanup sprint
- BACKLOG-2 remaining: persistent event storage, A/B variant tagging, phone/email funnel tracking extension

## Sprint 2026-03-16 — Payment Page Redesign (completed)
- Full redesign: two-column layout (form + sticky order summary), mobile single-column
- Person preview banner when selectedPerson available
- Real-time card validation: type detection (Visa/MC/Amex/Discover pill), Luhn check, ✓/✗ field indicators
- Collapsible billing address (default: hidden, "uses address on file")
- CTA text: "Unlock Report — $29.99/mo" / "Subscribe Now — $29.99/mo"
- Reassurance copy: "No lock-in. Cancel anytime." prominently shown
- Order summary: plan features checklist, gradient header, FCRA trust block
- Error box: icon + specific title + retry guidance
- ByteCrtrs billingSale call unchanged and confirmed correct (FORCE_NEW_API)
- Designer research saved: memory/project_payment_ux_research.md

## Team
- Five agents: Lead, Developer, Tester, Designer, Analyst/Report Developer. See `memory/team_roles.md`.
- Architecture decisions (tracking API, email, deployment): `memory/project_architecture_decisions.md`

## Admin App (separate deployable React app — BACKLOG-4)
- BC Admin API spec saved to: `memory/bc_admin_api_reference.md`
- Admin design HTML files: `docs/admin designs/` (v1 + v2 variants for each page)
- Design pages: customers, orders, payments, user-management, manage-notes, opt-user, opt-phone, communications, content, emails, logs, tracking, mail-sent, offers-products, permissions, timesheets, unsubscribe, ux-management, uxc-history
- Uses `csrWrapper` (separate IIFE from consumer `window.ApiWrapper`) — need csrWrapper IIFE file to start build
- BC Admin API covers: auth, user CRUD, admin notes, orders, payments, refunds, opt-outs, contacts

## Consumer BC Integration — Maxed Out
- Consumer `window.ApiWrapper` IIFE only exposes: auth, idLookup, optOut, billing
- GREP of IIFE confirms no profile/subscription/alerts/password-change methods
- profile, subscription, alerts, notifications, change-password → remain mock until BC expands consumer IIFE
- All wireable endpoints are now wired: login, logout, signup, search, reports, billing, opt-out

## Docs
- `docs/PROJECT_STATUS_ANALYSIS.md` — rewritten 2026-03-15, accurate current state
- `docs/REPORT_IMPLEMENTATION.md` — report pipeline implementation details
- `docs/SPRINT_PLAN.md` — sprint 2026-03-15 plan with full gap analysis
