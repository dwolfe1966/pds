# API Requirements — BC Backend + IDLookup Fallback

**Date:** April 10, 2026
**Purpose:** Define all APIs needed to support new and planned features for IDLookup.AI consumer and admin apps. Intended to be shared with (1) ByteCrtrs to develop as a primary backend, and (2) IDLookup team to build as a fallback backend we can call directly.

**Strategy:** IDLookup will build an API backend that mirrors these endpoints so we're not blocked on BC. When BC delivers, the admin/consumer apps flip a feature flag to route calls to BC instead of our fallback. Data models should be designed to map cleanly between both.

---

## Section A — Who's Watching You (WSFY + WVMP)

**Product context:** Members need to see who's been searching for and viewing their profile. Free tier sees obfuscated data (masked names, blurred avatars, relative dates). Paid tier sees full details with filters, sort, and CSV export.

**Current state:** UI is built (`src/pages/member/WhoIsSearchingPage.js`) using a seeded mock data generator. Needs real data.

### A.1 Get Searchers (people who ran searches for this user)

**Endpoint:** `GET /api/v1/me/watchers/searchers`

**Query params:**
- `from` (ISO 8601, optional) — start date filter
- `to` (ISO 8601, optional) — end date filter
- `limit` (int, default 50, max 200)
- `cursor` (string, optional) — pagination cursor / lastId
- `sort` (string, default `newest`) — `newest` | `oldest` | `name`
- `tier` (string, optional) — filter by `pro` | `basic` | `visitor`
- `searchType` (string, optional) — filter by `name` | `phone` | `email` | `address`

**Response:**
```json
{
  "docs": [
    {
      "_id": "evt_...",
      "timestamp": "2026-04-09T14:32:11Z",
      "searcher": {
        "firstName": "Jane",
        "lastInitial": "S",
        "city": "Los Angeles",
        "state": "CA",
        "tier": "basic",
        "avatarInitials": "JS"
      },
      "searchType": "name",
      "matched": true
    }
  ],
  "noMoreDocs": false,
  "nextCursor": "evt_..."
}
```

### A.2 Get Viewers (people who opened this user's full profile/report)

**Endpoint:** `GET /api/v1/me/watchers/viewers`

**Query params:** Same as A.1, plus:
- `minSectionsViewed` (int, optional) — filter by engagement depth

**Response:**
```json
{
  "docs": [
    {
      "_id": "view_...",
      "timestamp": "2026-04-08T09:15:00Z",
      "viewer": {
        "firstName": "Mike",
        "lastInitial": "R",
        "city": "Dallas",
        "state": "TX",
        "tier": "pro",
        "avatarInitials": "MR"
      },
      "sectionsViewed": ["personal", "addresses", "phones", "relatives"],
      "sectionsCount": 4,
      "durationSeconds": 187
    }
  ],
  "noMoreDocs": false,
  "nextCursor": "view_..."
}
```

### A.3 Get Watching Stats (aggregated metrics)

**Endpoint:** `GET /api/v1/me/watchers/stats`

**Query params:**
- `period` (string, default `30d`) — `7d` | `30d` | `90d` | `1y` | `all`

**Response:**
```json
{
  "searchers": {
    "total": 147,
    "thisMonth": 42,
    "lastMonth": 38,
    "thisWeek": 11,
    "lastWeek": 9,
    "byType": { "name": 24, "phone": 8, "email": 6, "address": 4 },
    "byTier": { "pro": 6, "basic": 28, "visitor": 8 },
    "trend": [
      { "date": "2026-03-11", "count": 2 },
      { "date": "2026-03-12", "count": 1 }
    ]
  },
  "viewers": {
    "total": 68,
    "thisMonth": 21,
    "lastMonth": 19,
    "thisWeek": 5,
    "lastWeek": 4,
    "bySections": { "personal": 18, "addresses": 15, "phones": 12, "relatives": 9 },
    "byTier": { "pro": 4, "basic": 14, "visitor": 3 },
    "trend": [ /* same shape as searchers */ ]
  }
}
```

### A.4 Record a Profile View (write endpoint, called by consumer when viewing reports)

