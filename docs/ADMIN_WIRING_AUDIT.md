# Admin App — Wiring & Gap Audit
Generated: 2026-04-01 | Source: Static analysis of `src/pages/admin/` + `src/api.js` + `src/services/`

---

## Summary

| Category | Count |
|----------|-------|
| Fully wired to BC API | 8 pages |
| localStorage only (not production-ready) | 5 pages |
| Partially wired (hybrid / missing actions) | 7 pages |
| Tracking API only (read-only analytics) | 3 pages |
| Stub / broken data source | 1 page |

---

## Page-by-Page Status

### ✅ Fully Wired — BC API

| Page | Route | Read | Write |
|------|-------|------|-------|
| **UsersPage** | `/admin/users` | `adminListUsers` — cursor pagination | — |
| **PurchaseDetailPage** | `/admin/purchases/:id` | `adminGetPurchase` | Refund (`adminRefundPurchase`), Cancel/Reactivate (`adminCancelOrder`) |
| **UnsubscribePage** | `/admin/unsubscribe` | `adminListUnsubscribed` | Unsubscribe (`adminUnsubscribeContact`) |
| **PhoneOptOutPage** | `/admin/phone-optout` | `adminListPhoneOptOuts` | Opt Out (`adminUnsubscribePhoneContact`) |
| **EmailSearchPage** | `/admin/email-search` | `adminListUsers({email})` | — |
| **NotesPage** | `/admin/notes` | `adminFindUserContacts` filtered to `userContactAdminNote` | Create (`adminCreateNote`), Update (`adminUpdateNote`) |
| **PaymentsPage** | `/admin/payments` | `adminListPurchases` — flattened `commercePayments` | — |
| **OrdersPage / PurchasesPage** | `/admin/orders` | `adminListOrdersGlobal`, `adminListPurchases` | — |

---

### ⚠️ Partially Wired — Missing Actions or Hybrid Data

#### UserDetailPage — `/admin/users/:id`
- **Read**: ✅ `adminGetUser`, `adminListPurchases({userId})`
- **Write**:
  - ✅ Suspend / Unsuspend — wired to BC
  - ❌ **Password reset** — stub only, renders "Feature coming soon"
  - ❌ **Notes tab** — saves to `localStorage` only; not visible to other admins, lost on clear
- **Missing**: MFA toggle, email verification status, ban/unban

#### DataRemovalPage — `/admin/data-removal`
- **Read**: ✅ `adminListDataRemoval` — BC API
- **Write**:
  - ✅ Approve — wired to BC
  - ❌ **Reject** — no button, no handler, endpoint registered but never called
- **Missing**: Reject action, audit trail, GDPR reporting

#### MailActivityPage — `/admin/mail-log`
- **Read**: ✅ `adminFindUserContacts({userId})` — all contact types shown
- **Write**:
  - ✅ Send CSR mail (`adminCreateCsrMail`) — wired to BC
  - ❌ **Delete / archive mail** — no action exists
- **Missing**: Mail templates, scheduled delivery, bulk messaging

#### EmailBroadcastPage — `/admin/email`
- **Read**: ❌ Email log endpoint marked `newApi: false, mockApi: true` in registry — mock data only
- **Write**:
  - ✅ Send broadcast (`sendEmailBroadcast`) — wired to BC
- **Missing**: Email templates, A/B subject lines, custom audience segmentation, delivery scheduling

#### CsRepManagementPage — `/admin/cs-reps`
- **Read**: ❌ No endpoint to list existing CS reps from BC (BC `/database/search` does not expose role filtering per code comments)
- **Write**:
  - ✅ Create new CS rep — wired to BC
- **Missing**: View / edit / delete existing reps; bulk import; role assignment UI

#### TimesheetsPage — `/admin/timesheets`
- **Read**: ✅ Fetches CS rep list from BC API
- **Write**: ❌ Timesheet hours and status saved to `localStorage` only — **data is lost on browser clear or across devices**
- **Missing**: Server-side timesheet persistence, approval workflow, payroll export

#### AnalyticsPage — `/admin/analytics`
- **Read**:
  - ✅ Tracking API (`/events/summary`) — session and event data
  - ❌ `/admin/analytics` endpoint is **not registered** in `apiEndpointRegistry.js`; falls through to mock or returns empty
- **Write**: None
- **Missing**: Real commerce analytics (revenue, churn, LTV), cohort analysis

---

### ❌ Not Wired — localStorage Only (Prototype State)

