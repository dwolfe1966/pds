# ByteCrtrs API Update Analysis

**Date:** January 26, 2025  
**Library Source:** `https://dev1.dev.www.bytecrtrs.com/libs/api-wrapper/index.iife.js`  
**Local Copy:** `public/libs/api-wrapper/index.iife.js` (downloaded for version control)

---

## Note on API Documentation

The Google Sheets API document (`https://docs.google.com/spreadsheets/d/1R7fE5Jp4TNt14BlwsbTqpxpUwNh1BxihGhfXqn0qNpQ/edit?gid=49291190`) requires sign-in and is not publicly accessible. This analysis is based on:

1. **Live library** fetched from the ByteCrtrs CDN
2. **Local CSV spec** (`docs/new-api/bc client library - API.csv`)
3. **Current codebase** integration status

If you have access to the Google Sheets doc, please share any additional endpoints or parameter changes so this analysis can be updated.

---

## Part 1: What Has Changed with the API

### 1.1 New Endpoints (Not in Original CSV Spec)

| Endpoint | Method | Purpose | Library Method |
|----------|--------|---------|----------------|
| `/optOut/search` | POST | Search for opt-out status before submitting request | `api.optOut.search` |
| `/commerceBilling/sale` | POST | Process payment/sale (billing) | `api.billing.sale` |

### 1.2 Existing Endpoints (Unchanged)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | Login |
| `/auth/logout` | POST | Logout |
| `/idLookup/teaser/search` | POST | Teaser search (name/phone/email) |
| `/idLookup/report/create` | POST | Create report from extId or reversePhone |
| `/idLookup/report/detail/:commerceContentId` | GET | Get report details |
| `/idLookup/report/list` | GET | List reports (paginated via `lastId`) |
| `/optOut/request` | POST | Submit opt-out request |
| `/optOut/confirmation` | GET | Confirm opt-out (from email link) |

### 1.3 New Library Features (Beyond Raw Endpoints)

#### A. Search Teaser Pagination

The `searchTeaser` response now exposes pagination helpers:

- **`hasMore()`** – Returns `true` if more results exist (`identities.length < total`)
- **`getMore()`** – Fetches next page and appends identities to the response
- **`getTotalCount()`** – Returns total result count
- **`makeGetMoreParams()`** – Builds `{ commerceContentId, page }` for next request

**Impact:** You can implement "Load more" or infinite scroll on search results without re-searching.

#### B. `searchContextKey` Enum

The library exposes `ApiWrapper.searchContextKey` for structured context:

```javascript
{
  sale: {
    name: { teaser, teaserOptOut, report },
    phone: { teaser, teaserOptOut, report },
    email: { teaser, teaserOptOut, report },
  },
  member: {
    name: { teaser, teaserOptOut, report },
    phone: { teaser, teaserOptOut, report },
    email: { teaser, teaserOptOut, report },
  },
}
```

**Impact:** Report creation and opt-out flows can use the correct context key for sale vs member, name vs phone vs email.

#### C. Opt-Out Query Handler

- **`ApiWrapperQueryHandler.getHandler()`** – Reads `awqh[type]` and `awqh[value]` from URL
- **`ApiWrapperQueryHandlerConfirmationOptOut`** – When `type=confirmationRequestOptOut`, shows confirmation modal and calls `optOut.confirmation`
- **`removeQuery()`** – Cleans query params after handling

**Impact:** Email opt-out links can use `?awqh[type]=confirmationRequestOptOut&awqh[value]=<token>` and the library handles the flow automatically.

#### D. Built-in Modals

- **`turnstileModal`** – Cloudflare Turnstile captcha
- **`promptModal`** – Text/password input
- **`messageModal`** – Info message with Close
- **`confirmationModal`** – Yes/No confirmation

**Impact:** Captcha and opt-out flows can use library modals instead of custom UI.

#### E. Captcha Handling

- **`ApiWrapperCaptcha`** – Intercepts 412 responses, runs captcha flow, retries with `x-captcha-id` header
- Supports: `turnstile.v0`, `password.v0`, `svgCaptcha.text`, `svgCaptcha.math`, `gifCaptcha.v0`, `gifCaptcha.v1`

**Impact:** Already used via proxy; dev uses `bcEdgeApiPass` for password captcha.

#### F. Billing Sale Endpoint

- **`api.billing.sale(params)`** – POST to `/commerceBilling/sale`
- Expects `queryString` (optional) and `data` in body
- Library auto-adds `billingSeriesId`: `sale|{clientId}|{apiId}|{timestamp}|{random}`

**Impact:** Real payment processing can replace mock `updateSubscription`.

---

## Part 2: Unfinished Use-Cases That Can Be Completed

### 2.1 Opt-Out Search (`optOut/search`)

**Current state:** Opt-out flow uses `api.searchPeople` (teaser search) to find records. There is no dedicated opt-out search.

**New capability:** `api.optOut.search(params)` – Check opt-out status before submitting a request.

