# Message to BC — CSR lib methods, our findings after live re-testing

Hi — thanks for the suggestions on each item. We re-tested every one against the **deployed**
csrWrapper/ApiWrapper in a real authenticated CSR session (account: csrManager) before replying, so
the notes below are live results, not assumptions. Test record: user `6a30a88dce24e4018b18e016`.

Grouped into **(A) resolved on our side — no change needed from you**, and **(B) still needs a change**.

---

## A. Resolved — no BC change needed (2 items)

**2.4 — visitor contact messages → use `message.contact.find` ✅**
You're right. Live, `message.contact.find` returns the visitor submissions (20 docs, all
`type:"contact"`) via `GET /contactMessage/admin/find`. We'll use it and **withdraw** our request for
a separate `contact`-collection finder.

**2.7 — link a visitor contact to a user → use `message.contact.setTargetUser` (not `replyLinkUrl`)**
`replyLinkUrl` only returns a reply deeplink (`{replyLinkUrl:"…/contact?…&contactMessageId=…"}`) — no
`targetUserId`, associates nothing. But the right method already exists:
**`message.contact.setTargetUser`** (`POST /contactMessage/admin/setTargetUserId`). If you confirm it
performs the same association as `changeContactToUserContact`, we'll use it and **withdraw** that ask.
(Minor: `replyLinkUrl` returns a malformed host `https://dev./contact` — missing domain — likely a
separate config bug.)

---

## B. Still needs a change (6 items)

**3.1 — CSR-rep / admin-staff list (`user.findAdmin`).** `user.findAdmin({brandId})` returns **0**.
We tried to work around it with `user.find` + an `isAdmin` filter, but **`/database/search` ignores
`isAdmin`** (both top-level and under `query`): the result is byte-for-byte the **default user list**
(same `_id` set as an unfiltered query — regular customers, e.g. a test signup account shows up as the
first "admin"). So there is currently **no working way to retrieve the CSR/admin staff** — `findAdmin`
returns nothing, and `isAdmin` filtering is a no-op. **Please fix `user.findAdmin` to return the
admin/CSR users.**

**2.2 — per-user `userContact` notes/CSR-mail.** `findUserContacts` and `findUserAdminNotes` read
different collections — verified by the URL each hits live: `findUserContacts` → `GET
/contactMessage/admin/find/:userId` (contactMessage), `findUserAdminNotes` → `GET
/message/admin/findNotes` (admin notes). Neither reads the `userContact` collection. Our direct call
to it also fails: `POST /database/search {collectionName:'userContact', targetUserId}` → **403
"Invalid Database Search Role"**. **Please (1) open the `userContact` collection to the CSR role, and
(2) add a per-user finder** (`targetUserId`).

**2.3 — all-users `userContact` inbox.** Same two methods can't do this: both are **per-user only**
(with no userId, `findUserContacts({})` → 500, `findUserAdminNotes({})` → 400 "referenceId should not
be empty"), and they read the wrong collections. **Please add an all-users `userContact` finder** (and
open the collection, per 2.2).

**2.5 — CSR sale / order creation.** `ApiWrapper.billing.sale`/`tokenSale` are the **consumer**
methods and can't create an order for an existing customer: (1) no `payerId` — they bill the
logged-in session user, which in the CSR app is the CSR, not the customer (`payerId` appears 0× in the
deployed api-wrapper IIFE); (2) `sale` needs the customer's full card (PAN/CVV) a CSR never has (PCI);
(3) `tokenSale` charges the *session user's* token. csrWrapper has no `billing` namespace. **Please add
`csrWrapper.api.billing.sale({ payerId, …saleBody })`** that injects `billingSeriesId` itself (today we
hand-build it or BC 406s "billingSeriesId should not be empty"). Or confirm the consumer methods accept
a `payerId`/target-customer in a CSR session — neither deployed IIFE supports that today.

**2.6 — offer lookup by shm name.** csrWrapper has no `offer` namespace. The direct CSR endpoint
`POST /commerce/offer/findByShmName` returns **403 "No offer."** for every shmName we tried
(`comp.offer.signup.main`, `comp.offer.agent.retention`, `comp.offer.agent.comp` — the same names our
app uses), and the consumer `ApiWrapper.offer.findByShmName` returns the same in the CSR context. So we
have no working offer-lookup path for the CSR app (used on the user-detail screen). **Please (1) add
`csrWrapper.api.offer.findByShmName`, and (2) tell us why offer lookup 403s "No offer." in the CSR
context** (role gate? brand/clientId scoping?) so we can resolve offers there.

**3.2 — a user's tracking (Searches/Reports/Logins).** `tracking.findUser` can't be scoped to a
target user: with `updaterId` it returns **0**; with `targetUserId`/`userId` it returns 10 docs that
belong to **a different user** (all `updaterId 6a0b6e1d…`, not the target `6a30a88…` — appears to be
the caller's own events), and it **ignores `perPage`** (caps at 10 regardless). The direct call works:
`POST /database/search {collectionName:'trackings', query:{'data.type'}, updaterId, perPage:100}` → 100.
**Please let `tracking.findUser` scope to a target user (`updaterId`/`targetUserId`) and honor `perPage`.**

---

### Summary
- **Use as-is (no change needed):** `message.contact.find` (2.4), `message.contact.setTargetUser` (2.7, pending your equivalence confirm).
- **Open collection:** `userContact` (2.2/2.3).
- **Add lib method:** `userContact` finders per-user + all-users (2.2/2.3), CSR `billing.sale({payerId})` (2.5), `offer.findByShmName` (2.6).
- **Fix:** `user.findAdmin` returns 0 + `isAdmin` filter ignored (3.1), offer 403 "No offer." in CSR context (2.6), `tracking.findUser` scope+perPage (3.2).
