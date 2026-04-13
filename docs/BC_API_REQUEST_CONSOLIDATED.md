# ByteCrtrs API Request — Consolidated Endpoint Requirements

**Date:** April 13, 2026
**From:** IDLookup Development Team (David Wolfe)
**To:** ByteCrtrs (Kwan)

This document consolidates ALL new API endpoints needed for the IDLookup.AI consumer app and admin/CS app. The front-end UI for these features is already built and deployed — we need the backend endpoints to replace our mocked data.

IDLookup will also develop a fallback API backend so we're not blocked. When BC delivers endpoints, we'll switch via feature flags.

---

## Endpoint Summary

**38 total endpoints requested across 11 feature areas:**

| # | Area | Endpoints | Priority | App |
|---|------|-----------|----------|-----|
| 1 | Who's Watching You (Searchers) | 3 | P1 | Consumer |
| 2 | Who's Watching You (Viewers) | 3 | P1 | Consumer |
| 3 | Data Broker Removal | 5 | P1 | Consumer |
| 4 | Privacy Exposure Score | 2 | P1 | Consumer |
| 5 | Saved Searches & Watchlist | 5 | P2 | Consumer |
| 6 | Records Found Feed | 1 | P2 | Consumer |
| 7 | Opt-Out Approval | 1 | P0 | Admin |
| 8 | Finance Email Routing | 1 | P0 | Admin |
| 9 | Support Tickets | 4 | P1 | Admin |
| 10 | Content Management (CMS) | 4 | P1 | Admin |
| 11 | Admin Data Gaps (incl. impersonation) | 9 | P1-P3 | Admin |

### Quick Reference — All Endpoints

**Consumer (Member-Facing) — 19 endpoints:**
```
GET  /api/v1/me/watchers/searchers          — List people who searched for me
GET  /api/v1/me/watchers/viewers            — List people who viewed my profile
GET  /api/v1/me/watchers/stats              — Aggregated search/view stats + trends
POST /api/v1/profile-views                  — Record a profile view (write)
POST /api/v1/profile-searches               — Record a search match (write)
GET  /api/v1/me/broker-exposure             — Get data broker exposure status
POST /api/v1/me/broker-exposure/:id/request — Request removal from a broker
POST /api/v1/me/broker-exposure/:id/cancel  — Cancel a removal request
GET  /api/v1/me/broker-exposure/history     — Removal timeline events
POST /api/v1/me/broker-exposure/scan        — Trigger a fresh broker scan
GET  /api/v1/me/exposure-score              — Get privacy score + factors
GET  /api/v1/me/exposure-score/history      — Score trend over time
GET  /api/v1/me/searches                    — Get search history
POST /api/v1/me/watchlist                   — Add person to watchlist
GET  /api/v1/me/watchlist                   — Get watchlist
DELETE /api/v1/me/watchlist/:id             — Remove from watchlist
GET  /api/v1/me/watchlist/alerts            — Get watchlist change alerts
GET  /api/v1/me/records-feed                — Get "new records found" feed
POST /api/v1/contact                        — Submit contact form (exists, confirm working)
```

**Admin (CSR-Facing) — 18 endpoints:**
```
POST /api/optOut/management/approve         — Approve an opt-out request
POST /api/admin/finance-email               — Route billing request to finance
POST /api/database/search (tickets)         — Find support tickets
POST /api/ticket/management/detail          — Get ticket with messages
POST /api/ticket/management/reply           — Reply to ticket
POST /api/ticket/management/updateStatus    — Update ticket status
POST /api/database/search (content)         — Find content blocks
POST /api/content/management/create         — Create content block
POST /api/content/management/update         — Update content block
POST /api/content/management/remove         — Delete content block
POST /api/permissions/management/get        — Get role permissions matrix
POST /api/permissions/management/update     — Update role permissions
POST /api/database/search (stocks)          — Find commerce stocks
POST /api/database/search (products)        — Find commerce products
POST /api/database/search (offers)          — Find commerce offers
POST /api/user/management/impersonate       — Login as user (agent impersonation)
POST /api/admin/cs-reps/find                — List CS reps by role
GET  /api/admin/users/:id/login-history     — User login history
GET  /api/admin/users/:id/activity          — User activity log
```

