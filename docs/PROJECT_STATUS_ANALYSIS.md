# IDLookup.AI — Project Status Analysis

**Updated:** March 17, 2026
**Source:** Full codebase audit — Sprints 2026-03-15, 2026-03-16, 2026-03-17

**Current Sprint:** 2026-03-17 — Conversion Funnel Uplift (completed)

---

## I. Completed Use-Cases

### Infrastructure & Architecture
- **Mock API server** — Full Express.js server (`server/`) with JWT auth, in-memory data store, seed data (22 users, 100 people records, 200 search history entries, alerts, notifications, data-removal requests, CS reps), and all endpoints implemented.
- **Hybrid API routing layer** — `src/services/apiRouter.js` routes each endpoint to ByteCrtrs API or mock API based on feature flags, with automatic fallback. Report, billing, and opt-out endpoints are force-routed to ByteCrtrs.
- **CORS proxy** — Express proxy at `/api/proxy/*` forwards ByteCrtrs requests server-side. Handles cookie storage and 412 → captcha → retry flow.
- **ByteCrtrs API wrapper** — `src/services/apiWrapper.js` wraps `window.ApiWrapper` IIFE library.
- **Response adapter** — `src/services/apiAdapter.js` transforms ByteCrtrs responses into application format. Includes `adaptTeaserResponse`, `adaptReportDetailResponse`, `adaptReportResponse`, `adaptReportListResponse`.
- **Report data extraction** — `src/utils/reportExtract.js` extracts 10 structured sections from report data (personal info, addresses, phones, emails, associates, employment, education, social media, family watchdog offenders, full identity list).
- **Search context manager** — `src/services/searchContext.js` persists `searchContextKey`, `teaserInput`, `provider`, and `commerceContentId` in sessionStorage.
- **Authentication context** — `src/context/AuthContext.js` manages JWT lifecycle, persists to `localStorage`, injects token into API calls.
- **Protected routes** — `ProtectedRoute` guards member routes (redirects to `/login` if unauthenticated) and admin routes (redirects to `/` if not admin role).
- **Error boundary** — `src/components/ErrorBoundary.js` wraps all routes; additional page-level boundary on `SearchResultDetailPage`. Renders friendly fallback UI with "Try Again" and "Go to Dashboard" buttons.
- **404 page** — `src/pages/NotFoundPage.js` with context-aware navigation (dashboard for members, home for visitors). Wired as catch-all route.

### Search (Teaser) — All Live via ByteCrtrs
- **Name search flow** — Landing → loader → results → detail preview → signup → payment. V2/V3 variants built.
- **Phone search flow** — `/phone/landing` → `/phone/loader` → `/phone/search-result`. Legacy routes retained.
- **Email search flow** — `/email/landing` → `/email/loader` → `/email/search-result`.
- **General/combined search** — `/search/all` with tabs for name, phone, email.
- **Member search** — `/people-search` (name, phone, email tabs) and `/people-results`. Email search uses URL-param pattern consistent with name search. Phone search creates report directly (reversePhone, no teaser step).
- **Search pagination** — `api.loadMoreSearchResults()` with `rawResponse.getMore()` / `hasMore()`.

### Report Creation & Viewing — Live via ByteCrtrs
- **Report creation** — `src/services/reportService.js` creates reports via `POST /idLookup/report/create`, caches in sessionStorage.
- **Report detail view** — `SearchResultDetailPage.js` fetches via `GET /idLookup/report/detail/:id`, renders 10 structured sections using `extractAll()`: personal info, addresses, phones, emails, associates, employment, education, social media, family watchdog, full identity list.
- **Report list** — `getReportList()` fetches via `GET /idLookup/report/list`. Displayed on Account page and Dashboard.
- **`REACT_APP_USE_NEW_API_REPORTS=true`** — Report endpoints are force-routed to ByteCrtrs (never fall back to mock).

### Sales & Conversion Funnel
- **Signup page** — `/signup` and `/name/signup` with person teaser pre-populated from search result. Creates user via mock API, auto-logs in, redirects to payment.
- **Payment page** — `/payment` wired to `api.billingSale()` (ByteCrtrs `commerceBilling/sale`) with mock `updateSubscription` fallback. Redirects to dashboard on success.
- **Login page** — `/login` with AuthContext integration.
- **Opt-out flow** — `/opt-out` → `/opt-out-results` → `/opt-out/request`. Opt-out form pre-populates from URL params when navigating from a report page (firstName, lastName, state, zip).

