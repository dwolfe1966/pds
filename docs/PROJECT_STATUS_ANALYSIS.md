# IDLookup.AI — Project Status Analysis

**Generated:** March 2026
**Source:** Review of all documents in `/docs`

---

## I. Completed Use-Cases

### Infrastructure & Architecture
- **Mock API server** — Full Express.js server (`server/`) with JWT auth, in-memory data store, seed data (22 users, 100 people records, 200 search history entries), and all endpoints from the API specification implemented.
- **Hybrid API routing layer** — `src/services/apiRouter.js` intelligently routes each endpoint to either the ByteCrtrs API or the mock API based on feature flags, with automatic fallback and CORS error detection.
- **CORS proxy** — Express proxy at `/api/proxy/*` forwards requests to the ByteCrtrs dev server server-side, bypassing browser CORS restrictions. Handles cookie storage and 412 → captcha → retry flow automatically.
- **ByteCrtrs API wrapper service** — `src/services/apiWrapper.js` wraps the `window.ApiWrapper` IIFE library and exposes typed methods for all supported operations.
- **Response adapter** — `src/services/apiAdapter.js` transforms ByteCrtrs library responses into the application's internal data format.
- **Search context manager** — `src/services/searchContext.js` persists `searchContextKey`, `teaserInput`, `provider`, and `commerceContentId` in sessionStorage across page navigations, ready for report creation and opt-out flows.
- **Authentication context** — `src/context/AuthContext.js` manages JWT token lifecycle, persists session to `localStorage`, and injects the token into all API calls.
- **Protected routes** — `ProtectedRoute` component guards member and admin routes; role check enforces `admin`-only access for the admin section.

### Search (Teaser)
- **Name search flow** — Full funnel implemented: landing (`/name/landing`) → loader (`/name/loader`) → results (`/name/search-result`) → detail preview (`/search/:id`) → signup (`/signup`) → payment (`/payment`). V2 and V3 landing page variants also built.
- **Phone search flow** — `/phone/landing` → `/phone/loader` → `/phone/search-result`. Legacy routes retained for backward compatibility.
- **Email search flow** — `/email/landing` → `/email/loader` → `/email/search-result`.
- **General/combined search** — `/search/all` with tabs for name, phone, and email.
- **Member search** — `/people-search` and `/people-results` for authenticated users, plus search history recording.
- **ByteCrtrs teaser search live** — `REACT_APP_USE_NEW_API_SEARCH=true` is enabled; the real ByteCrtrs API is used for all teaser searches (name, phone, email) with mock fallback.

### Sales & Conversion Funnel
- **Signup page** — Sales signup at `/signup` and `/name/signup`, with person teaser pre-populated from the selected search result.
- **Login page** — `/login` with AuthContext integration.
- **Payment page** — `/payment` wired to `api.billingSale()` (ByteCrtrs `commerceBilling/sale`), with mock `updateSubscription` fallback.
- **Opt-out flow (search + status check)** — `/opt-out` → `/opt-out-results` → `/opt-out/request`. `OptOutSearchResultsPage` calls `api.searchOptOut()` before proceeding, showing "already opted out" banner or navigating to the request form.
- **Search pagination (Load More)** — `api.loadMoreSearchResults()` wraps `rawResponse.getMore()` / `hasMore()`. Results pages call this and append new results when the button is clicked.
- **Consistent `searchContextKey`** — `api.js` reads `window.ApiWrapper.searchContextKey` and selects the correct key for sale vs. member, name/phone/email, and teaser vs. report context.

### Legal / Static Sales Pages
- Privacy, Terms, Refund, CPCC, Partner, Suppression List, About, Contact pages all built.
- Opt-out landing, results, and info-input pages built.
- Add-on page built.

### Admin Panel (mock-API backed)
- Users list, user detail (with suspend/reactivate), sessions, purchases (with refund), data removal (approve/reject), analytics, and CS rep management — all pages built and wired to mock API.

### Member Dashboard (mock-API backed)
- Dashboard home, profile page, search history, "Who Is Searching" (profile views), alerts (CRUD), account page (subscription management), settings page (password change, MFA toggle), and logout page — all built and connected to mock API.

### Design System
- JS token object (`src/styles/designSystem.js`) for colors, typography, spacing, shadows, breakpoints.
- Global CSS variables (`src/styles/variables.css`) and base reset.
- CSS Modules for component-scoped styles.

---

## II. Incomplete Use-Cases