---

## 1. Who's Watching You — Searchers

**Product:** Members see who has been searching for their name/phone/email. Free members see obfuscated data. Paid members see full details.

**UI status:** Built and deployed at `/who-is-searching` (tab: Searchers)

### 1a. Get Searchers
`GET /api/v1/me/watchers/searchers`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | ISO 8601 | No | Start date filter |
| `to` | ISO 8601 | No | End date filter |
| `limit` | int | No | Default 50, max 200 |
| `cursor` | string | No | Pagination (lastId) |
| `sort` | string | No | `newest` / `oldest` / `name` |
| `tier` | string | No | Filter: `pro` / `basic` / `visitor` |
| `searchType` | string | No | Filter: `name` / `phone` / `email` / `address` |

**Response:**
```json
{
  "docs": [
    {
      "_id": "evt_abc123",
      "timestamp": "2026-04-09T14:32:11Z",
      "searcher": {
        "firstName": "Jane",
        "lastInitial": "S",
        "city": "Los Angeles",
        "state": "CA",
        "tier": "basic"
      },
      "searchType": "name",
      "matched": true
    }
  ],
  "noMoreDocs": false,
  "nextCursor": "evt_abc124"
}
```

### 1b. Record a Search Match (Write)
`POST /api/v1/profile-searches`

Called when a search query matches a registered user. Used to populate the searchers list.

```json
{
  "searchType": "name",
  "query": { "firstName": "John", "lastName": "Smith", "state": "CA" },
  "matchedTargetUserIds": ["user_xyz"]
}
```
**Response:** `{ "success": true, "searchId": "search_abc" }`

---

## 2. Who's Watching You — Viewers

**Product:** Members see who opened their full profile/report.

**UI status:** Built and deployed at `/who-is-searching` (tab: Viewers)

### 2a. Get Viewers
`GET /api/v1/me/watchers/viewers`

Same params as 1a (searchers), plus:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `minSectionsViewed` | int | No | Filter by engagement depth |

**Response:**
```json
{
  "docs": [
    {
      "_id": "view_xyz",
      "timestamp": "2026-04-08T09:15:00Z",
      "viewer": {
        "firstName": "Mike",
        "lastInitial": "R",
        "city": "Dallas",
        "state": "TX",
        "tier": "pro"
      },
      "sectionsViewed": ["personal", "addresses", "phones"],
      "sectionsCount": 3,
      "durationSeconds": 187
    }
  ],
  "noMoreDocs": false
}
```

### 2b. Record a Profile View (Write)
`POST /api/v1/profile-views`

Called when a member views another person's report. This endpoint partially exists in our app already.

```json
{
  "targetUserId": "user_xyz",
  "targetCommerceContentId": "report_abc",
  "sectionsViewed": ["personal", "addresses"],
  "source": "member-search"
}
```
**Response:** `{ "success": true, "viewId": "view_abc" }`

### 2c. Get Watching Stats (Aggregated)
`GET /api/v1/me/watchers/stats`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `30d` | `7d` / `30d` / `90d` / `1y` / `all` |

**Response:**
```json
{
  "searchers": {
    "total": 147,
    "thisMonth": 42, "lastMonth": 38,
    "thisWeek": 11, "lastWeek": 9,
    "byType": { "name": 24, "phone": 8, "email": 6, "address": 4 },
    "byTier": { "pro": 6, "basic": 28, "visitor": 8 },
    "trend": [{ "date": "2026-03-11", "count": 2 }]
  },
  "viewers": {
    "total": 68,
    "thisMonth": 21, "lastMonth": 19,
    "thisWeek": 5, "lastWeek": 4,
    "byTier": { "pro": 4, "basic": 14, "visitor": 3 },
    "trend": [{ "date": "2026-03-11", "count": 1 }]
  }
}
```

---

## 3. Data Broker Removal

**Product:** Members track their personal data exposure across 80+ data broker sites and request removals. Similar to DeleteMe / Optery.

**UI status:** Dashboard broker tracker widget built and deployed. Needs backend.

### 3a. Get Broker Exposure
`GET /api/v1/me/broker-exposure`