**Endpoint:** `POST /api/v1/profile-views`

**Body:**
```json
{
  "targetUserId": "user_...",
  "targetCommerceContentId": "report_...",
  "sectionsViewed": ["personal", "addresses"],
  "source": "member-search"
}
```

**Response:** `{ "success": true, "viewId": "view_..." }`

**Note:** This endpoint already partially exists in our app (`api.post('/profile-views', ...)`). BC should provide the persistent backend.

### A.5 Record a Search (write endpoint, called when someone searches)

**Endpoint:** `POST /api/v1/profile-searches`

**Body:**
```json
{
  "searchType": "name",
  "query": { "firstName": "John", "lastName": "Smith", "state": "CA" },
  "matchedTargetUserIds": ["user_..."]
}
```

**Response:** `{ "success": true, "searchId": "search_..." }`

---

## Section B — Data Broker Removal

**Product context:** Members want to track and manage removal of their personal data from 3rd-party data broker sites (WhitePages, Spokeo, BeenVerified, etc.). Similar to DeleteMe / Optery / Kanary.

**Current state:** Dashboard UI built (`src/pages/member/DashboardHome.js`) using mocked broker grid. Needs real data + removal workflow.

### B.1 Get Broker Exposure

**Endpoint:** `GET /api/v1/me/broker-exposure`

**Response:**
```json
{
  "summary": {
    "totalBrokers": 84,
    "found": 61,
    "removing": 14,
    "removed": 23,
    "notFound": 23,
    "progressPercent": 27
  },
  "brokers": [
    {
      "brokerId": "whitepages",
      "name": "WhitePages",
      "code": "WP",
      "logoUrl": "https://cdn.idlookup.ai/brokers/whitepages.png",
      "status": "found",
      "foundAt": "2026-03-15T10:00:00Z",
      "profileUrl": "https://www.whitepages.com/name/John-Smith/CA",
      "lastCheckedAt": "2026-04-05T02:00:00Z"
    },
    {
      "brokerId": "spokeo",
      "name": "Spokeo",
      "code": "SP",
      "status": "removing",
      "requestedAt": "2026-04-01T14:22:00Z",
      "estimatedRemovalDate": "2026-04-30T00:00:00Z"
    },
    {
      "brokerId": "beenverified",
      "name": "BeenVerified",
      "code": "BV",
      "status": "removed",
      "requestedAt": "2026-02-10T09:00:00Z",
      "removedAt": "2026-03-15T11:30:00Z"
    }
  ]
}
```

**Status values:** `not_found` | `found` | `removing` | `removed` | `reappeared`

### B.2 Request Removal

**Endpoint:** `POST /api/v1/me/broker-exposure/:brokerId/request-removal`

**Body:**
```json
{
  "confirmIdentity": true,
  "additionalInfo": "Previously lived at 123 Main St"
}
```

**Response:**
```json
{
  "success": true,
  "broker": { /* updated broker object with status: "removing" */ },
  "ticketId": "rem_..."
}
```

### B.3 Cancel Removal Request

**Endpoint:** `POST /api/v1/me/broker-exposure/:brokerId/cancel-removal`

**Response:** `{ "success": true, "broker": { /* updated */ } }`

### B.4 Get Removal History / Timeline

**Endpoint:** `GET /api/v1/me/broker-exposure/history`

**Query params:** `limit`, `cursor`

**Response:**
```json
{
  "events": [
    {
      "_id": "evt_...",
      "timestamp": "2026-04-05T02:00:00Z",
      "type": "broker_scan",
      "summary": "New scan completed — found on 2 new sites"
    },
    {
      "_id": "evt_...",
      "timestamp": "2026-03-15T11:30:00Z",
      "type": "removal_completed",
      "brokerId": "beenverified",
      "summary": "Removed from BeenVerified"
    }
  ],
  "noMoreDocs": false
}
```

### B.5 Trigger Fresh Broker Scan

**Endpoint:** `POST /api/v1/me/broker-exposure/scan`

**Response:** `{ "success": true, "scanId": "scan_...", "estimatedCompletionSeconds": 120 }`