### Member Pages — All Working
- **Dashboard** — Activity metrics (searches, alerts, profile views, reports), recent activity feed, quick actions, feature highlights.
- **Profile** — View/edit profile fields via `PUT /me`.
- **Search history** — Lists past searches from `/searches/me`.
- **Who Is Searching** — Shows profile view events.
- **Alerts** — Full CRUD (create, list, delete) via `/alerts`.
- **Account** — Subscription display, cancel subscription, report list with pagination.
- **Settings** — Password change via `/auth/change-password`, privacy toggle via `/privacy`.

### Admin Pages — All Working
- **Users** — List all users, link to detail. Search/filter support.
- **User Detail** — View user profile, subscription, search history, sessions. Suspend/reactivate.
- **Sessions** — List all sessions with user email, IP, timestamps.
- **Purchases** — List subscriptions with user email, amount, status. Link to detail.
- **Purchase Detail** — View subscription details with invoices. Refund support.
- **Data Removal** — List requests with approve/reject actions.
- **Analytics** — Aggregated metrics (total users, active users, searches, conversions, revenue, churn, new users).
- **CS Rep Management** — List CS reps with CRUD operations.

### Legal / Static Pages
- Privacy, Terms, Refund, CPCC, Partner, Suppression List, About, Contact, Add-on pages.

### Design System
- JS token object (`src/styles/designSystem.js`), CSS variables (`src/styles/variables.css`), CSS Modules for component-scoped styles.

---

## II. Systemic Bugs Found & Fixed

### Bug Class 1 — `api.post`/`api.put` 3-Argument Signature
Multiple pages called `api.post(path, bodyData, { token })` with 3 arguments. Since `handlePost(path, options)` only accepts 2 arguments, the third `{ token }` was silently dropped — requests sent without auth token and without body data.

**Correct form:** `api.post(path, { body: bodyData, token })`

**Files fixed (7):** AlertsPage.js, ProfilePage.js, SettingsPage.js (member and top-level duplicates), DataRemovalPage.js.

### Bug Class 2 — Response Unwrapping Wrong Keys
Mock API returns `{ data: [...], pagination: {} }` but pages checked for `data.results`, `data.users`, `data.sessions`, etc. — none matched, so every list page rendered empty arrays.

**Fix:** Added `data?.data ||` as first fallback in the unwrapping chain.

**Files fixed (6):** UsersPage, SessionsPage, PurchasesPage, CsRepManagementPage, DataRemovalPage (admin), WhoIsSearchingPage (member).

### Bug Class 3 — Field Name Mismatches
Pages rendered field names that didn't match mock API responses.

**Fixes:**
- SessionsPage: `s.startedAt` → `s.createdAt || s.startedAt`
- DataRemovalPage: `r.date` → `r.requestedAt || r.date`
- WhoIsSearchingPage: `ev.location` → `ev.searcherLocation || ev.location`

---

## III. Test Suite

**Framework:** Jest 29 + jsdom

**148 tests passing across 6 test files:**

| File | Tests | Coverage |
|------|-------|----------|
| `src/tests/apiAdapter.test.js` | 12 | Response adapter transformations |
| `src/tests/reportService.test.js` | 26 | Report create/get/list service |
| `src/tests/reportExtract.test.js` | ~30 | `extractAll()` 10-section extraction |
| `src/tests/memberGeneralSearch.test.js` | ~25 | Email/name search handlers |
| `src/tests/apiCallSignatures.test.js` | ~30 | api.post/api.put correct signatures across all pages |
| `src/tests/adminPageUnwrapping.test.js` | ~25 | Admin page response unwrapping (data?.data pattern) |

**E2E tests (Playwright):** 35 tests across 5 spec files. **25 passing, 10 failing.** No import issues — Playwright is fully operational. Failing tests are all pre-existing behavior gaps (see Section VI).

---

## IV. New Files Added This Session

| File | Purpose |
|------|---------|
| `src/components/ErrorBoundary.js` | React error boundary with friendly fallback UI |
| `src/pages/NotFoundPage.js` | 404 page with context-aware navigation |
| `src/utils/reportExtract.js` | Extract 10 structured sections from report data |
| `src/tests/apiAdapter.test.js` | Tests for response adapter |
| `src/tests/reportService.test.js` | Tests for report service |
| `src/tests/reportExtract.test.js` | Tests for report extraction |
| `src/tests/memberGeneralSearch.test.js` | Tests for member search page |
| `src/tests/apiCallSignatures.test.js` | Tests for API call signatures |
| `src/tests/adminPageUnwrapping.test.js` | Tests for admin page response unwrapping |
| `docs/REPORT_IMPLEMENTATION.md` | Report pipeline implementation details |

