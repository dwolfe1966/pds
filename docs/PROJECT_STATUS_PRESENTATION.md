# IDLookup.AI — Development Status Report
**Date:** April 8, 2026
**Prepared for:** Stakeholder Presentation

---

## Executive Summary

Over the past month (March 8 – April 8, 2026), the IDLookup.AI platform has progressed from an early prototype to a production-deployed consumer app and a functional admin/CS tool. The team delivered 64 commits across 5 development sprints covering both the consumer-facing people search application and the internal administration dashboard.

**Consumer app** — Live at `dev.www.idlookup.ai`. Core search-to-purchase flow complete. All authentication, search, report generation, and billing integrated with ByteCrtrs (BC) API.

**Admin app** — Live at `dev.www.bytecrtrs.com/admin`. Customer management, order management, refunds, opt-outs, notes, and CS rep tools all wired to BC API. Ready for CS team onboarding.

---

## Sprint History

### Sprint 1 (Mar 8–15): Consumer App — Search & API Integration
**Focus:** Replace mock API with real ByteCrtrs integration for search

**Completed:**
- Migrated from mock teaser search to BC `idLookup.searchTeaser` API
- Implemented name, phone, and email search types with correct `contextKey` values
- Built report detail page with `createReport` / `getReport` integration
- Fixed BC API response shape normalization (`apiAdapter.js`)
- Resolved IIFE library loading issues (local copy vs CDN)
- Added proxy CORS handling for development (`server/index.js`)

### Sprint 2 (Mar 16–23): Consumer App — Payment, Auth & Member Experience
**Focus:** End-to-end signup/payment flow and member dashboard

**Completed:**
- Integrated `commerceBilling.sale` for payment processing
- Built signup flow with password complexity validation
- Fixed billing sale error detection and `billingSeriesId` format
- Implemented JWT auth flow with `AuthContext` (login, logout, token refresh)
- Built member dashboard, account page, and search history
- Created 8 visitor search result preview variants (A/B testing: 1/2/3/a/b/c/d/e)
- Payment page design improvements
- Visitor-to-member-to-paid transition flows
- Added subscription status checking (`getUserOrders`)
- Built proxy fallback for missing IIFE methods

### Sprint 3 (Mar 24–30): Admin App Foundation & Proxy Fixes
**Focus:** Stand up admin app, fix production auth issues

**Completed:**
- Built standalone admin app with separate entry point (`admin-index.js`, `AdminApp.js`)
- Separate build pipeline (`npm run build:admin`) with own env config
- Admin login via BC API with role-based access control
- Customer Directory page (UsersPage) with BC `database/search` integration
- Cursor-based pagination (Load More, 10 per page via `lastId`)
- Fixed 3 critical proxy cookie bugs:
  - Duplicate `connect.sid` causing 403 errors
  - Stale session cookies forwarded on login
  - Login response poisoning cookie store
- Fixed BC `/database/search` requiring `collectionName` parameter
- Resolved BC response shape (`{ docs, noMoreDocs }` not `raws/users`)

### Sprint 4 (Mar 31 – Apr 4): Production Deployment & Consumer Polish
**Focus:** Get both apps deployed and fix production-specific issues

**Completed:**
- **Production login fix** — password in `billing.sale` + `changePassword` after signup
- Password complexity validation on all signup forms
- Proxy Origin/Referer spoofing fix (skip for `/auth/login`)
- Proxy 412 captcha auto-retry with `captchaPass`
- Google Tag Manager integration (GTM snippet + `dataLayer` pageview/conversion events)
- CS support messaging in footer (email + hours)
- Member search enhancement: city + age range fields for name search
- PDF download confirmed working (`downloadPdfReport`)
- Standalone admin build with landing page and login
- Admin login investigation — BC returning 401 (credential verification needed)

### Sprint 5 (Apr 5–8): Admin App Build-Out & CS Feature Requests
**Focus:** Full admin functionality, deployment to BC domain, CS team requirements

**Completed:**
- **Admin deployment to `dev.www.bytecrtrs.com/admin`** — resolved:
  - Parcel `--public-url /admin/` for correct asset paths
  - React Router `basename="/admin"` for route handling
  - Git Bash path mangling on Windows (`MSYS_NO_PATHCONV`)
  - MIME type issues (`type="module"` → classic script)
  - HTTP vs HTTPS CORS (API URL must match page protocol)
  - IIFE `import.meta` incompatibility with classic scripts
