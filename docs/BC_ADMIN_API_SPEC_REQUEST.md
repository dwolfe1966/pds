# ByteCrtrs CSR API — Requested Endpoints for IDLookup Admin App

**Date:** April 7, 2026
**From:** IDLookup Development Team
**To:** ByteCrtrs (Kwan)

The IDLookup admin app (deployed at `dev.www.bytecrtrs.com/admin`) currently uses localStorage for 4 features that need server-side persistence. Below are the API specs we need added to the `csrWrapper` library.

All endpoints should follow the existing `csrWrapper.api.*` pattern (POST with JSON body, authenticated via session cookie).

---

## 1. Content Management

Manage CMS content blocks (privacy policy, terms, landing page copy, etc.)

### `csrWrapper.api.content.find`
- **Path:** `POST /api/database/search`
- **Body:** `{ collectionName: 'content', brandId: 'idlookup', lastId? }`
- **Response:** `{ docs: [ContentBlock], noMoreDocs: boolean }`

### `csrWrapper.api.content.create`
- **Path:** `POST /api/content/management/create`
- **Body:**
```json
{
  "name": "privacy.policy",
  "description": "Privacy policy page content",
  "body": "<h1>Privacy Policy</h1>...",
  "brandId": "idlookup"
}
```
- **Response:** `{ success: true, content: ContentBlock }`

### `csrWrapper.api.content.update`
- **Path:** `POST /api/content/management/update`
- **Body:**
```json
{
  "contentId": "69abc...",
  "name": "privacy.policy",
  "description": "Updated description",
  "body": "<h1>Updated Privacy Policy</h1>..."
}
```
- **Response:** `{ success: true, content: ContentBlock }`

### `csrWrapper.api.content.remove`
- **Path:** `POST /api/content/management/remove`
- **Body:** `{ contentId: "69abc..." }`
- **Response:** `{ success: true }`

### ContentBlock Schema
```
_id: ObjectId
name: string (slug, e.g. "privacy.policy", "inmate.state.al")
description: string
body: string (HTML)
brandId: string
createdAt: ISO 8601
updatedAt: ISO 8601
```

---

## 2. Support Tickets

Customer support ticket system with threaded messages.

### `csrWrapper.api.ticket.find`
- **Path:** `POST /api/database/search`
- **Body:** `{ collectionName: 'tickets', brandId: 'idlookup', status?, lastId? }`
- **Response:** `{ docs: [Ticket], noMoreDocs: boolean }`

### `csrWrapper.api.ticket.getDetail`
- **Path:** `POST /api/ticket/management/detail`
- **Body:** `{ ticketId: "69abc..." }`
- **Response:** `{ ticket: Ticket }` (includes full messages array)

### `csrWrapper.api.ticket.reply`
- **Path:** `POST /api/ticket/management/reply`
- **Body:**
```json
{
  "ticketId": "69abc...",
  "message": "Thank you for contacting us...",
  "contentType": "text/plain"
}
```
- **Response:** `{ success: true, ticket: Ticket }`
- **Side effect:** Sets ticket status to `pending`, appends message to thread

### `csrWrapper.api.ticket.updateStatus`
- **Path:** `POST /api/ticket/management/updateStatus`
- **Body:** `{ ticketId: "69abc...", status: "closed" }`
- **Response:** `{ success: true, ticket: Ticket }`

### Ticket Schema
```
_id: ObjectId
from: string (customer email)
subject: string
status: "open" | "pending" | "closed"
brandId: string
messages: [
  {
    from: string (email),
    body: string,
    ts: ISO 8601,
    isCustomer: boolean
  }
]
createdAt: ISO 8601
updatedAt: ISO 8601
```

### Status Workflow
- `open` — new ticket, awaiting agent response
- `pending` — agent replied, awaiting customer
- `closed` — resolved (can be reopened by setting status back to `open`)

---

## 3. Permissions

Role-based access control for admin modules. Three predefined roles: admin, support, editor.

### `csrWrapper.api.permissions.get`
- **Path:** `POST /api/permissions/management/get`
- **Body:** `{ brandId: 'idlookup' }`
- **Response:**
```json
{
  "permissions": {
    "admin": { "Customers": true, "Orders": true, ... },
    "support": { "Customers": true, "Orders": true, "CS Reps": false, ... },
    "editor": { "Broadcast": true, "Content": true, ... }
  }
}
```

