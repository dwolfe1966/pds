---
name: bc-csr-user-object-omits-zip-card-phone
description: "BC's CSR user object (both /database/search and getUserDetail) has NO zip/last4cc/phone fields — they're filter-only. Display ZIP from order billing address instead."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7aeba5ca-a8fd-4f98-b2f1-d4e52b390ce2
---

Verified live 2026-06-04 (Playwright vs dev.admin.www.bytecrtrs.com, bundle ce2e8005):

The BC CSR **user object does NOT carry `zip`, `last4cc`, or `phone`** as top-level
fields. Confirmed on BOTH projections:
- `csrWrapper.api.user.find` → `POST /api/database/search` doc keys: `_id, uniqueId,
  index, status, referenceIds, permissionIds, brandId, shConId, shColId, shTimestamp,
  email, firstName, lastName, roles, prevShape, createdAt, updatedAt, trackingIds,
  currentRevisionId, updaterId, id` — **no zip/last4cc/phone**.
- `csrWrapper.api.user.getUserDetail` → `POST /user/management/detail`: same, plus
  `shapeContainer, shapeCollection`. **`'zip' in user` is false.**

BC *filters* users by zip/phone/last4 server-side (advanced search query params work),
but does **not project those fields back** — same `displayFields`-trim class as
[[feedback_no_clientside_filter_on_bc_database_search]].

**Where the data actually lives:** the order billing address.
- `order.commercePayments[].commerceToken.billingAddress.zip`
- `order.commerceTokens[].billingAddress.zip`
- (also `commercePayments[].rawRequest.Message.Request.Account.Postal`)

**Consequences:**
- To show ZIP on the CSR detail page, derive from orders, not `user.zip`. Done via
  `getLatestBillingZip(orders)` in `src/utils/orderFinancials.js` (mirrors
  `getLatestPaymentDeviceInfo`).
- The **Users-list Zip/CC columns (`u.zip`/`u.last4cc`) are dead** — they render "—"
  for everyone because the search projection omits those keys. Fix = BC ask to add
  them to the user-search `displayFields`, or drop the columns. (Open as of 2026-06-04.)

Don't assume "search can filter by X" implies "the response contains X". Check
`Object.keys(response)` before binding a column/field to it.
