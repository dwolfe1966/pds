# BC CSR asks — consolidated package (with a runnable proof)

**Prepared 2026-06-18.** Every item is reproduced live against `dev.admin.www.bytecrtrs.com`. Rather
than argue from a document, **run the demo** — it calls BC's own API and prints what it returns:

```
CSR_USER='<csr account>' CSR_PWD='<pwd>' node scripts/demo-bc-csr-asks.js
```

It prints, per ask: what we call → what BC returns → what we expected → verdict, plus a working
contrast. Three asks + one question. **Setup + run instructions: `BC_CSR_DEMO_HOWTO.md`** (no embedded
credentials — the runner supplies their own CSR account via env). (All re-checked across `idlookup` / `bytecrtrs` / no-brand so a
brand filter can't be the cause.)

> **Two earlier asks were withdrawn after we re-tested them this way** — see "Resolved on our side"
> below. We're deliberately handing you a *short, bulletproof* list.

---

## ASK A — offer lookup doesn't resolve in the CSR context  (FIX + ADD)

**Demo (live):** `POST /commerce/offer/findByShmName {shmName:'comp.offer.signup.main'}` in a CSR
session → **403 "No offer."** for **every** brand (no-brand / idlookup / bytecrtrs). The **same shmName
resolves in the consumer context** (returns `transient.priceInfo`, s0 = $1). csrWrapper has **no `offer`
namespace**.
**Ask:** (a) add `csrWrapper.api.offer.findByShmName`, and (b) make offer lookup resolve for the CSR
clientId/role. (Also: `comp.offer.agent.*` don't resolve even for consumers — please confirm the shm
names for CSR retention/comp offers.)

| | |
|---|---|
| **App / Page** | CSR/Admin — `UserDetailPage` (`/users/:id`) plan/price panel |
| **Function chain** | `api.adminFindOffer` → `apiWrapperCsr.csrFindOfferByShmName` → `POST /commerce/offer/findByShmName` (lib `csrWrapper.api.offer.findByShmName` — absent) |
| **Feature impacted** | Plan name + s0/s1 price on a user's order; the lookup CSR sales need |

## ASK B — no CSR `billing.sale` for on-behalf-of-customer orders  (ADD)

**Demo (live):** `csrWrapper.api.billing` is **absent**. The only `billing.sale` is the **consumer**
`ApiWrapper.api.billing.sale` (methods: `sale, tokenSale, signup, getOrders, getActivatedProductTypes,
cancelOrUncancelOrder`) — it has **no `payerId`**, so it bills the logged-in session user (the CSR, not
the customer); `sale` also needs the customer's full card (PCI). Today we hand-build `billingSeriesId`
on the direct `/commerceBilling/sale` or BC 406s.
**Ask:** add `csrWrapper.api.billing.sale({ payerId, …saleBody })` that injects `billingSeriesId`.

| | |
|---|---|
| **App / Page** | CSR/Admin — `UserDetailPage` (`/users/:id`) "create order" (`adminCreateOrder`) |
| **Function chain** | `api.adminCreateOrder` → `apiWrapperCsr.csrCreateOrder` → `POST /commerceBilling/sale {…, payerId, billingSeriesId:<hand-built>}` (lib `csrWrapper.api.billing.sale` — absent) |
| **Feature impacted** | CSR retention / comp / downsell order creation |

## ASK C — global order search (`commerceOrder`) is role-gated  (OPEN or ADD)

**Demo (live):** `POST /database/search {collectionName:'commerceOrder'}` → **403 "Invalid Database
Search Role."** for **every** brand. We fall back to a capped per-user fan-out (not a true global list).
**Ask:** open `commerceOrder` for the CSR role, or add a global order finder.

| | |
|---|---|
| **App / Page** | CSR/Admin — `OrdersPage` (`/orders`), `PurchasesPage` (`/purchases`) |
| **Function chain** | `api.adminListOrdersGlobal` → `apiWrapperCsr.csrFindOrders` → `POST /database/search {collectionName:'commerceOrder'}` (403) → fan-out fallback |
| **Feature impacted** | True global order/purchase search |

## CONFIRM — `userContact` data model (a question, not a defect)

**Demo (live):** `findUserContacts({userId})` reads `GET /contactMessage/admin/find/:userId` (returns the
member's contactMessages); direct `{collectionName:'userContact'}` → 403. Our write-path puts member
contacts in `contactMessage` (by `targetUserId`).
**Question:** is `userContact` a *separate* store with distinct data, or are member messages all
`contactMessage`-by-`targetUserId`? Cheap discriminator: do `userContactCsrMail` CSR replies land as
`contactMessage` thread histories or separate `userContact` docs? If not separate, nothing more is needed.

---

## Resolved on our side after re-testing (NOT BC asks — withdrawn)

- **`user.findAdmin` (CS-rep list) — our bug, now fixed.** It was returning 0 because **we** called it
  with `brandId:'idlookup'`; the staff live in the `admins` collection with `brandId:'bytecrtrs'`.
  `findAdmin({})` returns the 10 `csr`-role staff. We fixed `csrFindCsReps` to query `admins` (no
  idlookup brand) — `/cs-reps` now renders real staff. **No BC action.**
- **`tracking.findUser` — works.** It scopes to the target user via `query.updaterId` (3 stable runs →
  7 docs, all the target user). The direct call we used returns all users (top-level `updaterId`
  ignored). **No BC action.**
- **`optOut` / `managedContact` collections** — already readable.
- **Visitor contacts / link-contact** — covered by `message.contact.find` / `message.contact.setTargetUser`.
- **All CSR mutations** (cancel, refund, updateSchedule, user.update, setTags/setActor, updateNote,
  unsubscribe) — reachable + authorized for the CSR role (400 validation, not 403); any breakage is our
  param shape.

## Why this is shorter than before
We treat the runnable demo as a release gate: an ask only stays on the list if `demo-bc-csr-asks.js`
prints a verdict that matches BC's live response. Two asks failed that gate (findAdmin was our brandId
bug; tracking actually works) and were removed.