### `csrWrapper.api.permissions.update`
- **Path:** `POST /api/permissions/management/update`
- **Body:**
```json
{
  "brandId": "idlookup",
  "permissions": {
    "support": { "Customers": true, "Orders": true, "CS Reps": false, ... },
    "editor": { "Broadcast": true, "Content": true, ... }
  }
}
```
- **Response:** `{ success: true }`
- **Note:** Admin role permissions are immutable (all true). Only `support` and `editor` can be modified.

### Module List
Customers, Orders, Payments, Opt-Outs, Notes, Tickets, CS Reps, Broadcast, Analytics, Content, Permissions

---

## 4. Offers / Products / Stocks

Commerce configuration: stock tiers, products, and offers. These may already exist in BC's commerce system — if so, we just need READ + UPDATE access via the CSR API.

### `csrWrapper.api.commerce.findStocks`
- **Path:** `POST /api/database/search`
- **Body:** `{ collectionName: 'commerceStocks', brandId: 'idlookup', lastId? }`
- **Response:** `{ docs: [Stock], noMoreDocs: boolean }`

### `csrWrapper.api.commerce.updateStock`
- **Path:** `POST /api/commerce/management/updateStock`
- **Body:** `{ stockId: "69abc...", name: "...", description: "..." }`
- **Response:** `{ success: true, stock: Stock }`

### `csrWrapper.api.commerce.findProducts`
- **Path:** `POST /api/database/search`
- **Body:** `{ collectionName: 'commerceProducts', brandId: 'idlookup', lastId? }`
- **Response:** `{ docs: [Product], noMoreDocs: boolean }`

### `csrWrapper.api.commerce.updateProduct`
- **Path:** `POST /api/commerce/management/updateProduct`
- **Body:** `{ productId: "69abc...", name: "...", price: 39.99, description: "...", stockId: "..." }`
- **Response:** `{ success: true, product: Product }`

### `csrWrapper.api.commerce.findOffers`
- **Path:** `POST /api/database/search`
- **Body:** `{ collectionName: 'commerceOffers', brandId: 'idlookup', lastId? }`
- **Response:** `{ docs: [Offer], noMoreDocs: boolean }`

### `csrWrapper.api.commerce.updateOffer`
- **Path:** `POST /api/commerce/management/updateOffer`
- **Body:** `{ offerId: "69abc...", name: "...", productId: "...", description: "...", supOffer: false }`
- **Response:** `{ success: true, offer: Offer }`

**Note:** If stocks/products/offers are already managed through BC's own admin panel and shouldn't be editable by IDLookup CS reps, we only need the `find*` (read) endpoints. The IDLookup admin would display them read-only.

---

## 5. Opt-Out Approval (Existing Gap)

The `DataRemovalPage` lists opt-out requests via `csrWrapper.api.optOut.find()` but has no way to approve them.

### `csrWrapper.api.optOut.approve`
- **Path:** `POST /api/optOut/management/approve`
- **Body:** `{ optOutId: "69abc..." }`
- **Response:** `{ success: true, optOut: { _id, status: 'approved', ... } }`

If approval is handled externally (e.g., BC admin panel), let us know and we'll remove the button from the IDLookup admin UI.

---

## Priority

| Priority | Feature | Reason |
|----------|---------|--------|
| **P0** | Opt-Out Approval | Button exists, currently broken |
| **P1** | Tickets | CS reps need persistent ticket system |
| **P1** | Content | CMS content needs to persist across sessions |
| **P2** | Permissions | Role matrix needs server persistence |
| **P2** | Offers/Products/Stocks | May already exist in BC commerce — just need CSR read access |

---

## Existing CSR Endpoints (Working)

For reference, these are already implemented and working:
- `auth.login / logout`
- `user.create / update / getUserDetail / find / findAdmin`
- `user.createAdminNote / updateAdminNote`
- `user.createCsrMail`
- `user.findUserContacts`
- `user.findOrders / getOrder / findOrderPayments / findOrderHistories`
- `user.cancelUncancelOrder / refundVoidOrder`
- `user.updateScheduleDueTimestamp`
- `optOut.find`
- `contact.find`
- `managedContact.find / unsubscribe`
- `attachment.download / remove`