- **Customer Directory enhancements:**
  - Server-side search by email (BC API)
  - Client-side instant filters: phone, zip, last 4 CC
  - Advanced Search collapsible panel
  - Zip and CC columns in table/card views
  - Nav bar customer search input
- **Customer Profile enrichment:**
  - All emails and phones (arrays)
  - Registered device type and IP address
  - Last active / login timestamp
  - Minimized User ID (last 8 chars with copy button)
- **Orders & Payments combined tab** — expandable order cards with inline payment details
- **Multi-order refund system:**
  - Per-payment refund button with inline form (partial/full, refund/void)
  - "Refund All" batch refund per order with confirmation modal
  - Cancel / Reactivate order controls
  - All wired to BC `refundVoidOrder` and `cancelUncancelOrder` APIs
- **Payments, Logins, Activity tabs** on customer profile
- **Combined Opt-Outs page** — data removal requests + phone opt-outs in tabbed view
- **CS Rep Management** — create + update forms with password validation
- **Notes wired to BC API** — replaced localStorage with `createAdminNote` / `findUserContacts`
- **Navigation simplification** — reduced from 20 to 14 nav items, combined related pages
- **Critical bug fix**: 8 admin endpoints missing from `FORCE_NEW_API_ENDPOINTS` (would silently fail in production)
- **Wired 6 new BC CSR endpoints**: `findOrderPayments`, `findOrderHistories`, `getOrder`, `updateScheduleDueTimestamp`, `cancelUncancelOrder`, `refundVoidOrder`
- Dead file cleanup (14 orphaned files removed)
- "Local data only" banners on prototype pages
- **BC API spec document** created for 5 features needing server-side endpoints

---

## Current Architecture

```
Consumer App (dev.www.idlookup.ai)
├── React 18 + React Router v6 + Parcel 2
├── Three route tiers: Sales (public) → Member (JWT) → Admin (role)
├── BC API via IIFE library (browser-side, handles captcha)
├── Express proxy for local dev (CORS bypass)
└── Tracking API (NDJSON event store)

Admin App (dev.www.bytecrtrs.com/admin)
├── Same React codebase, separate Parcel entry point
├── basename="/admin" on BrowserRouter
├── BC CSR API via apiWrapper._csrPost() (direct, no proxy)
├── 20+ BC endpoints wired (user mgmt, orders, payments, refunds, notes, opt-outs)
└── Classic script mode (no ES modules) for BC server compatibility
```

---

## Completed Features — Consumer App

| Feature | BC API Integration | Status |
|---------|-------------------|--------|
| Name/phone/email people search | `idLookup.searchTeaser` | Live |
| Search results with pagination | `getMore()`, `hasMore()` | Live |
| Report generation | `idLookup.createReport` | Live |
| Report detail (10 sections) | `idLookup.getReport` | Live |
| PDF report download | `idLookup.downloadPdfReport` | Live |
| Saved reports list | `idLookup.getReports` | Live |
| Signup + payment | `commerceBilling.sale` | Live |
| Login / logout / session | `auth.login`, `auth.logout` | Live |
| Member dashboard | `getUserOrders` (subscription check) | Live |
| Member search (city + age range) | Params passed to BC | Live |
| Password complexity validation | Client-side | Live |
| 8 search preview variants (A/B) | N/A | Live |
| Google Tag Manager | GTM `dataLayer` events | Live (needs GTM ID) |
| CS support messaging in footer | N/A | Live |

## Completed Features — Admin App

