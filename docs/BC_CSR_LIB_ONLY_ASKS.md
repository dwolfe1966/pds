# BC CSR asks — to run the CSR app with ZERO direct API calls

**Date:** 2026-06-22. **Context:** per BC (Kwan), client code must use **only csrWrapper lib methods**
— no direct `/api/...` calls. We audited the entire CSR direct-call surface (37 methods — full
inventory in `BC_CSR_DIRECT_CALL_AUDIT.md`) and verified the lib live with an auth-gated probe.

**Result: 4 asks** (was 5 — **Ask A resolved by Kwan 2026-06-23**, see below). Everything else either
already runs on the lib or migrates on **our** side (we drop the direct fallback ourselves — no BC
action). All asks below are in the **CSR/Admin app**.

> Two candidate asks (`findAdmin`/`/cs-reps` and `tracking.findUser` scoping) were investigated and
> **dropped** — auth-gated probing proved `findAdmin({})` returns the real CSR staff and
> `tracking.findUser` scopes correctly to one user; the earlier "0 docs" were a `{brandId:'idlookup'}`
> param trap + an un-authenticated session. They migrate clean.

Format per ask: (1) app · (2) use case + actor · (3) pages · (4) lib methods tried + why they fail ·
(5) the direct call we use today · (6) what actually happens (user-facing symptom) · (7) our specific
ask (method · params · return shape).

---

## ASK A — Offer / price lookup  ✅ RESOLVED 2026-06-23 (WITHDRAWN — no BC action)
**Kwan's answer (mtg 2026-06-23):** don't use the offer endpoint for the CSR price panel — use
**`csrWrapper.api.user.getOrder`** (already a working lib method we use). It carries the customer's
**name** (via the user record) and the **definitive** price the customer is actually billed:
- `order.schedule.data.totalPrice` → `{ amount, code }` — the next recurring charge (live-verified
  `49.98 usd`). *(Better than the offer's `s0/s1` template — it's this customer's actual price.)*
- `order.schedule.dueTimestamp` (+ `order.dueTimestamp`) → next/upcoming billing date.
- `order.transient.amount.collected` → collected to date; `order.status` → active/canceled.

Verified live 2026-06-22 (`scripts/probe-csr-getorder-price.js`). Implemented in `UserDetailPage` order
card (surfaces `schedule.data.totalPrice` next to the existing "Next: {date}"). **No BC method needed.**
The offer-template lookup (`adminFindOffer` for NEW retention/comp/signup sales) still 403s but it's the
*create-order* catalog (folds into Ask B) and already degrades to hardcoded fallback prices.

<details><summary>Original ask (kept for history — now withdrawn)</summary>

1. **App:** CSR/Admin.
2. **Use case + actor:** A CS agent views a customer's **plan name + price (s0/s1)** on their order — the
   lookup CSR sales rely on.
3. **Pages:** `UserDetailPage` (`/users/:id`) plan/price panel.
4. **Lib methods tried:**
   - `csrWrapper.api.offer.findByShmName` — **absent** (no `offer` namespace on csrWrapper).
   - consumer `ApiWrapper.api.offer` — resolves, but only in the **consumer** session; not usable from CSR.
5. **Direct call used:** `POST /commerce/offer/findByShmName { shmName }` → **403 "No offer."** in a CSR
   session (all brands).
6. **What actually happens:** the plan/price panel can't resolve, so the customer's **plan name and
   s0/s1 price don't load** — the CSR sees blank/placeholder pricing and can't tell what the customer is
   (or should be) paying. No crash; the price info is just absent, which also blocks any price-aware CSR
   sale decision.
7. **Our specific ask:**
   - **Method:** add `csrWrapper.api.offer.findByShmName(params)` **and** grant the CSR clientId/role
     permission to resolve offers (today it 403s "No offer.").
   - **Params:** `{ shmName: string, key?: string }` (key defaults to `'main'`).
   - **Return:** the offer object the consumer already gets — `{ shmName, extName, transient: {
     priceInfo: { s0: { amount, code }, s1: { amount, code } } }, … }`. (Same payload
     `ApiWrapper.api.offer.findByShmName` returns in the consumer context.)

</details>

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
6. **What actually happens:** under the lib-only mandate there is **no working path** — the "create order"
   action has no lib method, so a CSR **cannot place an order on behalf of a customer** (retention / comp /
   downsell are dead). Even today via the direct call it's fragile: forget the hand-built
   `billingSeriesId` and BC rejects the sale with a **406**.
7. **Our specific ask:**
   - **Method:** add `csrWrapper.api.billing.sale(params)` that bills the **customer** (not the CSR
     session user) and **injects `billingSeriesId` server-side** (so we stop hand-building it / hitting 406).
   - **Params:** `{ payerId: string, offerShmName: string, sequenceOption?: {…thin-match flags},
     paymentMethodId?: string }` — charge the customer's **payment method on file** via `payerId` (no raw
     PAN passed from the CSR, so no PCI surface). `billingSeriesId` is NOT a caller param (BC sets it).
   - **Return:** the created order, same shape as the consumer sale — `{ success: true, order: { _id,
     subStatus, dueTimestamp, … } }`.

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
6. **What actually happens:** there is **no true global order list** — the Orders/Purchases pages can only
   show a stitched-together, capped per-user fan-out, not all orders. A CSR **can't answer "show me all
   orders/purchases" or sort/filter across customers** (e.g. "every order placed today"); they're limited
   to looking up one known customer at a time.
