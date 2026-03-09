# ByteCrtrs API Update Analysis & Execution Plan

**Date:** January 26, 2025  
**Library Source:** `https://dev1.dev.www.bytecrtrs.com/libs/api-wrapper/index.iife.js`  
**Local Copy:** `public/libs/api-wrapper/index.iife.js`  
**Reference Doc:** [Google Sheets](https://docs.google.com/spreadsheets/d/1R7fE5Jp4TNt14BlwsbTqpxpUwNh1BxihGhfXqn0qNpQ/edit?gid=49291190#gid=49291190) *(requires sign-in; not publicly accessible)*

---

## Note on API Documentation

The Google Sheets API document requires sign-in and is not publicly accessible. This analysis is based on:

1. **Live library** fetched from the ByteCrtrs CDN
2. **Local CSV spec** (`docs/new-api/bc client library - API.csv`)
3. **Current codebase** integration status

**If you have access to the Google Sheets doc and it contains updates not reflected here, please share the contents (export, screenshot, or copy-paste) so this analysis can be updated.**

---

## Part 1: API Changes (vs Original CSV Spec)

### 1.1 New Endpoints (Not in Original CSV)

| Endpoint | Method | Purpose | Library Method | Implemented |
|----------|--------|---------|----------------|-------------|
| `/optOut/search` | POST | Check opt-out status before submitting request | `api.optOut.search` | ✅ Yes |
| `/commerceBilling/sale` | POST | Process payment/sale (billing) | `api.billing.sale` | ✅ Yes |
| `/idLookup/report/pdf/:commerceContentId` | GET | Download report as PDF | `api.idLookup.downloadPdfReport` | ❌ No |

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

| Feature | Description | Implemented |
|---------|-------------|-------------|
| **Search pagination** | `hasMore()`, `getMore()`, `getTotalCount()` on teaser search responses | ✅ Yes |
| **searchContextKey** | Structured keys (e.g. `sale.name.teaser`, `member.phone.report`) | ✅ Yes |
| **Opt-out query handler** | URL params `awqh[type]`, `awqh[value]` for email confirmation links | ❌ No |
| **Built-in modals** | Turnstile, prompt, message, confirmation | Partial (library uses internally) |
| **Captcha handling** | 412 → captcha flow → retry with `x-captcha-id` | ✅ Yes (via proxy) |
| **Billing sale** | `api.billing.sale()` with auto `billingSeriesId` | ✅ Yes |
| **PDF download** | `api.idLookup.downloadPdfReport()` with confirmation modal | ❌ No |

---

## Part 2: Use Cases & Pages We Can Implement

### 2.1 PDF Report Download (NEW – Not Yet Implemented)

**API:** `GET /idLookup/report/pdf/:commerceContentId`  
**Library:** `api.idLookup.downloadPdfReport({ commerceContentId })`

**Use case:** Allow users to download a purchased report as a PDF file.

**Pages to implement:**
- **SearchResultDetailPage** (`/people/:id`) – Add "Download PDF" button on report detail view
- **AccountPage** – Add "Download PDF" on each report in the report list
- **DashboardHome** – Add "Download PDF" on recent reports in activity feed

**Flow:**
1. User clicks "Download PDF"
2. Library shows confirmation modal: "Would you like to download the PDF?"
3. On confirm, GET request returns blob; library triggers browser download with `x-pdf-file-name` header

---

### 2.2 Opt-Out Email Link Handler (NOT YET IMPLEMENTED)

**API:** Uses `GET /optOut/confirmation` with `value` param  
**Library:** `ApiWrapperQueryHandler.getHandler()` + `ApiWrapperQueryHandlerConfirmationOptOut.execute()`

**Use case:** User receives email with opt-out confirmation link. Clicking the link opens the app; the library auto-detects `?awqh[type]=confirmationRequestOptOut&awqh[value]=<token>` and runs the confirmation flow.

**Pages:**
- **Opt-out route** – Ensure `/opt-out` (or equivalent) is the landing page for email links
- **App.js** – The library binds to `DOMContentLoaded` and auto-runs handlers. If our SPA loads after DOMContentLoaded, we may need to manually call `ApiWrapperQueryHandler.getHandler()` on route load when URL has these params.

**Flow:**
1. User clicks link: `https://yoursite.com/opt-out?awqh[type]=confirmationRequestOptOut&awqh[value]=<token>`
2. Library detects params, shows "Would you like to opt out?" modal
3. On confirm, calls `optOut.confirmation({ value })`, shows success/failure message, removes query params from URL

---

### 2.3 Already Implemented Use Cases

| Use Case | API | Pages | Status |
|----------|-----|-------|--------|
| Opt-out search before request | `optOut/search` | OptOutSearchResultsPage | ✅ Done |
| Real payment processing | `commerceBilling/sale` | PaymentPage | ✅ Done |
| Search pagination (Load more) | `getMore` / `hasMore` | SearchResultsPage (sales & member) | ✅ Done |
| Report list for members | `report/list` | DashboardHome, AccountPage | ✅ Done |
| Consistent searchContextKey | `ApiWrapper.searchContextKey` | reportService, searchContext | ✅ Done |

---

## Part 3: Execution Plan

### Phase 1: PDF Download (High Value, Low Effort)

**Priority:** High  
**Effort:** Low  
**Dependencies:** None

| Step | Task | Files |
|------|------|-------|
| 1.1 | Add `downloadPdfReport` to apiWrapper.js | `src/services/apiWrapper.js` |
| 1.2 | Add `report-pdf-download` to apiEndpointRegistry.js | `src/services/apiEndpointRegistry.js` |
| 1.3 | Add route in apiRouter.js for PDF download | `src/services/apiRouter.js` |
| 1.4 | Add `downloadReportPdf` to api.js | `src/api.js` |
| 1.5 | Add `downloadReportPdf` to reportService.js | `src/services/reportService.js` |
| 1.6 | Add "Download PDF" button to SearchResultDetailPage | `src/pages/member/SearchResultDetailPage.js` |
| 1.7 | Add "Download PDF" to report cards in DashboardHome & AccountPage | `src/pages/member/DashboardHome.js`, `src/pages/member/AccountPage.js` |

**Proxy:** The generic `/api/proxy/*` already forwards all paths; `/idLookup/report/pdf/:id` will work without server changes. Ensure `responseType: 'blob'` is used and `x-pdf-file-name` is forwarded.

---

### Phase 2: Opt-Out Email Link Handler (Medium Value, Low Effort)

**Priority:** Medium  
**Effort:** Low  
**Dependencies:** Opt-out route must exist

| Step | Task | Files |
|------|------|-------|
| 2.1 | Verify opt-out route exists (e.g. `/opt-out`) | `src/App.js` |
| 2.2 | On opt-out route mount, call `ApiWrapperQueryHandler.getHandler()` | `src/pages/sales/OptOutLandingPage.js` or `OptOutSearchResultsPage.js` |
| 2.3 | If handler exists, execute with `{ api: wrapper.api }` before rendering page content | Same |
| 2.4 | Document email link format for backend/email team | `docs/OPT_OUT_EMAIL_LINK.md` |

**Note:** The library already binds to `DOMContentLoaded`. If the SPA loads the opt-out page after DOMContentLoaded, the handler may run before React mounts. We should also run it on route entry to cover SPA navigation.

---

### Phase 3: Verification & Testing

| Step | Task |
|------|------|
| 3.1 | Test PDF download on report detail page (member flow) |
| 3.2 | Test PDF download from Dashboard/Account report list |
| 3.3 | Test opt-out email link with `?awqh[type]=confirmationRequestOptOut&awqh[value]=<test-token>` |
| 3.4 | Verify proxy forwards blob responses and `x-pdf-file-name` header |

---

## Summary Table

| Use Case | New API Addition | Priority | Effort | Status |
|----------|------------------|----------|--------|--------|
| Opt-out search before request | `optOut/search` | Medium | Low | ✅ Done |
| Real payment processing | `commerceBilling/sale` | High | Medium | ✅ Done |
| Search pagination (Load more) | `getMore` / `hasMore` | Medium | Low | ✅ Done |
| Report list in Account/Dashboard | `report/list` | High | Medium | ✅ Done |
| Consistent searchContextKey | `ApiWrapper.searchContextKey` | Low | Low | ✅ Done |
| **PDF report download** | `idLookup/report/pdf` | **High** | **Low** | ❌ **TODO** |
| **Opt-out email link handling** | `ApiWrapperQueryHandler` | **Medium** | **Low** | ❌ **TODO** |

---

## Next Steps

1. **Implement Phase 1 (PDF Download)** – Highest impact, minimal effort.
2. **Implement Phase 2 (Opt-Out Email Link)** – Improves opt-out UX for email flows.
3. **Sync with Google Sheets doc** – If the doc has additional endpoints or parameter changes, update this analysis and execution plan.

---

**Document Version:** 2.0  
**Last Updated:** January 26, 2025