**Use-case:** Before showing the opt-out form, call `optOut.search` to:
- Verify the record exists and is eligible for opt-out
- Show "Already opted out" if applicable
- Reduce invalid submissions

**Implementation:**
- Add `searchOptOut` to `apiWrapper.js`
- Add `opt-out-search` endpoint to `apiRouter.js` and `apiEndpointRegistry.js`
- Call from `OptOutSearchResultsPage` or `OptOutInfoInputPage` before proceeding

---

### 2.2 Real Payment via `commerceBilling/sale`

**Current state:** `PaymentPage` uses `api.updateSubscription` (mock API) with a demo token.

**New capability:** `api.billing.sale(params)` – Process real payments through ByteCrtrs.

**Use-case:** Replace mock payment with ByteCrtrs billing:
- Pass `queryString` (e.g. plan, price) and payment data
- Receive success/failure from API
- Redirect to report or dashboard on success

**Implementation:**
- Add `sale` to `apiWrapper.js` (wrapper for `api.billing.sale`)
- Add `commerce-billing-sale` to router and registry
- Update `PaymentPage` to call `api.billingSale(...)` instead of `api.updateSubscription`
- Add proxy route for `/commerceBilling/sale` if using proxy

---

### 2.3 Search Results Pagination (`getMore` / `hasMore`)

**Current state:** Search results show first page only. No "Load more" or pagination.

**New capability:** `response.hasMore()` and `response.getMore()` on teaser search response.

**Use-case:** On `/people-results`, `/name/search-result`, etc.:
- Show "Load more" when `hasMore()` is true
- Call `getMore()` to append next page
- Avoid full re-search

**Implementation:**
- Store raw library response (with `getMore`/`hasMore`) when using apiWrapper directly
- Or extend `api.searchPeople` to return pagination metadata and a `loadMore` callback
- Add "Load more" button that calls `loadMore()` and appends to results

---

### 2.4 Opt-Out Confirmation from Email Link

**Current state:** `api.confirmOptOut` exists but is not wired to URL query params. Email links would need a custom page.

**New capability:** `ApiWrapperQueryHandler.getHandler()` + `ApiWrapperQueryHandlerConfirmationOptOut.execute()`.

**Use-case:** Email link format:
```
https://yoursite.com/opt-out?awqh[type]=confirmationRequestOptOut&awqh[value]=<token>
```
On page load, library detects params, shows "Would you like to opt out?" modal, calls confirmation API, shows success/failure.

**Implementation:**
- On app load (e.g. `App.js` or opt-out route), call `ApiWrapperQueryHandler.getHandler()`
- If handler exists, call `handler.execute({ api: wrapper.api })`
- Optionally use library modals or replace with app-styled modals

---

### 2.5 Report List for Members

**Current state:** `apiWrapper.getReportList` exists; `AccountPage` does not yet show report history.

**New capability:** `GET /idLookup/report/list?lastId={lastId}` – Paginated list of user reports.

**Use-case:** Member dashboard or Account page:
- Show "Your Reports" with pagination
- Link each report to detail view
- Uses `commerceContentId` from list for detail URL

**Implementation:**
- Add report list section to `AccountPage` or `DashboardHome`
- Call `apiWrapper.getReportList({ lastId })` (or route through apiRouter)
- Add proxy route for `/idLookup/report/list` if not already proxied

---

### 2.6 Consistent `searchContextKey` Usage

**Current state:** `api.js` and `searchContext.js` use `searchContextKey` from `window.ApiWrapper.searchContextKey` when available.

**New capability:** Structured keys for sale vs member, name vs phone vs email.

**Use-case:** Ensure report creation and opt-out use the correct context:
- Sales flow: `sale.name.teaser`, `sale.name.report`, etc.
- Member flow: `member.name.teaser`, `member.name.report`, etc.

**Implementation:**
- Audit all `createReport` and `requestOptOut` calls
- Pass `searchContextKey` from `ApiWrapper.searchContextKey` based on flow (sale vs member, name vs phone vs email)

---

## Summary Table

| Use-Case | New API Addition | Priority | Effort |
|----------|------------------|----------|--------|
| Opt-out search before request | `optOut/search` | Medium | Low |
| Real payment processing | `commerceBilling/sale` | High | Medium |
| Search pagination (Load more) | `getMore` / `hasMore` | Medium | Low |
| Opt-out email link handling | `ApiWrapperQueryHandler` | Medium | Low |
| Report list in Account | `getReportList` (existing) | High | Medium |
| Consistent searchContextKey | `ApiWrapper.searchContextKey` | Low | Low |

---

## Library Download

The latest library has been saved locally at:

```
public/libs/api-wrapper/index.iife.js
```

To use the local copy instead of the CDN, update `public/index.html`:

```html
<!-- Option A: CDN (current) -->
<script src="https://dev1.dev.www.bytecrtrs.com/libs/api-wrapper/index.iife.js"></script>

<!-- Option B: Local copy -->
<script src="/libs/api-wrapper/index.iife.js"></script>
```

Using the local copy allows version control and offline development.

---

**Document Version:** 1.0  
**Last Updated:** January 26, 2025