All writes on these pages are saved to `localStorage` only. Data is lost on logout, browser clear, or switching devices. No other admin can see changes.

#### PermissionsPage — `/admin/permissions`
- Role × module matrix for Admin / Support / Editor roles
- All saves go to `localStorage('adminPermissions')`
- **Missing**: BC API endpoint for role persistence, server-side enforcement, audit log of changes

#### ContentPage — `/admin/content`
- CRUD for content items (privacy policy, terms of use, etc.)
- All saves go to `localStorage('adminContent')`
- **Missing**: BC API or CMS integration, version history, publish/draft workflow, connection to what users actually see

#### UxManagementPage — `/admin/ux`
- CRUD for UX configs, layouts, collections, components
- All saves go to `localStorage('adminUxManagement')`
- **Missing**: A/B test assignment engine, traffic allocation, results metrics

#### OffersProductsPage — `/admin/offers`
- View / edit stocks, products, and offers
- Seeded from hardcoded data on first load; edits go to `localStorage('adminOffersProducts')`
- **Missing**: Create new items (no create form), delete items, BC commerce API integration, pricing sync

#### EmailTicketsPage — `/admin/tickets`
- Simulated support ticket queue with 3 seed tickets
- Replies and status changes (open / pending / closed) go to `localStorage('adminTickets')`
- **Missing**: Real ticket backend, email gateway, SLA tracking, ticket assignment, notifications

---

### 📊 Tracking API Only — Read-only Analytics

These pages fetch from the local tracking server (`localhost:3002`). They work correctly when `npm run tracking` is running but have no write operations and no BC dependency.

| Page | Route | Notes |
|------|-------|-------|
| **SessionsPage** | `/admin/sessions` | Events grouped by `session_id`; no user identity linking |
| **LogViewerPage** | `/admin/logs` | Raw event accordion; no search or export |
| **UxcHistoryPage** | `/admin/uxc-history` | Events grouped by date; extracts `variant`, `search_type`, offer fields |

**All three pages** degrade gracefully when the tracking server is down (yellow info box shown).

---

## Unimplemented Use-Cases (Cross-Cutting)

### Actions that exist in the UI but do nothing
| Page | UI Element | Status |
|------|-----------|--------|
| UserDetailPage | "Reset password" button | Renders "Feature coming soon" — no API call |
| DataRemovalPage | Reject button | Does not exist in UI; endpoint registered but unused |
| NotesPage | Delete note | No delete button or endpoint |
| PhoneOptOutPage / UnsubscribePage | Re-activate / re-subscribe | No reverse action |
| LogViewerPage | Search bar (header text implies it) | Not implemented |

### Missing features by category

**User management**
- No bulk operations (bulk suspend, bulk message, bulk export)
- No MFA toggle per user
- Password reset email not implemented
- No ban/unban action separate from suspend

**Order & payments**
- Global order list limited to 10 most recent (hardcoded)
- No search by order ID
- No date-range filtering on orders or payments
- No payment reconciliation or dispute tracking
- No CSV/Excel export

**Compliance**
- Reject action missing from DataRemovalPage
- No audit log of admin actions (who approved what, when)
- No GDPR compliance export

**Communications**
- Email broadcast log shows mock data
- No email templates for broadcast
- No custom audience segmentation
- Ticket system is a prototype with no real email gateway

**Configuration**
- Permissions matrix not enforced server-side
- Content edits not served to end users
- Offers / products not synced to commerce system
- UX configs have no connection to A/B testing engine

**Observability**
- Analytics page business metrics (revenue, churn) use unregistered mock endpoint
- Tracking pages require a separately running service
- No data export from any analytics page

---

## Risk Areas

| Risk | Affected Pages | Severity |
|------|---------------|----------|
| localStorage data loss on clear/logout | PermissionsPage, ContentPage, OffersProductsPage, UxManagementPage, EmailTicketsPage, UserDetailPage (notes), TimesheetsPage (hours) | High |
| Optimistic updates with no rollback | DataRemovalPage, UnsubscribePage, PhoneOptOutPage | Medium |
| Mock data surfaced in production UI | EmailBroadcastPage (log), AnalyticsPage (metrics) | Medium |
| BC CSR list unavailable — empty state with no fallback | CsRepManagementPage, TimesheetsPage | Medium |
| Tracking server required for 3 admin pages | SessionsPage, LogViewerPage, UxcHistoryPage | Low (graceful degradation exists) |
