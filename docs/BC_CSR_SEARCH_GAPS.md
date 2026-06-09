# BC ask — CSR search: server-side name filter + order-by-id

**Raised:** 2026-06-05 · **From:** PDS / idlookup CSR tooling · **order-by-id RESOLVED 2026-06-09; name filter STILL OPEN**

> **✅ RESOLVED 2026-06-09 — order-by-id now works + wired.** BC's csrApi docs added `userId`
> and `orderId` to `user.find` on 2026-06-08, but that day's live re-test showed the backend
> ignored them (returned the default list). **Re-verified 2026-06-09** (`scripts/verify-bc-csr-params.js`):
> `user.find({ orderId:'6a11ea7d…af98e' })` now returns **exactly the owning user** (1 doc,
> correct `_id`) and `tracking.findUser({ updaterId })` is server-side scoped. BC implemented
> both overnight. **Wired** `orderId` into CSR search via an `order:<id>` prefix in
> `UsersPage.runSmartSearch` → resolves to the owning customer's detail (admin bundle `8e73d6c5`).
> Verified through the live wired path (`scripts/live-uat-order-search.js`): real order id → owner
> detail; bogus order id → "no customer found", no blind navigate. The tracking client-side scope
> filter was intentionally left in place (separate change; its failure mode is a privacy leak).

We wired the CSR customer/order searches the team needs. Probed BC's
`/database/search` live (non-matching values, so 0 = filter honored, 10 = ignored):

| Customer search | BC support | Field |
|---|---|---|
| email | ✅ | `query.email` |
| ZIP | ✅ | `query.zip` |
| phone | ✅ | `query.phone` |
| last 4 of card | ✅ | `query.panLast4` (note: `last4cc` is ignored) |
| customer id | ✅ | via `getUserDetail({userId})` (an `_id`/`id` query on the user search is ignored) |
| **name** | ❌ | `firstName`/`lastName`/`fName`/`lName`/regex are all **ignored** (return the default page) |

| Order search | BC support |
|---|---|
| by customer id | ✅ `commerceMgmt/userOrders({userId})` |
| **by order id** | ❌ `getUserOrder` **requires `userId`** (400 "userId should not be empty"); no order-by-id-alone endpoint found |

## Asks

1. **Add a server-side name filter to the user search.** `firstName`/`lastName` (or a
   combined `name`) on `POST /api/database/search` (collection `users`). Today we
   work around it by paging the recent customer list and matching client-side — bounded
   to the ~250 most-recent customers, so older accounts aren't found by name.
   *(Also: the `users` collection ignores `perPage` (caps at 10), which makes the
   client-side scan slow — honoring `perPage` here would help even without #1.)*

2. **Add an order-by-id lookup that doesn't require `userId`** — e.g.
   `getOrder({ orderId })`, or honor `query._id` on a `commerceorders` search. CSR often
   has an order id (from a receipt / gateway) without the customer. Today CSR must find
   the customer first.

Neither blocks launch — both have client-side workarounds or customer-first flows — but
they make CSR materially faster.
