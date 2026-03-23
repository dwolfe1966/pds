# BC API Coverage Audit

**Audited:** 2026-03-23
**Source files checked:** `src/services/apiWrapper.js`, `src/services/apiEndpointRegistry.js`, `src/services/apiRouter.js`, `src/api.js`, and all pages under `src/pages/`

---

## 1. Coverage Table

| BC Method | apiWrapper.js | apiRouter.js (callNewAPI) | api.js | UI Usage | Status |
|---|---|---|---|---|---|
| `auth.login` | `login()` | case `login` | `api.login()` | `LoginPage`, `SignupPage` (via `AuthContext.login`) | ✅ Wired |
| `auth.logout` | `logout()` | case `logout` | `api.logout()` | `LogoutPage`, `AuthContext.logout` | ✅ Wired |
| `idLookup.searchTeaser` | `searchTeaser()` | case `teaser-search` | `api.searchPeople()` | All search landing/results pages | ✅ Wired |
| `idLookup.createReport` | `createReport()` | case `create-report` | `api.createReport()` | `SearchResultDetailPage`, `reportService` | ✅ Wired |
| `idLookup.getReport` | `getReportDetail()` | case `get-report` | `api.getReportDetail()` | `SearchResultDetailPage` | ✅ Wired |
| `idLookup.getReports` | `getReportList()` | case `report-list` | `api.getReportList()` | `AccountPage`, `DashboardHome` (via `reportService`) | ✅ Wired |
| `idLookup.downloadPdfReport` | `downloadPdfReport()` | case `download-pdf-report` | `api.downloadPdfReport()` | `SearchResultDetailPage` | ✅ Wired |
| `idLookup.countUserTeaserSearches` | `countUserTeaserSearches()` | case `count-teaser-searches` | `api.countUserTeaserSearches()` | Not called from any page | ⚠️ Wired, no UI |
| `idLookup.countUserReportCreations` | `countUserReportCreations()` | case `count-report-creations` | `api.countUserReportCreations()` | Not called from any page | ⚠️ Wired, no UI |
| `idLookup.countUserPdfDownloads` | `countUserPdfDownloads()` | case `count-pdf-downloads` | `api.countUserPdfDownloads()` | Not called from any page | ⚠️ Wired, no UI |
| `billing.sale` | `sale()` | case `commerce-billing-sale` | `api.billingSale()` | `PaymentPage` | ✅ Wired |
| `billing.tokenSale` | Not wrapped | Not in router | Not in api.js | No UI | ❌ Not wired |
| `billing.signup` | `billingSignup()` | case `commerce-billing-signup` | `api.billingSignup()` | `SignupPageStepped`, `SearchDetailPreviewPage` | ✅ Wired |
| `billing.getActivatedProductTypes` | `getActivatedProductTypes()` | case `get-activated-product-types` | `api.getActivatedProductTypes()` | Not called from any page | ⚠️ Wired, no UI |
| `billing.getOrders` | `getOrders()` | case `get-user-orders` | `api.getUserOrders()` | `AuthContext.refreshSubscription` (drives `isPaid`) | ✅ Wired |
| `billing.cancelOrUncancelOrder` | Not wrapped | Not in router | Not in api.js | No UI | ❌ Not wired |
| `contact.create` | Not wrapped | Not in router | Not in api.js | `ContactPage` calls `api.post('/contact', …)` — routes to mock only | ❌ Not wired |
| `user.update` | Not wrapped | Not in router | Not in api.js | `ProfilePage` calls `api.put('/me', …)` — routes to mock only | ❌ Not wired |
| `user.changePassword` | Called inline in router signup case | Inline only (no named case) | Not exposed | `SettingsPage` calls `api.post('/auth/change-password', …)` — routes to mock only | ❌ Not wired (only called during signup flow) |
| `user.resetPassword` | Not wrapped | Not in router | Not in api.js | No forgot-password page exists | ❌ Not wired |
| `ApiWrapper.goPage('optOut')` | Not wrapped | Not in router | Not in api.js | `OptOutLandingPage` uses internal navigation only | ❌ Not wired |
| `optOut.search` | `searchOptOut()` | case `opt-out-search` | `api.searchOptOut()` | `OptOutSearchResultsPage` | ✅ Wired |
| `optOut.request` | `requestOptOut()` | case `opt-out-request` | `api.requestOptOut()` | `OptOutSearchResultsPage` | ✅ Wired |
| `optOut.confirmation` | `confirmOptOut()` | case `opt-out-confirmation` | `api.confirmOptOut()` | `OptOutInfoInputPage` | ✅ Wired |