**Response:**
```json
{
  "summary": {
    "totalBrokers": 84,
    "found": 61, "removing": 14, "removed": 23, "notFound": 23,
    "progressPercent": 27
  },
  "brokers": [
    {
      "brokerId": "whitepages",
      "name": "WhitePages",
      "code": "WP",
      "status": "found",
      "foundAt": "2026-03-15T10:00:00Z",
      "profileUrl": "https://www.whitepages.com/...",
      "lastCheckedAt": "2026-04-05T02:00:00Z"
    }
  ]
}
```

**Status values:** `not_found` | `found` | `removing` | `removed` | `reappeared`

### 3b. Request Removal
`POST /api/v1/me/broker-exposure/:brokerId/request`

```json
{ "confirmIdentity": true, "additionalInfo": "Previously at 123 Main St" }
```
**Response:** `{ "success": true, "broker": { /* updated */ }, "ticketId": "rem_abc" }`

### 3c. Cancel Removal
`POST /api/v1/me/broker-exposure/:brokerId/cancel`

**Response:** `{ "success": true, "broker": { /* updated */ } }`

### 3d. Get Removal History
`GET /api/v1/me/broker-exposure/history`

| Param | Type | Description |
|-------|------|-------------|
| `limit` | int | Default 20 |
| `cursor` | string | Pagination |

**Response:**
```json
{
  "events": [
    {
      "_id": "evt_abc",
      "timestamp": "2026-04-05T02:00:00Z",
      "type": "broker_scan" | "removal_requested" | "removal_completed" | "reappeared",
      "brokerId": "beenverified",
      "summary": "Removed from BeenVerified"
    }
  ],
  "noMoreDocs": false
}
```

### 3e. Trigger Fresh Scan
`POST /api/v1/me/broker-exposure/scan`

**Response:** `{ "success": true, "scanId": "scan_abc", "estimatedCompletionSeconds": 120 }`

Async operation. Client polls `GET /api/v1/me/broker-exposure` for updated results.

---

## 4. Privacy Exposure Score

**Product:** Single 0-100 score summarizing the user's privacy exposure. Hero widget on the dashboard.

**UI status:** Dashboard gauge widget built. Needs backend for real calculation.

### 4a. Get Exposure Score
`GET /api/v1/me/exposure-score`

**Response:**
```json
{
  "score": 62,
  "grade": "C",
  "previousScore": 58,
  "delta": 4,
  "lastUpdated": "2026-04-10T00:00:00Z",
  "factors": [
    { "key": "addresses", "label": "Addresses exposed", "count": 4, "impact": -12, "severity": "high" },
    { "key": "phones", "label": "Phones exposed", "count": 3, "impact": -9, "severity": "medium" },
    { "key": "emails", "label": "Emails exposed", "count": 2, "impact": -4, "severity": "low" },
    { "key": "relatives", "label": "Relatives linked", "count": 6, "impact": -6, "severity": "medium" },
    { "key": "broker_count", "label": "Data broker sites", "count": 61, "impact": -7, "severity": "high" }
  ],
  "recommendations": [
    { "priority": 1, "action": "Start removal from top 10 data brokers", "impactIfCompleted": 15 }
  ]
}
```

### 4b. Get Score History
`GET /api/v1/me/exposure-score/history`

| Param | Type | Default |
|-------|------|---------|
| `period` | string | `30d` — options: `30d` / `90d` / `1y` |

**Response:**
```json
{ "history": [{ "date": "2026-03-11", "score": 58 }, { "date": "2026-03-18", "score": 60 }] }
```

---

## 5. Saved Searches & Watchlist

**Product:** Members bookmark people to monitor. Get notified when new data appears.

**UI status:** Dashboard watchlist widget built. Needs backend.

### 5a. Get Search History
`GET /api/v1/me/searches`

| Param | Type | Description |
|-------|------|-------------|
| `limit` | int | Default 20 |
| `cursor` | string | Pagination |
| `type` | string | Filter: `name` / `phone` / `email` / `address` |