---

## V. What Remains Mock-Only

| Feature | Reason |
|---------|--------|
| **Signup** | ByteCrtrs API does not expose a signup endpoint |
| **ByteCrtrs auth (login/logout)** | `REACT_APP_USE_NEW_API_AUTH=false` — ready to flip but untested |
| **Profile management (GET/PUT /me)** | Not in ByteCrtrs API |
| **Alerts, notifications** | Not in ByteCrtrs API |
| **Subscription management** | Not in ByteCrtrs API |
| **Admin endpoints** | Not in ByteCrtrs API |
| **Search history recording** | Not in ByteCrtrs API |

---

## VI. Remaining Gaps

| Gap | Effort | Notes |
|-----|--------|-------|
| **Opt-out email confirmation handler** | Low | `ApiWrapperQueryHandler.getHandler()` not wired into App.js |
| **Toast notification system** | Medium | No shared toast component; actions use inline state |
| **Loading skeletons** | Low | CSS pulse animations not yet implemented (spinners only) |
| **Form validation** | Medium | Minimal client-side validation, no field-level API error display |
| **LoginPage redirect-if-logged-in** | Low | Logged-in users visiting /login are not redirected to /dashboard |
| **ByteCrtrs auth** | Medium | `REACT_APP_USE_NEW_API_AUTH=false` — ready to flip but untested |
| **CI/CD pipeline** | Medium | No GitHub Actions / deployment automation |
| **Unpaid member guard broadening** | Low | Currently only `/people/:id` is gated; `/alerts` could be added later |
| **ByteCrtrs search limit** | Unknown | `perPage: 10` set but ByteCrtrs may cap at 5 — monitor for malformed responses |

### Playwright E2E — 10 Failing Tests (all pre-existing)
| Test | Failure reason |
|------|---------------|
| Login — logged-in user redirected from /login | LoginPage has no redirect-if-already-authenticated logic |
| Member search tests (6) | Test setup doesn't inject auth token before navigating to `/people-search` |
| Report flow tests (3) | ByteCrtrs API unavailable in CI/test environment; requests timeout |

---

## VII. Architectural Decisions

1. **Static React SPA + Separate Express Server** — Parcel 2 builds static assets; Express serves mock API and CORS proxy. Decoupled for flexible deployment.
2. **Hybrid API Router with Per-Endpoint Feature Flags** — Incremental ByteCrtrs migration via `.env` flags. Force-routes for report/billing/opt-out; fallback for everything else.
3. **CORS Proxy via Express** — Server-side proxy at `/api/proxy/*` bypasses browser CORS. Required for ByteCrtrs dev server.
4. **ByteCrtrs Library as Browser IIFE** — `window.ApiWrapper` loaded via script tag, pointed at local proxy endpoint.
5. **SessionStorage for Cross-Page State** — Search results and context passed via sessionStorage. URL params used for search queries (survives refresh).
6. **JWT in localStorage** — Acknowledged XSS risk; access token should move to memory in production security pass.
7. **In-Memory Mock Data Store** — Seeded from `server/seed.js` on startup; lost on restart. Intentional for development speed.

---

## VIII. Completed Sprints

| Sprint | Date | Focus | Status |
|--------|------|-------|--------|
| Member Experience Uplift | 2026-03-15 | Signup/payment fixes, member page UI, CSS Modules | ✅ Complete |
| Visitor Experience | 2026-03-16 | Landing V2-V6 ×3, subscription context, signup stepped flow | ✅ Complete |
| Payment Page Redesign | 2026-03-16 | Two-column layout, card validation, order summary | ✅ Complete |
| Conversion Funnel Uplift | 2026-03-17 | PaidRoute, token refresh, redirect passthrough, loader animation, teaser upgrades | ✅ Complete |

---

## Summary

The application is feature-complete for its core use cases: all three search funnels (name/phone/email) work against the live ByteCrtrs API, report creation and 10-section detail view are fully implemented, visitor signup and payment flows are working, and all member/admin pages render correctly. The paywall guards `/people/:id` (PaidRoute) for paid users only. Token refresh on 401 and post-login redirect passthrough are wired. The conversion funnel has been redesigned with blur/lock teaser UX, scanning loader animation, and mid-funnel CTAs.

148+ unit tests pass. Playwright e2e: 25/35 passing (10 pre-existing failures related to auth setup in tests and ByteCrtrs API unavailability in CI).