**Summary:** 15 of 23 BC methods are fully wired end-to-end. 3 are wired through all service layers but never called by a UI page. 5 are not wired at any layer.

---

## 2. Not Yet Wired Endpoints

These BC methods have no entry in `apiWrapper.js`, `apiRouter.js`, or `api.js`. Each needs a wrapper method, a router case, a registry entry (`newApi: true`), and a UI call point.

### `billing.tokenSale` — card update flow
Used to update stored payment credentials for an existing subscriber without creating a new order. Should be wired when the AccountPage gets a "Update Payment Method" section. Wire as:
- `apiWrapper.tokenSale(params)` → `wrapper.api.billing.tokenSale(params)`
- Router case `billing-token-sale` (force new API, no mock fallback)
- `api.billingTokenSale(params)`
- Call from `AccountPage` alongside the cancel/reactivate subscription controls

### `billing.cancelOrUncancelOrder` — account page cancel/reactivate subscription
The `AccountPage` cancel flow currently calls `api.delete('/subscription', …)` which routes to the mock server. When cancellation moves to BC, wire as:
- `apiWrapper.cancelOrUncancelOrder({ orderId, cancel: true|false })` → `wrapper.api.billing.cancelOrUncancelOrder(…)`
- Router case `billing-cancel-order` (force new API)
- `api.cancelOrder({ orderId, cancel })`
- Replace the `api.delete('/subscription')` call in `AccountPage.handleCancelConfirm()`. Re-call `refreshSubscription()` after success so `isPaid` updates immediately.

### `contact.create` — contact us form
`ContactPage` already has a complete form (`name`, `email`, `subject`, `message`) and calls `api.post('/contact', form)`. The path `/contact` falls through `pathToEndpoint` to the mock API. Wire as:
- `apiWrapper.contactCreate(params)` → `wrapper.api.contact.create(params)`
- Router case `contact-create` (force new API, no mock fallback)
- `api.contactCreate(params)` or extend `pathToEndpoint` to map `/contact` → `contact-create`
- `ContactPage.handleSubmit()` requires no UI changes once the routing is updated

### `user.update` — profile page
`ProfilePage` calls `api.put('/me', { body: form })` which routes to `update-profile` in the mock. BC's `user.update` is the production path. Wire as:
- `apiWrapper.userUpdate(params)` → `wrapper.api.user.update(params)`
- Router case `update-profile` (or a new `user-update` case); update registry entry to `newApi: true`
- The existing `api.updateProfile()` call in `ProfilePage.handleSave()` requires no changes once the router case is live

### `user.resetPassword` — forgot password page
No forgot-password or password-reset page currently exists. When built, wire as:
- `apiWrapper.resetPassword(params)` → `wrapper.api.user.resetPassword(params)`
- Router case `reset-password` (force new API)
- `api.resetPassword({ email })`
- New page at `/forgot-password` with an email input; link from `LoginPage`

### `ApiWrapper.goPage('optOut')` — opt-out navigation
BC's hosted opt-out page can be launched by calling `window.ApiWrapper.getInstance(…).goPage('optOut')`. The current flow uses internal React routes instead (`/opt-out` → `/opt-out-results` → `/opt-out-confirm`). `ApiWrapper.goPage('optOut')` would replace the entire internal flow with BC's managed page. Decide whether to keep the internal funnel or delegate to BC before wiring. If delegating:
- Add a `goOptOutPage()` helper to `apiWrapper.js`
- Call it from `OptOutLandingPage` in place of the `navigate('/opt-out-results?…')` call
- The three internal opt-out routes could then be retired

