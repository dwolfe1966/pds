# BC CSR asks — to run the CSR app with ZERO direct API calls

**Date:** 2026-06-22. **Context:** per BC (Kwan), client code must use **only csrWrapper lib methods**
— no direct `/api/...` calls. We audited the entire CSR direct-call surface (37 methods — full
inventory in `BC_CSR_DIRECT_CALL_AUDIT.md`) and verified the lib live with an auth-gated probe.

**Result: 5 asks.** Everything else either already runs on the lib or migrates on **our** side (we drop
the direct fallback ourselves — no BC action). All 5 below are in the **CSR/Admin app**.

> Two candidate asks (`findAdmin`/`/cs-reps` and `tracking.findUser` scoping) were investigated and
> **dropped** — auth-gated probing proved `findAdmin({})` returns the real CSR staff and
> `tracking.findUser` scopes correctly to one user; the earlier "0 docs" were a `{brandId:'idlookup'}`
> param trap + an un-authenticated session. They migrate clean.

Format per ask: (1) app · (2) use case + actor · (3) pages · (4) lib methods tried + why they fail ·
(5) the direct call we use today.

---

## ASK A — Offer / price lookup
1. **App:** CSR/Admin.
2. **Use case + actor:** A CS agent views a customer's **plan name + price (s0/s1)** on their order — the
   lookup CSR sales rely on.
3. **Pages:** `UserDetailPage` (`/users/:id`) plan/price panel.
4. **Lib methods tried:**
   - `csrWrapper.api.offer.findByShmName` — **absent** (no `offer` namespace on csrWrapper).
   - consumer `ApiWrapper.api.offer` — resolves, but only in the **consumer** session; not usable from CSR.
5. **Direct call used:** `POST /commerce/offer/findByShmName { shmName }` → **403 "No offer."** in a CSR
   session (all brands).

## ASK B — CSR billing sale (order on behalf of a customer)
1. **App:** CSR/Admin.
2. **Use case + actor:** A CS agent creates an order **for a customer** — retention / comp / downsell.
3. **Pages:** `UserDetailPage` (`/users/:id`) create-order.
4. **Lib methods tried:**
   - `csrWrapper.api.billing.sale` — **absent** (no `billing` namespace).
   - consumer `ApiWrapper.api.billing.sale` — exists but **no `payerId`** → bills the logged-in CSR, not
     the customer; also needs the customer's full card (PCI).
   - consumer `ApiWrapper.api.billing.tokenSale` — charges the **session user's** token, not the customer's.
5. **Direct call used:** `POST /commerceBilling/sale { …saleBody, payerId, billingSeriesId:<hand-built> }`
   (must inject `billingSeriesId` or BC 406s).

## ASK C — Global order / purchase search
1. **App:** CSR/Admin.
2. **Use case + actor:** A CS agent searches **all orders/purchases** across customers (not one user's).
3. **Pages:** `OrdersPage` (`/orders`), `PurchasesPage` (`/purchases`).
4. **Lib methods tried:**
   - `csrWrapper.api.user.findOrders` / `findUserOrders` — exists but **per-user only** (requires
     `userId`); not a global finder.
   - No global `commerceOrder` finder on csrWrapper.
5. **Direct call used:** `POST /database/search { collectionName:'commerceOrder' }` → **403 "Invalid
   Database Search Role."** (all brands; also tried `commerceOrders` plural). Falls back to a capped
   per-user fan-out.

## ASK D — `userContact` reads (member message / note history)
1. **App:** CSR/Admin.
2. **Use case + actor:** A CS agent reads a customer's **message / note history** (user detail + inbox).
3. **Pages:** `UserDetailPage`, `MailActivityPage`, `NotesPage`, `EmailTicketsPage`.
4. **Lib methods tried:**
   - `csrWrapper.api.user.findUserContacts({userId})` — exists but reads
     `/contactMessage/admin/find/:userId` → returns the **contactMessage** collection, *not* `userContact`.
   - `csrWrapper.api.user.findUserAdminNotes` — exists but reads `/message/admin/findNotes` → returns
     **admin notes**, *not* `userContact`.
   - No all-users `userContact` finder.
5. **Direct call used:** `POST /database/search { collectionName:'userContact', targetUserId? }` (per-user
   with `targetUserId`; all-users without) → **403 "Invalid Database Search Role."**
   - **Data-model question:** if member messages are in fact all `contactMessage`-by-`targetUserId`, this
     downgrades to a migration and no new method is needed.

## ASK E — Server-side email filter on contactMessage lookup
1. **App:** CSR/Admin.
2. **Use case + actor:** A CS agent views **all of one member's tickets**, including older ones beyond
   page 1, on the user-detail page.
3. **Pages:** `UserDetailPage` (Messages), `EmailTicketsPage`.
4. **Lib methods tried:**
   - `csrWrapper.api.message.contact.find` — works, returns the inbox, but has **no server-side
     email/targetUserId filter**, so a member's older tickets sit beyond page 1.
   - `csrWrapper.api.user.findUserContacts({userId})` (targetUserId-keyed) — returns **200-but-empty** for
     consumer contact-form messages, which carry no `targetUserId` (linked only by sender email).
5. **Direct call used:** per-user `POST /contactMessage/admin/find/:userId`, plus a bounded **client-side
   scan of up to 40 inbox pages** (`/contactMessage/admin/find`) filtering by email/`targetUserId`.

---

## Not asks — we migrate these ourselves (lib verified live, no BC action)
`user.find`, `user.findAdmin` (no brand → CSR staff), `user.findOrders`, `user.findOrderPayments`,
`user.findOrderHistories`, `user.getUserDetail`, `user.getOrder`, `message.contact.find`,
`message.contact.histories`, `message.contact.replyLinkUrl`, `managedContact.find`, `optOut.find`,
`tracking.findUser` (scopes per-user). We drop the direct fallback and delete the dead
`/database/search` ladders. See `BC_CSR_DIRECT_CALL_AUDIT.md` §C/§D for evidence.