**Note:** Scan is async. Client can poll `GET /api/v1/me/broker-exposure` or subscribe to a WebSocket for updates.

---

## Section C — Privacy Exposure Score

**Product context:** A single 0-100 number with letter grade (A-F) that summarizes the user's overall privacy exposure. Hero widget on the dashboard. Drives ongoing engagement.

**Current state:** Dashboard UI built with gauge widget. Score currently derived from mocked data.

### C.1 Get Privacy Exposure Score

**Endpoint:** `GET /api/v1/me/exposure-score`

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
    {
      "priority": 1,
      "action": "Start removal from top 10 data brokers",
      "impactIfCompleted": 15,
      "ctaRoute": "/brokers"
    }
  ]
}
```

### C.2 Get Score History (for trend chart)

**Endpoint:** `GET /api/v1/me/exposure-score/history`

**Query params:** `period` (`30d` | `90d` | `1y`)

**Response:**
```json
{
  "history": [
    { "date": "2026-03-11", "score": 58 },
    { "date": "2026-03-18", "score": 60 }
  ]
}
```

---

## Section D — Saved Searches & Watchlist

**Product context:** Members can bookmark people to monitor and receive alerts when new data appears. Also powers the "recent searches" feature. We want to track both directions: profiles the member has viewed AND viewers of the member's own profile.

**Current state:** Search history exists via `/searches/me`. No watchlist yet. Dashboard UI built with mocked watchlist cards.

### D.1 Get Search History

**Endpoint:** `GET /api/v1/me/searches`

**Query params:** `limit`, `cursor`, `type`

**Response:**
```json
{
  "searches": [
    {
      "_id": "search_...",
      "timestamp": "2026-04-09T14:00:00Z",
      "type": "name",
      "query": { "firstName": "John", "lastName": "Smith", "state": "CA" },
      "resultsCount": 12,
      "reportGenerated": true,
      "commerceContentId": "report_..."
    }
  ],
  "noMoreDocs": false
}
```

**Status:** This largely exists today via `/searches/me`. Formalize schema.

### D.2 Add to Watchlist

**Endpoint:** `POST /api/v1/me/watchlist`

**Body:**
```json
{
  "targetType": "person",
  "commerceContentId": "report_...",
  "extId": "...",
  "displayName": "John Smith",
  "notes": "Old neighbor"
}
```

**Response:** `{ "success": true, "watchlistItem": { /* ... */ } }`

### D.3 Get Watchlist

**Endpoint:** `GET /api/v1/me/watchlist`

**Response:**
```json
{
  "items": [
    {
      "_id": "wl_...",
      "targetType": "person",
      "commerceContentId": "report_...",
      "displayName": "John Smith",
      "location": "Los Angeles, CA",
      "addedAt": "2026-03-01T00:00:00Z",
      "lastCheckedAt": "2026-04-09T00:00:00Z",
      "hasNewInfo": true,
      "changesSinceLastView": [
        { "type": "new_address", "description": "New address found" }
      ]
    }
  ]
}
```

### D.4 Remove from Watchlist

**Endpoint:** `DELETE /api/v1/me/watchlist/:id`

### D.5 Get Watchlist Alerts

**Endpoint:** `GET /api/v1/me/watchlist/alerts`

**Response:** Timeline of changes detected on watchlisted profiles.

---

## Section E — Records Found Feed

**Product context:** "What's new" feed on the dashboard showing new records discovered about the user (new addresses, phones, relatives, etc.).

**Current state:** Dashboard UI built with mocked feed.

### E.1 Get Recent Records Found

**Endpoint:** `GET /api/v1/me/records-feed`

**Query params:** `type` (`new_record` | `removal` | `alert` | `all`), `limit`, `cursor`

**Response:**
```json
{
  "events": [
    {
      "_id": "rec_...",
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

## Section F — CS / Admin Gaps Not Covered by BC

These are required for the admin app and CS workflows but are not in the BC CSR API documentation as of April 10, 2026. Some have an existing spec in `docs/BC_ADMIN_API_SPEC_REQUEST.md`; these are either updates or additions.

### F.1 Finance Email Routing (NEW — supports refund-via-Contact-Us workflow)

**Use case:** Instead of paper refund applications, CS agents send billing/refund requests to the finance team via Contact Us. Email body limited to 250 characters (400 max).

**Endpoint:** `POST /api/v1/admin/finance-email`

**Body:**
```json
{
  "customerUserId": "user_...",
  "orderId": "order_...",
  "subject": "Refund Request — Order ...",
  "reason": "refund" | "chargeback_inquiry" | "billing_question" | "other",
  "amount": 39.99,
  "currency": "usd",
  "message": "Customer requested full refund...",
  "agentNotes": "Customer called on Apr 10"
}
```

**Constraints:** `message` max length 250 characters (enforced server-side).

**Response:** `{ "success": true, "ticketId": "fin_..." }`

**Side effect:** Creates a support ticket in finance queue, notifies finance via email.

### F.2 Opt-Out Approval

**Endpoint:** `POST /api/v1/admin/optouts/:id/approve`

**Response:** `{ "success": true, "optOut": { /* updated with status: "approved" */ } }`

**Note:** Referenced in `BC_ADMIN_API_SPEC_REQUEST.md` as P0. Currently approval is disabled in the UI.

### F.3 Persistent Support Tickets

See `BC_ADMIN_API_SPEC_REQUEST.md` Section 2 for full spec. Required endpoints:
- `POST /api/ticket/find` (list)
- `POST /api/ticket/detail` (get one with messages)
- `POST /api/ticket/reply` (add message, set status=pending)
- `POST /api/ticket/updateStatus` (open/pending/closed)

### F.4 Persistent Content Management (CMS)

See `BC_ADMIN_API_SPEC_REQUEST.md` Section 1. Required endpoints:
- `POST /api/content/find`
- `POST /api/content/create`
- `POST /api/content/update`
- `POST /api/content/remove`

### F.5 Persistent Permissions Matrix

See `BC_ADMIN_API_SPEC_REQUEST.md` Section 3. Required endpoints:
- `POST /api/permissions/get`
- `POST /api/permissions/update`

### F.6 Offers/Products/Stocks Read Access

See `BC_ADMIN_API_SPEC_REQUEST.md` Section 4. Required endpoints:
- `POST /api/commerce/findStocks`
- `POST /api/commerce/findProducts`
- `POST /api/commerce/findOffers`
- (Optional) `update*` for each

### F.7 CS Rep Listing by Role (NEW — existing BC gap)

**Problem:** BC's `user.find` does not filter by role. Admins can only look up CS reps by user ID.

**Endpoint:** `POST /api/admin/cs-reps/find`

**Body:** `{ brandId, role: "csr" | "admin", lastId }`

**Response:** `{ docs: [User], noMoreDocs }`

### F.8 Admin-Facing User Login History

**Problem:** No BC endpoint for viewing a user's login history. UserDetailPage shows "not available".

**Endpoint:** `GET /api/admin/users/:id/login-history`

**Response:**
```json
{
  "logins": [
    {
      "_id": "login_...",
      "timestamp": "2026-04-09T14:00:00Z",
      "ip": "203.0.113.42",
      "userAgent": "Mozilla/5.0...",
      "device": "desktop",
      "location": "Los Angeles, CA",
      "status": "success"
    }
  ],
  "noMoreDocs": false
}
```

### F.9 Admin-Facing User Activity

**Problem:** No BC endpoint for viewing a user's application activity (searches, report views, downloads). UserDetailPage shows "not available".

**Endpoint:** `GET /api/admin/users/:id/activity`

**Response:**
```json
{
  "events": [
    {
      "_id": "evt_...",
      "timestamp": "2026-04-09T13:00:00Z",
      "type": "search" | "report_view" | "pdf_download" | "login" | "logout",
      "details": { "query": "John Smith", "resultsCount": 12 }
    }
  ],
  "noMoreDocs": false
}
```

### F.10 Admin Analytics

**Problem:** Current `AnalyticsPage` calls `api.get('/admin/analytics')` which hits a mock-only endpoint.

**Endpoint:** `GET /api/admin/analytics`

**Query params:** `period` (`7d` | `30d` | `90d`)

**Response:**
```json
{
  "users": { "total": 12453, "active": 4211, "new": 187 },
  "orders": { "total": 8923, "revenue": 356210.00, "refunds": 12 },
  "searches": { "total": 42110, "successRate": 0.87 },
  "reports": { "generated": 3244, "pdfDownloads": 1876 },
  "trend": { "daily": [ /* array of daily metrics */ ] }
}
```

### F.11 Email Broadcast (currently mock-only)

**Endpoints:**
- `POST /api/admin/email-broadcast/send` — send to audience
- `GET /api/admin/email-broadcast/log` — list sent broadcasts

**Body (send):**
```json
{
  "audience": "all_members" | "free_members" | "pro_members" | "custom",
  "customUserIds": ["..."],
  "subject": "...",
  "body": "...",
  "contentType": "text/html"
}
```

**Response:** `{ "success": true, "broadcastId": "...", "recipientCount": N }`

---

## Implementation Strategy

### Phase 1: Mock in UI (DONE)
- WSFY, dashboard widgets, watchlist, records feed, exposure score, broker tracker — all built with seeded mock data generators in `src/pages/member/watchingHelpers.js`.
- Easy to swap: all data flows through helper functions — replacing with real fetch calls is a one-file change.

### Phase 2: IDLookup Fallback Backend (RECOMMENDED)
- Build a lightweight Express or Next.js API service that implements sections A–E with real persistence (Postgres or MongoDB).
- Routes: `/api/v1/me/*` for member-facing, `/api/v1/admin/*` for admin-facing.
- Deploy behind existing domain or subdomain.
- Front-end calls this as primary during development and until BC ships.

### Phase 3: BC Integration
- Once BC delivers matching endpoints, add a feature flag per section:
  - `REACT_APP_USE_BC_WSFY=true`
  - `REACT_APP_USE_BC_BROKERS=true`
  - `REACT_APP_USE_BC_EXPOSURE_SCORE=true`
  - etc.
- `apiRouter.js` pattern already supports per-endpoint feature flags.
- Keep the fallback running as a true fallback for resilience or feature parity.

### Data Model Compatibility
- Field names in this spec are intentionally simple and match common database conventions.
- BC may use different field names (e.g. `_id` vs `id`, `createdAt` vs `timestamp`). `apiAdapter.js` already has patterns for normalizing responses; reuse that approach.

### Authentication
- All `/me/*` endpoints require member JWT (existing auth pattern).
- All `/admin/*` endpoints require admin session cookie (existing CSR auth pattern).
- Fallback backend should accept the same token format BC uses, OR we add a translation layer in `apiWrapper.js`.

---

## Priority Summary

| Priority | Section | Reason |
|----------|---------|--------|
| **P0** | F.1 Finance Email Routing | Unblocks new refund workflow |
| **P0** | F.2 Opt-Out Approval | Button already broken in production |
| **P1** | A.1–A.3 WSFY/WVMP Read | Member dashboard hero feature |
| **P1** | B.1 Broker Exposure Read | Dashboard feature already shipped |
| **P1** | C.1 Exposure Score | Dashboard hero widget |
| **P2** | B.2–B.5 Broker Removal Write | New feature, but core to privacy value prop |
| **P2** | D.1–D.5 Watchlist | New feature, moderate engagement value |
| **P2** | E.1 Records Feed | Dashboard tertiary widget |
| **P2** | F.3 Tickets, F.4 Content, F.5 Permissions | Admin localStorage pages |
| **P3** | F.6 Offers Read | Read-only OK for now |
| **P3** | F.7 CS Rep Listing | Existing workaround (lookup by ID) |
| **P3** | F.8 Login History, F.9 User Activity | Showing "not available" today, low CS impact |
| **P3** | F.10 Analytics, F.11 Broadcast | Mock works for demos |

---

## Related Documents

- `docs/BC_ADMIN_API_SPEC_REQUEST.md` — existing spec for CS features (tickets, content, permissions, offers)
- `docs/BC_API_COVERAGE.md` — inventory of BC endpoints currently wired
- `docs/BC_REPORT_RESPONSE_STRUCTURE.md` — report detail data shape
