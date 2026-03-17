# Sprint Plan — Conversion Funnel Uplift

**Date:** 2026-03-17
**Sprint focus:** Paywall guard, session stability, funnel conversion uplift

---

## Goals

1. **Revenue protection** — Gate `/people/:id` behind a paid subscription check (PaidRoute)
2. **Session stability** — Silent 401 → refresh → retry so users aren't hard-logged-out mid-session
3. **Post-login UX** — ProtectedRoute passes `?redirect=` so users land where they intended after login
4. **Conversion uplift** — Redesign teaser page, results page, and loader pages based on competitor research

---

## PaidRoute Contract

**Component:** `src/pages/PaidRoute.js`

- Reads `{ isPaid, loading }` from `AuthContext`
- `loading === true` → render null (wait for subscription fetch, don't redirect prematurely)
- `isPaid === true` → render children
- `isPaid === false` (authenticated but unpaid) → `<Navigate to="/payment?upgrade=1" replace />`
- Sits **inside** `ProtectedRoute` — unauthenticated users are redirected to login before PaidRoute runs

**Narrow scope (intentional):** Only applied to `/people/:id`. NOT applied to `/dashboard`, `/search`, `/alerts`, `/profile`, `/account`, `/settings`.

*Rationale: Guards the highest-value action (report view) without blocking discovery. Broaden after measuring conversion impact.*

---

## Developer Tasks (all completed 2026-03-17)

| # | Task | Files |
|---|------|-------|
| 1 | PaidRoute component | `src/pages/PaidRoute.js` (new), `src/App.js` |
| 2 | Token refresh interceptor on 401 | `src/services/apiRouter.js` — adds `setLogoutHandler`, 401 retry with `_retried` guard |
| 3 | Wire logout handler | `src/api.js`, `src/context/AuthContext.js` |
| 4 | ProtectedRoute `?redirect=` passthrough | `src/pages/ProtectedRoute.js` |
| 5 | LoginPage consume `?redirect=` | `src/pages/sales/LoginPage.js` |
| 6 | Search result limit bump | `src/services/apiRouter.js` — `perPage: 10` (revert to 5 if ByteCrtrs returns malformed data) |
| 7 | Fix 502 crash on teaser search | `src/services/apiRouter.js` — removed `teaser-search` from FORCE_NEW_API_ENDPOINTS |

---

## Designer Tasks (all completed 2026-03-17)

| # | Task | Files |
|---|------|-------|
| 1 | Loader scanning animation (3 pages) | `NameSearchLoaderPage.js`, `PhoneLoaderPage.js`, `EmailLoaderPage.js`, `LoaderPage.module.css` (new) |
| 2 | Teaser page: "recently viewed" italic note | `SearchDetailPreviewPage.js` + `.module.css` |
| 3 | Teaser page: mid-page amber CTA block | `SearchDetailPreviewPage.js` + `.module.css` |

*Note: SearchDetailPreviewPage was already largely complete (blur, counts, checklist, sticky mobile bar, inline signup form) from prior sprint.*

---

## Tester Tasks (in progress)

| # | Task | Files | Status |
|---|------|-------|--------|
| 1 | PaidRoute tests | `src/tests/paidRoute.test.js` | Pending |
| 2 | Token refresh tests | `src/tests/tokenRefresh.test.js` | Pending |
| 3 | Playwright investigation | `tests/e2e/` | Done — 25/35 passing, no import errors |
| 4 | Full regression run | All suites | Pending |

---

## Playwright E2E Status (2026-03-17)

**35 tests, 25 passing, 10 failing.** No import errors — Playwright is fully operational.

### Failing tests and root causes

| Test | Root cause | Fix needed |
|------|-----------|-----------|
| Login — logged-in user redirected from /login | `LoginPage` has no redirect-if-already-authenticated logic | Add `useAuth().token` check at top of LoginPage, navigate to /dashboard |
| Member search × 6 | Tests navigate to `/people-search` without injecting auth token | Update test fixtures to set localStorage token before navigating |
| Report flow × 3 | ByteCrtrs API unavailable in test environment — requests timeout at 20s | Mock `window.ApiWrapper` in Playwright config or use recorded fixtures |

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| ByteCrtrs may cap search results at 5 despite `perPage: 10` | Monitor for malformed/empty responses; revert to deleting `perPage` if seen |
| Token refresh retry loop | `_retried: true` flag on params prevents second retry on same request |
| `setLogoutHandler` wired in AuthContext `useEffect([], [])` — logout reference is the initial function | Acceptable: logout function is stable (defined once, doesn't close over changing state) |

---

## Sprint 2026-03-17 Part 3

**Sprint focus:** Loading skeleton states + Reporting, Tracking & Visualization (BACKLOG-2)

### Sprint Goals

1. **Loading skeleton states** (Item 5 from Remaining Backlog) — Replace spinner-only loading states with CSS pulse skeleton screens for perceived performance improvement on DashboardHome, AccountPage, and AlertsPage.
2. **BACKLOG-2: Reporting, Tracking & Visualization** — Implement a lightweight client-side event tracking layer, wire it into the four highest-value funnel pages, add mock server endpoints for event storage and aggregation, and replace the placeholder AnalyticsPage with real Recharts visualizations.

---

### Architecture Decisions

#### Tracking Layer — `src/services/trackingService.js`

**Interface:**
```js
track(eventName, properties = {})
```

- Fire-and-forget: never throws, never awaits — wrapped in `try/catch`, errors are silently swallowed so tracking failures cannot break user-facing flows.
- POSTs to `POST /api/v1/admin/events` on the mock Express server.
- Each event payload shape:
  ```json
  {
    "event": "page_view",
    "timestamp": "2026-03-17T12:00:00.000Z",
    "sessionId": "abc123",
    "properties": { "page": "/name/landing", "variant": "v3" }
  }
  ```

**Tracked event names (exhaustive list for this sprint):**

| Event | Where fired | Key properties |
|-------|------------|----------------|
| `page_view` | Each funnel page on mount | `page`, `variant` |
| `search_submit` | `NameSearchLoaderPage` on form submit | `searchType`, `variant` |
| `result_click` | `NameSearchLoaderPage` on result selection | `searchType`, `resultIndex` |
| `teaser_view` | `SearchDetailPreviewPage` on mount | `personId` |
| `signup_start` | `SignupPage` on mount | `source` |
| `signup_complete` | `SignupPage` on successful API response | `plan` |
| `payment_start` | `PaymentPage` on mount | `selectedPerson` boolean |
| `payment_complete` | `PaymentPage` on successful billing response | `plan`, `amount` |

**Scope boundary (intentional):** Only `NameSearchLoaderPage`, `SearchDetailPreviewPage`, `SignupPage`, and `PaymentPage` receive tracking calls in this sprint. Phone/email funnel pages and member pages are out of scope — add them in a later sprint after validating the pipeline.

#### sessionId Generation

Generated once per browser session:

```js
const getSessionId = () => {
  let id = sessionStorage.getItem('sid');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    sessionStorage.setItem('sid', id);
  }
  return id;
};
```

- Uses `crypto.randomUUID()` when available (all modern browsers), falls back to `Math.random()` for legacy.
- Stored in `sessionStorage` (cleared on tab close, NOT persisted across sessions — intentional for privacy).
- `sessionId` is included on every event payload automatically inside `track()`.

#### Server Storage — `server/index.js`

New in-memory `eventLog` array alongside the existing `dataStore`:

```js
const eventLog = []; // appended by POST /api/v1/admin/events, read by GET endpoints
```

This follows the exact same pattern as `dataStore.searches`, `dataStore.sessions`, etc. — in-memory, lost on server restart, sufficient for development and demo purposes. No SQLite or file persistence is needed in this sprint (see BACKLOG-2 notes for production path).

**New endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/admin/events` | None (fire-and-forget from client, no token) | Appends one event object to `eventLog[]`. Responds `{ ok: true }`. |
| `GET` | `/api/v1/admin/events` | `authenticateToken` + `requireRole('admin')` | Returns `{ data: eventLog, total: eventLog.length }`. |
| `GET` | `/api/v1/admin/events/summary` | `authenticateToken` + `requireRole('admin')` | Returns aggregated counts — see shape below. |

`GET /api/v1/admin/events/summary` response shape:
```json
{
  "totalEvents": 142,
  "byEvent": {
    "page_view": 60,
    "search_submit": 30,
    "teaser_view": 25,
    "signup_start": 18,
    "signup_complete": 12,
    "payment_start": 10,
    "payment_complete": 7
  },
  "dailyCounts": [
    { "date": "2026-03-15", "count": 40 },
    { "date": "2026-03-16", "count": 55 },
    { "date": "2026-03-17", "count": 47 }
  ],
  "funnelSteps": [
    { "step": "search_submit", "count": 30 },
    { "step": "teaser_view", "count": 25 },
    { "step": "signup_start", "count": 18 },
    { "step": "signup_complete", "count": 12 },
    { "step": "payment_start", "count": 10 },
    { "step": "payment_complete", "count": 7 }
  ],
  "searchTypeBreakdown": [
    { "type": "name", "count": 20 },
    { "type": "phone", "count": 6 },
    { "type": "email", "count": 4 }
  ]
}
```

`POST /api/v1/admin/events` requires no auth token — tracking must succeed even for unauthenticated visitors (landing page → loader → teaser are pre-auth funnel steps). The read endpoints (`GET`) remain admin-gated.

#### Chart Library — Recharts

Install: `npm install recharts` (client package, not server).

**AnalyticsPage (`src/pages/admin/AnalyticsPage.js`) — three chart panels:**

1. **Funnel bar chart** — `BarChart` from Recharts. X-axis: funnel step names from `funnelSteps[]`. Y-axis: count. Shows drop-off across search_submit → teaser_view → signup_start → signup_complete → payment_start → payment_complete. Data from `GET /api/v1/admin/events/summary`.

2. **Daily events line chart** — `LineChart` from Recharts. X-axis: date string. Y-axis: total event count. Data from `dailyCounts[]` in summary response. Shows 30-day rolling window (server filters to last 30 days before responding).

3. **Search type pie chart** — `PieChart` from Recharts. Segments: name / phone / email counts. Data from `searchTypeBreakdown[]` in summary response.

AnalyticsPage fetches from two endpoints on mount:
- `GET /api/v1/admin/analytics` (existing mock endpoint — keep for backward compat, provides `totalSearches`, `newUsers`, `revenue` KPI cards at top)
- `GET /api/v1/admin/events/summary` (new endpoint — drives the three charts)

---

### Developer Tasks

| # | Task | Files | Notes |
|---|------|-------|-------|
| 1 | Create tracking service | `src/services/trackingService.js` (new) | `track(event, props)`, `getSessionId()`, fire-and-forget POST |
| 2 | Add event endpoints to mock server | `server/index.js` | Add `eventLog[]` array + 3 new routes (POST events, GET events, GET events/summary) |
| 3 | Wire tracking into funnel pages | `src/pages/sales/NameSearchLoaderPage.js`, `src/pages/sales/SearchDetailPreviewPage.js`, `src/pages/sales/SignupPage.js`, `src/pages/sales/PaymentPage.js` | Import `track` from trackingService; add calls at mount and key action points |
| 4 | Update AnalyticsPage data layer | `src/pages/admin/AnalyticsPage.js` | Add second `useEffect` fetch for `/admin/events/summary`; pass data to chart sub-components |
| 5 | Install recharts | `package.json` | `npm install recharts` |

---

### Designer Tasks

| # | Task | Files | Notes |
|---|------|-------|-------|
| 1 | Skeleton component | `src/components/Skeleton.js` (new), `src/components/Skeleton.module.css` (new) | CSS pulse animation; variants: `text` (single line), `card` (rectangular block), `avatar` (circle). Props: `variant`, `width`, `height`, `count` |
| 2 | Apply skeletons — DashboardHome | `src/pages/member/DashboardHome.js` | Replace `<p>Loading…</p>` spinner with 3× `<Skeleton variant="card" />` blocks for the metrics panel |
| 3 | Apply skeletons — AccountPage | `src/pages/member/AccountPage.js` | Replace report list spinner with 4× `<Skeleton variant="card" />` rows |
| 4 | Apply skeletons — AlertsPage | `src/pages/member/AlertsPage.js` | Replace alert list spinner with 3× `<Skeleton variant="card" />` rows |
| 5 | AnalyticsPage visual redesign | `src/pages/admin/AnalyticsPage.js`, new `src/pages/admin/AnalyticsPage.module.css` | Chart container cards with subtle drop shadow and header labels; three-column grid on desktop, single-column on mobile; muted color palette (no harsh primaries); KPI summary row at top stays as text cards |

**Skeleton CSS pulse spec:**
```css
/* Skeleton.module.css — key rules */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: pulse 1.4s ease-in-out infinite;
  border-radius: 4px;
}
@keyframes pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.avatar { border-radius: 50%; }
.text { height: 1rem; margin-bottom: 0.5rem; }
.card { height: 80px; margin-bottom: 1rem; }
```

---

### Tester Tasks

| # | Task | Files | Notes |
|---|------|-------|-------|
| 1 | trackingService unit tests | `src/tests/trackingService.test.js` (new) | See test spec below |
| 2 | Full regression run | All existing suites | Run `npm test` after all changes; confirm 148-test baseline still passes |

**`src/tests/trackingService.test.js` test cases (minimum required):**

1. `getSessionId()` returns a non-empty string
2. `getSessionId()` returns the same value on a second call within the same session (idempotent)
3. `getSessionId()` generates a new id when sessionStorage is cleared between calls
4. `track()` calls `fetch` (or `api.post`) with the correct URL and payload shape `{ event, timestamp, sessionId, properties }`
5. `track()` does NOT throw when the fetch rejects (fire-and-forget error swallowing)
6. `track()` does NOT throw when called with no `properties` argument (default `{}`)
7. `track()` includes the sessionId from `getSessionId()` automatically — caller does not need to pass it

---

### Dependency Notes

- `recharts` must be installed before AnalyticsPage chart work begins (`npm install recharts`).
- `trackingService.js` has no external dependencies — it uses `fetch` directly (available in all target browsers and in jsdom for tests).
- Designer skeleton work is independent and can proceed in parallel with Developer tracking work.
- AnalyticsPage chart wiring (Developer task 4) depends on Developer task 2 (server endpoints) being done first so real data is available for manual verification.

---

### Out of Scope for This Sprint

- Persistent event storage (SQLite or file-based). In-memory `eventLog[]` is sufficient for development. Production persistence is a separate infrastructure concern.
- Phone/email funnel tracking. Only the name funnel (`NameSearchLoaderPage`) is wired in this sprint.
- Variant A/B tagging on all 18 landing page variants. `page_view` events will capture the URL which encodes the variant; a dedicated `landingVariant` property can be added in a follow-up sprint.
- ByteCrtrs auth enable (`REACT_APP_USE_NEW_API_AUTH=true`).

---

## Backlog (Large Items)

### BACKLOG-1 — Outbound Email Communications Platform
**Scope:** Full lifecycle outbound email system for member-facing communications.
- Transactional emails: welcome, signup confirmation, password reset, subscription confirmation/cancellation, payment receipt
- Marketing/lifecycle emails: upgrade nudges for free members, re-engagement sequences, report ready alerts
- Template system: brand-consistent HTML templates with logo, colors, unsubscribe link (CAN-SPAM compliant)
- Delivery infrastructure: integration with a sending provider (SendGrid / Postmark / AWS SES)
- Preference management: members can opt in/out of marketing vs. transactional emails (settings page already has notification prefs UI)
- Admin tools: send test email, view delivery status, manage suppression list
- **Key files to touch:** `server/index.js` (add email service), `src/pages/member/SettingsPage.js` (notification prefs already wired to mock), `src/pages/sales/SignupPage.js` (trigger welcome email on signup)
- **Dependencies:** Requires email provider API key in `.env`

### BACKLOG-2 — Reporting, Tracking & Visualization
**Scope:** Internal analytics and visitor/member behavior tracking with dashboard visualization.
- **Tracking layer:** Page view events, funnel step completion (landing → loader → results → teaser → signup → payment), CTA click tracking, search query analytics (anonymized), conversion rate per landing page variant
- **Data pipeline:** Event schema, server-side event logging to persistent store (replaces in-memory mock), time-series aggregation
- **Visualization dashboard:** Admin analytics page (already exists at `/admin/analytics`) — replace mock metrics with real charts: conversion funnel drop-off, variant A/B performance, daily/weekly search volume, revenue by cohort, churn rate
- **Chart library:** Recommend Recharts (already React-friendly) or lightweight alternatives
- **Funnel variant tracking:** Tag each visitor session with the landing page variant (V1–V6) they entered on; track through to conversion so A/B winner can be identified
- **Key files to touch:** `src/pages/admin/AnalyticsPage.js`, `server/index.js` (add analytics endpoints + persistent log), new `src/services/trackingService.js`
- **Dependencies:** Persistent data store (replace in-memory seed with SQLite or file-based log for dev; production would use a proper DB)
- **Sprint 2026-03-17 Part 3 implements the MVP of BACKLOG-2** — tracking service, server endpoints, Recharts charts. Persistent storage and full variant tagging remain in the backlog.

---

## Remaining Backlog (smaller items)

| Item | Priority | Notes |
|------|----------|-------|
| Toast notification system | Medium | Replace inline error states across member pages |
| Opt-out email confirmation handler | Low | ByteCrtrs `ApiWrapperQueryHandler.getHandler()` wiring |
| Unpaid guard broadening | Low | Optionally gate `/alerts` or `/search` in future |
| ByteCrtrs auth enable | Low | Flip `REACT_APP_USE_NEW_API_AUTH=true` + test |
| LoginPage redirect-if-logged-in | Medium | Add `useAuth().token` check; navigate to /dashboard if already authenticated |
| Fix Playwright auth fixtures (member search tests) | Medium | Set localStorage token in test fixtures before navigating to protected routes |
| Phone/email funnel tracking | Low | Extend trackingService calls to `PhoneLoaderPage`, `EmailLoaderPage` after name funnel validated |
| Landing variant A/B tagging | Medium | Add `landingVariant` property to `page_view` events; pass variant through sessionStorage so it reaches signup_complete and payment_complete |