| Feature | BC API | Status |
|---------|--------|--------|
| Admin login | `auth.login` (CSR role) | Live |
| Customer Directory (list, search, filter) | `user.find` (email search) | Live |
| Customer Profile (enriched) | `user.getUserDetail` | Live |
| Orders & Payments (combined, expandable) | `user.findOrders`, `findOrderPayments` | Live |
| Single payment refund (partial/full) | `user.refundVoidOrder` | Live |
| Batch refund (all payments per order) | `user.refundVoidOrder` (sequential) | Live |
| Void payment | `user.refundVoidOrder` (type: void) | Live |
| Cancel / Reactivate order | `user.cancelUncancelOrder` | Live |
| Order payment history | `user.findOrderPayments` | Live |
| Order status history | `user.findOrderHistories` | Live |
| Admin notes on customer profile | `user.createAdminNote`, `findUserContacts` | Live |
| Data removal / opt-out requests | `optOut.find` | Live |
| Phone opt-outs | `managedContact.find`, `unsubscribe` | Live |
| Unsubscribe management | `managedContact.find`, `unsubscribe` | Live |
| CS Rep creation | `user.create` (roles: ['csr']) | Live |
| CS Rep update by ID | `user.update` | Live |
| Customer search from nav bar | Routes to Customer Directory | Live |
| Session/Activity tracking | Local tracking API | Live |

### Admin Pages — Local Data Only (Prototype)
These pages work but use browser localStorage. Data does not persist across devices.

| Page | Waiting On |
|------|-----------|
| Offers & Products | BC API (spec sent) |
| Content & UX Management | BC API (spec sent) |
| Permissions Matrix | BC API (spec sent) |
| Email Tickets | BC API (spec sent) |

---

## Remaining Tasks

### Consumer App

| Task | Effort | Blocker |
|------|--------|---------|
| Report detail data enrichment (add more BC fields) | Medium | Need to inspect raw BC response for available fields |
| Opt-out email link handler (`ApiWrapperQueryHandler`) | Small | None |
| Tracking integration (connect to tracking API) | Medium | None |
| Set GTM container ID in `.env.production` | Trivial | Need GTM container created |

### Admin App — Ready to Build

| Task | Effort | Blocker |
|------|--------|---------|
| Multi-order refunds from Purchases page (not just profile) | Small | None |
| Analytics page — replace mock endpoint with tracking API | Small | None |
| Email Broadcast — wire to BC `createCsrMail` | Medium | None |

### Admin App — Blocked on Business Decisions

| Task | Decision Needed |
|------|----------------|
| Agent account access / impersonation | Scope: read-only vs full access? Impersonation vs side-panel? |
| Immediate refunds (no mailed application) | Policy: auto-approve or require manual review? |
| Agent-initiated orders (downsell) | What offer types? Pricing rules? Approval flow? |

### Admin App — Blocked on ByteCrtrs API

| Task | BC Endpoint Needed | Priority |
|------|-------------------|----------|
| Opt-out approval | `optOut.approve` or equivalent | P0 |
| Support tickets (persistent) | `ticket.find`, `ticket.reply`, `ticket.updateStatus` | P1 |
| Content management (persistent) | `content.find`, `content.create`, `content.update`, `content.remove` | P1 |
| Permissions (persistent) | `permissions.get`, `permissions.update` | P2 |
| Offers/Products read access | `commerce.findStocks`, `findProducts`, `findOffers` | P2 |
| CS Rep listing by role | BC `database/search` role filter support | P2 |

**API spec document sent to BC team:** `docs/BC_ADMIN_API_SPEC_REQUEST.md`

### Tech Debt

| Item | Effort |
|------|--------|
| DataRemoval approve button disabled (no BC endpoint) | Blocked on BC |
| CS Rep page can't list reps (BC doesn't filter by role) | Blocked on BC |
| Email Broadcast send/log hits mock server | Medium |
| Analytics page `/admin/analytics` endpoint is mock-only | Small |
| Consumer app local dev may need `.env` verification | Trivial |

---

## Deployment Summary

| Environment | URL | Status |
|-------------|-----|--------|
| Consumer (production) | `https://dev.www.idlookup.ai` | Live, functional |
| Consumer (local dev) | `http://localhost:3000` | Mock search/auth |
| Admin (production) | `https://dev.www.bytecrtrs.com/admin` | Live, functional |
| Admin (local dev) | `http://localhost:3003` | Requires BC proxy |
| Mock API server | `http://localhost:3001` | Dev only |
| Tracking API | `http://localhost:3002` | Dev only |

---

## Key Metrics

- **64 commits** in 30 days
- **20+ BC CSR API endpoints** integrated
- **14 admin pages** functional (10 BC-wired, 4 prototype)
- **10 report detail sections** displaying BC data
- **8 search preview A/B variants** for conversion testing
- **3 route tiers** (public, member, admin) with JWT protection
- **0 external dependencies** beyond React, React Router, and BC IIFE library