**Response:**
```json
{
  "searches": [
    {
      "_id": "search_abc",
      "timestamp": "2026-04-09T14:00:00Z",
      "type": "name",
      "query": { "firstName": "John", "lastName": "Smith", "state": "CA" },
      "resultsCount": 12,
      "reportGenerated": true,
      "commerceContentId": "report_abc"
    }
  ],
  "noMoreDocs": false
}
```

**Note:** Partially exists via `/searches/me` — formalize schema.

### 5b. Add to Watchlist
`POST /api/v1/me/watchlist`

```json
{
  "targetType": "person",
  "commerceContentId": "report_abc",
  "extId": "ext_abc",
  "displayName": "John Smith",
  "notes": "Old neighbor"
}
```
**Response:** `{ "success": true, "watchlistItem": { ... } }`

### 5c. Get Watchlist
`GET /api/v1/me/watchlist`

**Response:**
```json
{
  "items": [
    {
      "_id": "wl_abc",
      "displayName": "John Smith",
      "location": "Los Angeles, CA",
      "addedAt": "2026-03-01T00:00:00Z",
      "lastCheckedAt": "2026-04-09T00:00:00Z",
      "hasNewInfo": true,
      "changesSinceLastView": [{ "type": "new_address", "description": "New address found" }]
    }
  ]
}
```

### 5d. Remove from Watchlist
`DELETE /api/v1/me/watchlist/:id`

### 5e. Get Watchlist Alerts
`GET /api/v1/me/watchlist/alerts`

Timeline of changes detected on watched profiles.

---

## 6. Records Found Feed

**Product:** "What's new" feed on the dashboard showing new records discovered about the user.

**UI status:** Dashboard feed widget built. Needs backend.

### 6a. Get Records Feed
`GET /api/v1/me/records-feed`

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `new_record` / `removal` / `alert` / `all` |
| `limit` | int | Default 20 |
| `cursor` | string | Pagination |

**Response:**
```json
{
  "events": [
    {
      "_id": "rec_abc",
      "timestamp": "2026-04-09T00:00:00Z",
      "kind": "new_record",
      "subkind": "phone",
      "source": "whitepages",
      "sourceLabel": "WhitePages",
      "summary": "New phone number found on WhitePages",
      "details": { "masked": "(555) ***-**42" }
    }
  ],
  "noMoreDocs": false
}
```

---

## 7. Opt-Out Approval (Admin — P0)

**Problem:** The admin opt-out approval button is disabled because no backend endpoint exists.

**UI status:** Button exists in DataRemovalPage, currently shows "Managed in BC admin panel."

### 7a. Approve Opt-Out Request
`POST /api/optOut/management/approve`

**Body:** `{ optOutId: "69abc..." }`

**Response:** `{ "success": true, "optOut": { "_id": "...", "status": "approved" } }`

**If BC handles this externally, please confirm so we can remove the button from our UI.**

---

## 8. Finance Email Routing (Admin — P0)

**Product:** CS agents send billing/refund requests to the finance team via an in-app email popup instead of paper refund applications.

**UI status:** Ready to build — design approved (Spokeo-style modal). Will use `createCsrMail` as interim until this endpoint exists.

### 8a. Send Finance Request
`POST /api/admin/finance-email`

```json
{
  "customerUserId": "user_abc",
  "orderId": "order_abc",
  "subject": "Refund Request — Order ...",
  "reason": "refund" | "chargeback_inquiry" | "billing_question" | "other",
  "amount": 39.99,
  "currency": "usd",
  "message": "Customer requested full refund...",
  "agentNotes": "Customer called on Apr 10"
}
```

**Constraints:** `message` max 250 characters (400 hard max, 250 recommended). Short-form by design.

**Response:** `{ "success": true, "ticketId": "fin_abc" }`

**Side effect:** Creates a finance ticket and sends email notification to the finance team.

---

## 9. Support Tickets (Admin — P1)

**Product:** Persistent ticket system for CS. Currently uses browser localStorage.

**UI status:** Built (EmailTicketsPage) with localStorage. Needs server persistence.

### 9a. Find Tickets
`POST /api/database/search`

**Body:** `{ collectionName: "tickets", brandId: "idlookup", status?: "open", lastId? }`

**Response:** `{ docs: [Ticket], noMoreDocs: boolean }`