---

## 3. Statistic Methods — Missing UI Callers

Three BC statistic methods are fully wired through all service layers (`apiWrapper` → router → `api.js`) but are never called by any UI page.

| Method | api.js export | Should be called in |
|---|---|---|
| `countUserTeaserSearches` | `api.countUserTeaserSearches()` | `DashboardHome` — "Searches This Month" metric card |
| `countUserReportCreations` | `api.countUserReportCreations()` | `DashboardHome` — "Reports Generated" metric card |
| `countUserPdfDownloads` | `api.countUserPdfDownloads()` | `AccountPage` — summary stats section |

**Current state of DashboardHome:** The "Searches This Month" count comes from the mock `/searches/me` endpoint (local search history), and "Reports Generated" comes from `getReportList()` response length. Neither reads from BC's authoritative statistic endpoints.

**Current state of AccountPage:** There is no PDF download count displayed anywhere.

**Recommended change:** In `DashboardHome.fetchMetrics()`, replace or supplement the mock-sourced counts with the BC statistic calls:
```js
// Replace mock /searches/me count with BC teaser-search count
const teaserCount = await api.countUserTeaserSearches();
setMetrics(prev => ({ ...prev, searches: teaserCount?.count ?? 0 }));

// Replace report-list length with BC report-creation count
const reportCount = await api.countUserReportCreations();
setMetrics(prev => ({ ...prev, reports: reportCount?.count ?? 0 }));
```

`getActivatedProductTypes` (`api.getActivatedProductTypes()`) is also wired with no UI caller. It should be used to gate which search types a subscriber can access after payment — currently the app uses `isPaid` (a boolean) for all gating with no product-level differentiation.

---

## 4. Guard Rail Impact — Gating Affected by Unwired Endpoints

### Subscription gating (`isPaid` in `AuthContext`)
`isPaid` is derived from `billing.getOrders` — this is **fully wired** and is the correct production path. `PaidRoute` consumes `isPaid` to block `/people/:id` (full report) for non-subscribers. This gate is live and accurate.

### Cancel / reactivate subscription
`billing.cancelOrUncancelOrder` is **not wired**. The AccountPage cancel button calls `api.delete('/subscription')` which hits the mock server only. In production with BC as the user DB, a subscriber who clicks "Cancel Subscription" will get a mock 200 response but their BC subscription will remain active. The mock and BC states will diverge, causing `isPaid` (sourced from `billing.getOrders`) to continue returning `true` even after the user believes they cancelled.

**Impact:** Subscriber cancellation is non-functional against BC. This directly breaks the member-to-free downgrade path.

### Profile / account data
`user.update` is **not wired** to BC. Profile saves write to the mock server only. If a user updates their name or ZIP in `ProfilePage`, the change is not persisted to BC. On the next login (which authenticates against BC), the mock data could be stale or lost entirely.

**Impact:** Profile updates do not survive past a mock server restart. Low guard-rail impact today, but blocks any BC-side personalization.

### Contact form
`contact.create` is **not wired** to BC. Contact form submissions in `ContactPage` POST to the mock server at `http://localhost:3001/api/v1/contact`. The mock server has no `/contact` handler in the path map, so this call will return a 404 in development and is entirely non-functional in production.

**Impact:** Support contact form is broken in any environment that does not run the mock server.

### Product-type gating
`billing.getActivatedProductTypes` is wired but unused. Currently all subscribers get identical access regardless of which product types BC has activated for them. If BC is configured to sell name-search and phone-search as separate products, the app will incorrectly grant full access to all search types on a single product purchase.

**Impact:** Over-granting access to BC product types that the subscriber did not purchase, until `getActivatedProductTypes` is wired into the search page gating logic.

### Forgot password / reset password
`user.resetPassword` is **not wired** and no forgot-password page exists. Users who lose their password have no self-service recovery path inside the app.

**Impact:** Lost-password users must contact support. This is a direct funnel blocker for returning lapsed subscribers.
