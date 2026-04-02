# Admin Tool Backlog
Generated: 2026-03-30 | Source: Gap analysis between `/docs/admin designs/` specs and `/src/pages/admin/` implementation

---

## Priority 1 — Core CSR Workflows

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 1 | ~~**Customer Directory**~~ | ✅ Done — card grid layout, status badges, shimmer skeleton, cursor pagination | customers-v2.html |
| 2 | ~~**User Detail — Communications**~~ | ✅ Done — two-column layout, Transactions/Notes/Actions tabs, Toast | communications-v2.html |
| 3 | ~~**Email Search**~~ | ✅ Done — `/admin/email-search`, email lookup → customer card | email-search-v2.html |
| 4 | ~~**Notes Management**~~ | ✅ Done — `/admin/notes`, localStorage CRUD, search/filter | manage-notes-v2.html |
| 5 | ~~**Order Management (global)**~~ | ✅ Done — `/admin/orders`, filter sidebar, table with Load more pagination | orders-v2.html |
| 6 | ~~**Payment Records**~~ | ✅ Done — `/admin/payments`, flattens commercePayments from orders, filter sidebar | payments-v2.html |

---

## Priority 2 — Compliance & Opt-Out Management

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 7 | ~~**User Opt-Out Management**~~ | ✅ Done — stats bar, filters, Approve action | opt-user-v2.html |
| 8 | ~~**Unsubscribe List**~~ | ✅ Done — `/admin/unsubscribe`, email/phone search, Remove button | unsubscribe-v2.html |
| 9 | ~~**Phone Opt-Outs**~~ | ✅ Done — `/admin/phone-optout`, phone search, status filter, Remove button | opt-phone-v2.html |

---

## Priority 3 — Support & Email Tools

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 10 | ~~**Email Tickets**~~ | ✅ Done — `/admin/tickets`, two-panel layout, localStorage threads, reply + close/reopen | emails-v2.html |
| 11 | ~~**Mail Activity Log**~~ | ✅ Done — `/admin/mail-log`, card layout, per-recipient Unsubscribe action | mail-sent-v2.html |
| 12 | ~~**Support Timesheets**~~ | ✅ Done — `/admin/timesheets`, BC CS reps + localStorage hours per week, week selector | timesheets-v2.html |

---

## Priority 4 — Admin Configuration

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 13 | ~~**Permissions Matrix**~~ | ✅ Done — `/admin/permissions`, role×module matrix, localStorage, reset to defaults | permissions-v2.html |
| 14 | ~~**Content Management**~~ | ✅ Done — `/admin/content`, tabbed Items+Editor, localStorage CRUD, search, toast | content-v2.html |
| 15 | ~~**Offers & Products**~~ | ✅ Done — `/admin/offers`, localStorage seeded, stats bar, item browser + detail panel, edit modal | offers-products-v2.html |

---

## Priority 5 — Analytics & Debugging

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 16 | ~~**Activity/Session Tracking**~~ | ✅ Done — `/admin/sessions`, tracking API events grouped by session, accordion, stats | tracking-v2.html |
| 17 | ~~**Log Viewer**~~ | ✅ Done — `/admin/logs`, tracking API raw events, collapsible request/response JSON | logs-v2.html |
| 18 | ~~**UX Management Dashboard**~~ | ✅ Done — `/admin/ux`, localStorage accordion CRUD (Configs/Layouts/Collections/Components) | ux-management-v2.html |
| 19 | ~~**UXC History**~~ | ✅ Done — `/admin/uxc-history`, tracking API events by date accordion, stats, session filter | uxc-history-v2.html |

---

## Existing Pages — Known Gaps to Fix

| Page | Specific Gaps |
|------|--------------|
| **AdminNav** | Missing links: Customers (card view), Orders, Payments, OptOut, Permissions, Content |
| **UsersPage** | No search input, no status filter dropdown |
| **UserDetailPage** | No transactions panel, no notes, no recommended actions, no email compose |
| **DataRemovalPage** | No stats (Total/Approved/Pending counts), no Approve action |
| **AnalyticsPage** | Metrics don't match spec (spec wants sessions/unique users/locations) |

---

## Implementation Notes

### API Routing
All new admin endpoints must be registered in three places:
1. `src/services/apiEndpointRegistry.js` — whitelist entry with `{ newApi: true, mockApi: false }`
2. `src/api.js` — pathMap entry
3. `src/services/apiRouter.js` — both `callNewAPI` case and `getMockAPIPath` entry

### BC API Calls
Admin pages use `apiWrapper.csr*` methods. BC CSR responses wrap lists in `{ docs: [...], noMoreDocs: bool }`.
Pagination uses `lastId` cursor (not page numbers).

### Auth
Admin routes require `user.role === 'admin'`. Protected by `ProtectedRoute` in `src/App.js`.
CSR session token is a BC synthetic token — mock server returns 401 for these; check `err.isMockUnavailable` and show empty state.

### Design Specs Location
All HTML design specs: `docs/admin designs/*.html`