### 9b. Get Ticket Detail
`POST /api/ticket/management/detail`

**Body:** `{ ticketId: "69abc..." }`

**Response:** `{ ticket: Ticket }` — includes full `messages` array

### 9c. Reply to Ticket
`POST /api/ticket/management/reply`

```json
{ "ticketId": "69abc...", "message": "Thank you for contacting us...", "contentType": "text/plain" }
```

**Response:** `{ success: true, ticket: Ticket }`

**Side effect:** Sets status to `pending`, appends message.

### 9d. Update Ticket Status
`POST /api/ticket/management/updateStatus`

**Body:** `{ ticketId: "69abc...", status: "closed" }`

**Response:** `{ success: true, ticket: Ticket }`

### Ticket Schema
```
_id, from (email), subject, status ("open"|"pending"|"closed"), brandId,
messages: [{ from, body, ts, isCustomer }], createdAt, updatedAt
```

---

## 10. Content Management / CMS (Admin — P1)

**Product:** Manage content blocks (privacy policy, terms, landing copy). Currently localStorage.

**UI status:** Built (ContentPage) with localStorage. Needs server persistence.

### 10a. Find Content
`POST /api/database/search`

**Body:** `{ collectionName: "content", brandId: "idlookup", lastId? }`

### 10b. Create Content
`POST /api/content/management/create`

```json
{ "name": "privacy.policy", "description": "Privacy policy", "body": "<h1>...</h1>", "brandId": "idlookup" }
```

### 10c. Update Content
`POST /api/content/management/update`

```json
{ "contentId": "69abc...", "name": "privacy.policy", "description": "...", "body": "..." }
```

### 10d. Delete Content
`POST /api/content/management/remove`

**Body:** `{ contentId: "69abc..." }`

---

## 11. Admin Data Gaps (P2-P3)

### 11a. Permissions Matrix (P2)

`POST /api/permissions/management/get` — Body: `{ brandId: "idlookup" }`

`POST /api/permissions/management/update` — Body: `{ brandId, permissions: { role: { module: bool } } }`

### 11b. Commerce Read Access (P2)

BC may already have these in the commerce system:

- `POST /api/database/search` with `collectionName: "commerceStocks"` — list stocks
- `POST /api/database/search` with `collectionName: "commerceProducts"` — list products
- `POST /api/database/search` with `collectionName: "commerceOffers"` — list offers

If already available, we just need `csrWrapper` methods added. No new backend required.

### 11c. User Impersonation — "Login as User" (P1)

CS agents need to log into the consumer website as a specific user to assist them during phone calls.

`POST /api/user/management/impersonate`

**Body:** `{ userId: "user_abc" }`

**Response:**
```json
{
  "success": true,
  "accessToken": "eyJhb...",
  "refreshToken": "...",
  "user": {
    "_id": "user_abc",
    "email": "customer@email.com",
    "firstName": "John",
    "lastName": "Smith",
    "role": "member",
    "impersonatedBy": "admin@admin.admin"
  }
}
```

**Requirements:**
- Returns a valid member JWT that the consumer app can use as a normal login token
- The token or user object should include an `impersonatedBy` field so the consumer app can show an "Agent Mode" banner
- All actions taken under this token should be audit-logged with the impersonating agent's ID
- Token should have a short TTL (e.g., 30 minutes) for security
- Only CSR/admin role users should be able to call this endpoint

**Consumer app behavior:**
- Admin app opens `https://dev.www.idlookup.ai/login?impersonate=<token>` in a new tab
- Consumer app detects the impersonation token, stores it, and renders the member dashboard with an "Agent Mode" banner
- Banner shows: "Viewing as customer@email.com — Agent Mode" with a "Return to Admin" link

### 11d. CS Rep Listing by Role (P2)

`POST /api/admin/cs-reps/find` — Body: `{ brandId, role: "csr", lastId }`

**Problem:** Current `user.find` / `user.findAdmin` does not support filtering by role.

### 11d. User Login History (P3)

`GET /api/admin/users/:id/login-history`

```json
{
  "logins": [
    { "_id": "...", "timestamp": "...", "ip": "203.0.113.42", "userAgent": "...", "device": "desktop", "status": "success" }
  ],
  "noMoreDocs": false
}
```

