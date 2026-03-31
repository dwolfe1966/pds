# Admin Tool Backlog
Generated: 2026-03-30 | Source: Gap analysis between `/docs/admin designs/` specs and `/src/pages/admin/` implementation

---

## Priority 1 — Core CSR Workflows

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 1 | **Customer Directory** | Existing Users page is a plain table; spec shows card layout with status filter, email search, and masked card number | customers-v2.html |
| 2 | **User Detail — Communications** | Current UserDetailPage is minimal; spec requires notes/history, recommended actions (refund/email/cancel checkboxes), and inline email compose | communications-v2.html |
| 3 | **Email Search** | No dedicated CSR email lookup tool; spec is a simple email + brand search that returns subscription details | email-search-v2.html |
| 4 | **Notes Management** | No notes system at all; spec shows create/search/edit notes linked to customer accounts | manage-notes-v2.html |
| 5 | **Order Management (global)** | PurchasesPage only shows orders per-user; spec requires a standalone global order list with ID/status/type filter sidebar | orders-v2.html |
| 6 | **Payment Records** | PurchaseDetailPage shows payments for one order only; spec requires a global payment list with filter by status/type/ID | payments-v2.html |

---

## Priority 2 — Compliance & Opt-Out Management

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 7 | **User Opt-Out Management** | DataRemovalPage exists but is a basic list; spec requires stats (Total/Approved/Pending), filter panel, and Approve action buttons | opt-user-v2.html |
| 8 | **Unsubscribe List** | Completely missing; search by email or phone, view joined/left dates, Remove button | unsubscribe-v2.html |
| 9 | **Phone Opt-Outs** | Completely missing; phone number list with Active/Inactive status and Remove button | opt-phone-v2.html |

---

## Priority 3 — Support & Email Tools

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 10 | **Email Tickets** | EmailBroadcastPage is one-way only; spec requires a full support ticket system with open/closed status, two-panel layout, and reply functionality | emails-v2.html |
| 11 | **Mail Activity Log** | EmailBroadcastPage has a basic log table; spec requires per-email cards with Mail ID, recipient, status, and Unsubscribe action | mail-sent-v2.html |
| 12 | **Support Timesheets** | Completely missing; staff hours/status tracking with weekly view | timesheets-v2.html |

---

## Priority 4 — Admin Configuration

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 13 | **Permissions Matrix** | Completely missing; role (Admin/Support/Editor) × module (Customers/Orders/Payments/Content) permission assignment | permissions-v2.html |
| 14 | **Content Management** | Completely missing; tabbed Items list + Editor for creating/editing content blocks | content-v2.html |
| 15 | **Offers & Products** | Completely missing; stats, select-item browser, detail panel for stocks/products/offers | offers-products-v2.html |

---

## Priority 5 — Analytics & Debugging

| # | Feature | Gap | Source Spec |
|---|---------|-----|-------------|
| 16 | **Activity/Session Tracking** | SessionsPage is a stub; spec requires session hash accordion with per-endpoint activity log | tracking-v2.html |
| 17 | **Log Viewer** | Completely missing; collapsible API call log with request/response JSON | logs-v2.html |
| 18 | **UX Management Dashboard** | Completely missing; manage UX configs, layouts, collections, components | ux-management-v2.html |
| 19 | **UXC History** | Completely missing; stats + date accordion showing which UX configs were shown per session | uxc-history-v2.html |

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