### Report Creation & Viewing (Phase 3 — not started against ByteCrtrs API)
The ByteCrtrs report endpoints (`POST /idLookup/report/create`, `GET /idLookup/report/detail/:id`, `GET /idLookup/report/list`) exist in `apiWrapper.js` and `apiRouter.js` but are **not yet wired into the UI**.

| Gap | File | Status |
|-----|------|--------|
| Create report on result click/page load | `SearchDetailPreviewPage.js`, `SearchResultDetailPage.js` | Not wired — pages show mock/preview data only |
| Display full report content | `SearchResultDetailPage.js` | Skeleton only |
| Report list in Account page | `AccountPage.js` | Section missing |
| Report list on Dashboard | `DashboardHome.js` | Reports count is mock data |
| Post-payment report redirect | `PaymentPage.js` | Redirects to dashboard, not to report |
| `reportService.js` utility | `src/services/reportService.js` | File exists but is not fully utilized by UI pages |

The env flag `REACT_APP_USE_NEW_API_REPORTS=false` confirms these are explicitly disabled.

### Opt-Out — Email Confirmation Link Handler
`api.confirmOptOut()` exists but is **not invoked from a URL query-param handler**. Email opt-out confirmation links using `?awqh[type]=confirmationRequestOptOut&awqh[value]=<token>` are not handled. The ByteCrtrs library provides `ApiWrapperQueryHandler.getHandler()` for this, but it has not been wired into `App.js` or any route.

### Authentication via ByteCrtrs API (Phase 5 — pending)
`REACT_APP_USE_NEW_API_AUTH=false`. Login and logout still route to the mock API. The ByteCrtrs `POST /auth/login` and `POST /auth/logout` endpoints are available but unused. Signup is confirmed to be **not available** in the ByteCrtrs API and must remain on the mock.

### Token Refresh
`AuthContext` stores the `refreshToken` in `localStorage` but never uses it. There is no automatic refresh on access token expiry (401 → refresh → retry cycle).

### Toast Notification System
No `Toast.js` component or `NotificationContext` exists. All API actions (successful saves, errors) are currently surfaced via inline state or `alert()`. This is called out as a critical gap in `NEXT_STEPS.md`.

### Loading States & Skeletons
No shared `LoadingSpinner` or `LoadingSkeleton` components. Some pages have local loading state booleans but no consistent loading UI pattern.

### Form Validation
Forms (signup, profile update, alerts, settings) have minimal client-side validation. No password-strength indicator, no field-level error display from API responses, no reusable form-input component.

### Error Boundaries
No React error boundary component wraps routes. Unhandled render errors will crash the entire app.

### Testing Suite
No test framework is configured. No unit, integration, or E2E tests exist.

### CI/CD & Deployment Pipeline
No CI/CD configuration files (GitHub Actions, Netlify, Vercel) have been created. The deployment docs describe the approach but nothing is automated.

---

## III. Major Architectural Decisions

### 1. Static React SPA + Separate Express Server
The React app is a static site (bundled by Parcel 2). The Express server (`server/`) serves two roles: mock API for development, and CORS proxy for forwarding ByteCrtrs requests in production. These are intentionally not coupled — the static build can be hosted on any CDN/static host independently.

### 2. Hybrid API Router with Per-Endpoint Feature Flags
Rather than a hard cut-over to the ByteCrtrs API, each endpoint is independently switchable via `.env` flags (`REACT_APP_USE_NEW_API_SEARCH`, `_REPORTS`, `_OPTOUT`, `_AUTH`). The router tries the new API first and falls back to mock on error (except for "force" endpoints). This allows incremental migration with zero risk to already-working flows.

### 3. CORS Proxy via Express (Not a Serverless Solution)
The ByteCrtrs API does not allow direct browser requests from `localhost` or arbitrary domains. The chosen solution routes all ByteCrtrs calls through the Express server at `/api/proxy/*`. This was preferred over serverless functions or Cloudflare Workers for development simplicity, but it means a server process must be co-deployed in production (`DEPLOYMENT_NEW_API.md` documents this two-part deployment).

### 4. ByteCrtrs Library as Browser IIFE + Proxy Mode
The `window.ApiWrapper` library is loaded as an IIFE script tag in `public/index.html`. The `apiWrapper.js` service points the library's `endpointUrl` at the local proxy (`http://localhost:3001/api/proxy`) instead of the ByteCrtrs origin, so the library constructs normal requests that the proxy forwards. A local copy of the library is also maintained at `public/libs/api-wrapper/index.iife.js` for version control and offline development.

