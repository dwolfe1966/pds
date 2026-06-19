# CSR (admin app) — feature status inventory

**As of 2026-06-18.** Grounded in this session's live testing against `dev.admin.www.bytecrtrs.com`
(account `frontend@csrManager.pds`). "Working" = data loads for the CSR role today. Mutations marked
UNVERIFIED were not exercised live (writes/charges — not safe to probe blindly).

Legend: 🟢 working · 🟡 partial/degraded · 🔴 broken · ⚪ stub (not wired to BC) · ❓ unverified

---

## 🔴 BROKEN — feature does not work

| Feature / page | Root cause | Owner |
|---|---|---|
| **Offer / plan-price display** (UserDetail order panel, `adminFindOffer`) | `offer.findByShmName` → **403 "No offer."** in CSR context for `comp.offer.signup.main`, **regardless of brandId** — yet that SAME shmName **resolves in the consumer context** (priceInfo returned). So it's a CSR-clientId/role resolution gap, not brand-param. No csrWrapper `offer` ns. (Sep. issue: `comp.offer.agent.*` don't resolve in dev even for consumers — confirm shm names.) | **BC** (add CSR `offer.findByShmName` + make it resolve for CSR clientId) |
| **Sessions / logs** (`/sessions`) | Reads the standalone **tracking-api** service (`TRACKING_URL/events`, port 3002), not BC. Empty/broken unless that service is deployed alongside the CSR app. | **us** (deploy/Wire tracking-api or repoint) |

> **FIXED 2026-06-18 (our side, was wrongly listed as broken):**
> - **CS-Rep management** (`/cs-reps`) + **Analytics** rep roster — staff live in the **`admins`**
>   collection (`roles:['csr']`, brandId `bytecrtrs`), NOT `users`. `findAdmin` works; we were
>   calling it with `brandId:'idlookup'` (→ 0). `csrFindCsReps` now queries `admins` (no idlookup
>   brand). UI-verified: `/cs-reps` renders the real csr-role staff, no customers. **Not a BC ask.**
> - **`tracking.findUser`** scopes correctly via `query.updaterId` (3 stable runs, all target user).
>   The Searches/Reports/Logins tabs work. **Not a BC ask.**

## 🟡 PARTIAL — core works, a sub-panel is empty/degraded

| Feature / page | What works / what doesn't | Note |
|---|---|---|
| **User detail "Notes & Messages"** (`/users/:id`) | Admin notes ✅ + member messages show in the **"Contact tickets"** panel ✅. The separate `userContact`-collection thread fetch (`adminFindUserContacts`) **403s** (caught → empty). | Likely fine — member msgs are contactMessages (see 2.2 reassessment). The dedicated userContact thread is empty. |
| **Mail activity** (`/mail-log`) | contactMessage-based view ✅; the `userContact` portion 403s (caught → empty). | Same root as above. |
| **Orders / Purchases global list** (`/orders`, `/purchases`) | Works via **fan-out fallback** (aggregates recent customers' orders) because global `commerceOrder` search **403s**. Not a true global list — capped to a recent-user pool. | **BC** (open `commerceOrder` or add global finder) for true global. |

## ⚪ STUB — page renders but is NOT wired to BC (localStorage-only)

| Page | State |
|---|---|
| **Permissions** (`/permissions`) | Local `useState`/localStorage only — not connected to BC permissions. |
| **Content** (`/content`) | localStorage only — not wired to BC ShapeCompiled content config. |
| **Offers / Products** (`/offers`) | localStorage only — not wired to BC offers (and offer lookup 403s anyway). |

## 🟢/❓ MUTATIONS — reachable + authorized (verified read-only 2026-06-18)

Probed write-safe (empty/invalid args → no record touched). **Every ID-gated mutation returned a 400
validation error, not 403/404 — i.e. reachable + authorized for the CSR role.** Not BC-blocked; any
breakage is *our-side param shape*. (`probe-csr-mutations-reachability.js`.)
- `cancelUncancelOrder` (needs `commerceOrderId`+`flag`), `refundVoidOrder` (needs `commercePaymentType`,
  `targetCommerceOrderId`+**RevisionId**, `targetCommercePaymentId`+**RevisionId**, `amount`),
  `updateSchedule` (needs **`scheduleId`**+`dueTimestamp`+`amount`), `user.update` (needs `userId`),
  `setTargetUser`/`setActor` (need **`currentRevisionId`**), `setTags`, `updateAdminNote`,
  `managedContact.unsubscribe` — all **400 = reachable**. ✅
- **Our-side risk to verify:** refund must supply the two revision IDs + `commercePaymentType`;
  updateSchedule must use `scheduleId` (not orderId); setTargetUser/setActor must fetch+pass
  `currentRevisionId`. Full end-to-end (actual write) still UNVERIFIED but not BC-gated.
- **Creates exist** (not called): `message.contact.create`, `createCsrReply`, note creates.
  `contact.changeContactToUserContact` **absent**. `ApiWrapper.billing.sale`/`tokenSale` exist;
  `csr.billing` absent (→ 2.5).

## 🟢 WORKING (verified live this session)

- **Customer search/list** (`/users`) — `user.find`.
- **User detail** core (`/users/:id`) — profile, orders, payments, order histories, contact tickets, admin notes, tracking tabs (Searches/Reports/Logins via direct `/database/search trackings`).
- **My dashboard** (`/my-dashboard`) — contact-message feed.
- **Tickets inbox + user-mode** (`/tickets`) — `message.contact.find`; **user-mode search fixed this session** (was throwing on the userContact 403).
- **Data Removal** (`/data-removal`) and **Unsubscribe** (`/unsubscribe`) lists — `optOutRequest` / `managedContact` collections (BC opened these; now readable).
- **Purchase detail** read (`/purchases/:id`) — `getUserOrder`.

---

## Priorities

1. **BC fixes that unblock features:** `findAdmin` (→ CS-Reps + Analytics), offer lookup in CSR context (→ price display), open `commerceOrder` (→ true global orders).
2. **Our side:** wire/deploy tracking-api or repoint Sessions; decide whether Permissions/Content/Offers stubs need BC wiring for launch; verify the mutation set (refund/cancel/sale) with a controlled live test.
3. **Confirm the 2.2/2.3 data model** with Kwan (is `userContact` separate?) — settles the two PARTIAL panels.