7. **Our specific ask:** *(either is fine)*
   - **(a)** open the `commerceOrder` collection to the CSR role on the existing
     `POST /database/search` (today: 403 "Invalid Database Search Role."), **or**
   - **(b)** add a dedicated finder `csrWrapper.api.order.findOrders(params)`.
   - **Params:** `{ brandId?, perPage?, lastId?, query?: { createdAt?: {from,to}, subStatus?, email? } }`
     (paginate via `lastId`; optional server-side date/status/email filter).
   - **Return:** the standard list envelope — `{ docs: [ …commerceOrder ], noMoreDocs, displayFields }`
     (same shape as `user.findOrders`, just not scoped to one `userId`).

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
6. **What actually happens:** the pages **don't crash** (the 403 is swallowed) — they render whatever the
   *other*, working source provides. A customer's message history has two parallel sources: the
   **contactMessage** collection (read via the working `message.contact.find` — contact-form submissions
   + CSR thread replies) and the **userContact** collection (read only via the gated direct call —
   CSR-outbound mail `userContactCsrMail` + member replies/notes stored there). So **common-case messages
   still appear**, but any **userContact-collection records are silently missing** — no error, just absent
   rows. A CSR can believe they see the full history when they don't. *(Whether the gap is real depends on
   the data-model question above: if `userContact` is just `contactMessage`-by-`targetUserId`, nothing is
   missing.)*
7. **Our specific ask:** *(first, answer the data-model question; then one of)*
   - **If `userContact` is a separate store:** add **two** finders —
     `csrWrapper.api.userContact.findByUser({ targetUserId, lastId?, perPage? })` (per-user) and
     `csrWrapper.api.userContact.findAll({ lastId?, perPage?, query? })` (all-users inbox) — **or**
     open the `userContact` collection to the CSR role on `POST /database/search`.
   - **Return:** `{ docs: [ …userContact ], noMoreDocs, displayFields }` (each doc = a member reply or
     `userContactCsrMail`, with `targetUserId`, `createdAt`, body/content).
   - **If it is NOT a separate store** (all member messages are `contactMessage`-by-`targetUserId`):
     **no new method needed** — just confirm, and we drop these two reads in favor of
     `message.contact.find` (already working).

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
6. **What actually happens:** a customer's **older tickets disappear from their Messages tab once the
   inbox grows large.** Because consumer contact-form messages link to the member only by **sender email**
   (no `targetUserId`), the only way to find them is to page the whole inbox client-side and match by
   email — capped at **40 pages**. In low volume it's fine; in production a customer's older tickets sit
   **beyond the scan window and are never found** (e.g. a May ticket invisible when viewing the customer in
   June). The CSR sees a **partial ticket history**, plus up to 40 round-trips of latency each lookup.
7. **Our specific ask:**
   - **Method:** extend the existing `csrWrapper.api.message.contact.find(params)` to accept a
     **server-side `email` (and/or `targetUserId`) filter** (no new method needed).
   - **Params:** `{ email?: string, targetUserId?: string, lastId?, perPage? }` — when `email` is
     supplied, BC returns only that member's contactMessages (matching `content.input.email`), so we stop
     scanning the whole inbox.
   - **Return:** the same envelope `message.contact.find` already returns — `{ docs: [ …contactMessage ],
     noMoreDocs, displayFields }` — just server-side-filtered to the one member.

---

## Not asks — we migrate these ourselves (lib verified live, no BC action)
`user.find`, `user.findAdmin` (no brand → CSR staff), `user.findOrders`, `user.findOrderPayments`,
`user.findOrderHistories`, `user.getUserDetail`, `user.getOrder`, `message.contact.find`,
`message.contact.histories`, `message.contact.replyLinkUrl`, `managedContact.find`, `optOut.find`,
`tracking.findUser` (scopes per-user). We drop the direct fallback and delete the dead
`/database/search` ladders. See `BC_CSR_DIRECT_CALL_AUDIT.md` §C/§D for evidence.