### 5. SessionStorage for Cross-Page State
Search results, individual result data, and search context are passed between pages via `sessionStorage` (not URL params or a global store). This avoids large query strings and keeps navigation clean, but it means "Load More" pagination is only available on pages that perform a fresh `api.searchPeople()` call — not on pages that read results from sessionStorage.

### 6. JWT in localStorage (Acknowledged Security Trade-off)
Access and refresh tokens are stored in `localStorage`. The docs acknowledge this is not ideal for access tokens (XSS risk) and suggest moving access tokens to memory in a future security pass. The mock API server uses a short-lived `JWT_SECRET` that must be changed before any production use.

### 7. In-Memory Mock Data Store
The mock server uses no database; all data is seeded from `server/seed.js` on startup and lost on restart. This is intentional for development speed. Seed data includes guaranteed search terms documented in `GUARANTEED_SEARCH_TERMS.md` so tests are repeatable.

### 8. Roles: member / admin / cs-rep
The JWT token carries `role`. `ProtectedRoute` accepts an optional `role` prop to enforce admin-only access. CS-rep is defined in the spec and seed data but has no dedicated protected route or separate nav yet.

---

## IV. Use-Cases Workable Given Current ByteCrtrs API State

Based on `BYTECRTRS_API_UPDATE_ANALYSIS.md` and `INTEGRATION_STATUS_REVIEW.md`, the following can be implemented now without waiting for any new API endpoints — everything needed is confirmed available in the live ByteCrtrs dev API:

### Ready to Build Immediately

| Use-Case | ByteCrtrs Endpoint / Feature | Effort |
|----------|------------------------------|--------|
| **Full report creation on result click** | `POST /idLookup/report/create` (via `apiWrapper.createReport`) | Medium — wire `SearchDetailPreviewPage` and `SearchResultDetailPage` |
| **Full report detail view** | `GET /idLookup/report/detail/:commerceContentId` (via `apiWrapper.getReportDetail`) | Medium — build report content UI |
| **Report list in Account/Dashboard** | `GET /idLookup/report/list?lastId=` (via `apiWrapper.getReportList`) | Medium — add section to `AccountPage` |
| **Post-payment report redirect** | Uses `commerceContentId` returned from `create-report` | Low — update redirect in `PaymentPage` |
| **Opt-out email confirmation link** | `ApiWrapperQueryHandler.getHandler()` + `ApiWrapperQueryHandlerConfirmationOptOut` | Low — add handler call in `App.js` |
| **ByteCrtrs login/logout** | `POST /auth/login`, `POST /auth/logout` | Low — flip `REACT_APP_USE_NEW_API_AUTH=true`, update `AuthContext` response mapping |

### Already Implemented (confirm working)

| Use-Case | Status |
|----------|--------|
| Teaser search (name/phone/email) | Live — `REACT_APP_USE_NEW_API_SEARCH=true` |
| Real payment via `commerceBilling/sale` | Live — `PaymentPage` calls `api.billingSale()` |
| Opt-out search status check | Live — `OptOutSearchResultsPage` calls `api.searchOptOut()` |
| Search result pagination (Load More) | Live — `api.loadMoreSearchResults()` implemented, shown on results pages |
| Consistent `searchContextKey` (sale vs member) | Live — `api.js` reads `window.ApiWrapper.searchContextKey` |

### Not Yet Available in ByteCrtrs API

| Use-Case | Reason |
|----------|--------|
| Signup via ByteCrtrs | Confirmed not available — must remain on mock API |
| Profile management (GET/PUT /me) | Not in ByteCrtrs API — remains on mock API |
| Alerts, notifications, subscription management | Not in ByteCrtrs API — remains on mock API |
| Admin endpoints (users, analytics, etc.) | Not in ByteCrtrs API — remains on mock API |

---

## Summary

The project has a solid foundation: the hybrid routing architecture, CORS proxy, ByteCrtrs library integration, and all three search funnels (name/phone/email) are production-ready against the live ByteCrtrs API. The primary remaining work before an MVP is:

1. **Wire report creation and viewing** to the ByteCrtrs API (the most valuable missing feature for end users).
2. **Add token refresh and a toast notification system** (table-stakes UX quality).
3. **Enable ByteCrtrs auth** (low effort — flag flip + response-mapping tweak).
4. **Wire opt-out email confirmation** (low effort — `ApiWrapperQueryHandler` call in `App.js`).

All four items above are unblocked by the current state of the ByteCrtrs API.