### 11e. User Activity Log (P3)

`GET /api/admin/users/:id/activity`

```json
{
  "events": [
    { "_id": "...", "timestamp": "...", "type": "search"|"report_view"|"pdf_download"|"login", "details": {} }
  ],
  "noMoreDocs": false
}
```

### 11f. Admin Analytics (P3)

`GET /api/admin/analytics?period=30d`

Returns: user counts, order revenue, search stats, daily trend.

### 11g. Email Broadcast (P3)

`POST /api/admin/email-broadcast/send` — Send to audience segment

`GET /api/admin/email-broadcast/log` — List sent broadcasts

---

## Already Working — No Changes Needed

For reference, these BC endpoints are already integrated and working:

**Consumer API (`apiWrapper.api.*`):**
- `auth.login`, `auth.logout`
- `idLookup.searchTeaser`, `createReport`, `getReport`, `getReports`, `downloadPdfReport`
- `idLookup.countUserTeaserSearches`, `countUserReportCreations`, `countUserPdfDownloads`
- `billing.sale`, `tokenSale`, `signup`, `getOrders`, `cancelOrUncancelOrder`, `getActivatedProductTypes`
- `optOut` (search, request, confirmation)
- `contact.create`, `user.createContact`
- `user.update`, `user.changePassword`, `user.resetPassword`
- `managedContact.create`
- `shape.getShapeCompiled`

**Admin CSR API (`csrWrapper.api.*`):**
- `auth.login`, `auth.logout`
- `user.create`, `update`, `getUserDetail`, `find`, `findAdmin`
- `user.createAdminNote`, `updateAdminNote`, `createCsrMail`, `findUserContacts`
- `user.findOrders`, `getOrder`, `findOrderPayments`, `findOrderHistories`
- `user.cancelUncancelOrder`, `refundVoidOrder`, `updateScheduleDueTimestamp`
- `optOut.find`
- `contact.find`
- `managedContact.find`, `unsubscribe`
- `attachment.download`, `remove`

---

## Priority Summary

| Priority | # | Feature | Reason |
|----------|---|---------|--------|
| **P0** | 7 | Opt-Out Approval | Button broken in production admin |
| **P0** | 8 | Finance Email Routing | Unblocks new refund workflow for CS |
| **P1** | 1-2 | WSFY/WVMP (Searchers + Viewers) | Dashboard hero feature, UI complete |
| **P1** | 3 | Data Broker Removal | Dashboard tracker widget, core value prop |
| **P1** | 4 | Privacy Exposure Score | Dashboard hero widget, UI complete |
| **P1** | 9 | Support Tickets | CS needs persistent ticket system |
| **P1** | 10 | Content CMS | Content must persist across sessions |
| **P2** | 5 | Watchlist | New engagement feature |
| **P2** | 6 | Records Feed | Dashboard secondary widget |
| **P2** | 11a | Permissions | Admin role matrix persistence |
| **P1** | 11c | User Impersonation ("Login as User") | CS needs to assist users during phone calls |
| **P2** | 11b | Commerce Read | May already exist — just need CSR access |
| **P2** | 11d | CS Rep List by Role | Current workaround: lookup by ID |
| **P3** | 11e-h | Login History, Activity, Analytics, Broadcast | Showing "not available" or mock today |

---

## Implementation Notes for BC

- All consumer endpoints use member JWT authentication (same token from `auth.login`)
- All admin endpoints use CSR session cookie (same as existing CSR endpoints)
- Pagination follows BC's existing `lastId` / `noMoreDocs` pattern where possible
- Response shapes use BC conventions (`docs[]`, `_id`, `createdAt`, `brandId`)
- Write endpoints should return the updated object in the response
- All endpoints should support `brandId: "idlookup"` filtering

**Questions for BC:**
1. Can `user.find` be extended to filter by role? (Would fix 11c)
2. Do commerce stock/product/offer collections already exist in `database/search`? (Would fix 11b without new endpoints)
3. Does BC track login sessions? If so, can we access via CSR API? (Would fix 11d)
4. Is opt-out approval handled in BC's admin panel? If so, we'll remove the button (fixes 7)
