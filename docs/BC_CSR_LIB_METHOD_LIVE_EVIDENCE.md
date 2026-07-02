# BC CSR lib methods — LIVE evidence (re-verified, not from memory)

**Run:** 2026-06-17 · **Account:** `frontend@csrManager.pds` (csrManager) · **Env:** `dev.admin.www.bytecrtrs.com`
**Method:** every csrWrapper lib method called against the **deployed** IIFE in a real authenticated
session; backend URL + status + doc count + sample captured per call. Direct `/api/database/search`
contrast run in the **same** session (authenticated with the login `clientId/apiId`).
**Probe:** `scripts/probe-csr-all-lib-methods.js` · raw output: `scripts/out/all-lib-methods.json`
**Test record:** user `6a30a88dce24e4018b18e016` (`testingreg061526d@idlookup.ai`), order `6a30a88dce24e4018b18e032`,
contactMessage `6a31ca36f009300c72f299b2`.

> This supersedes prior point-in-time notes. Where it disagrees with earlier docs, **this run is authoritative.**

---

## 1. Two EXISTING lib methods that are broken — BC must fix: `user.findAdmin` (3.1) + `tracking.findUser` (3.2)

These two methods exist on the deployed csrWrapper but don't return the data they should. Details
here; the full param-by-param self-review (including the `_id`-equivalence check) is in **§5b**.

### `tracking.findUser` (item 3.2) — a user's Searches / Reports / Logins
| | Call | Result |
|---|---|---|
| **Lib** | `tracking.findUser({ type:'USER:login', updaterId:'6a30a88…', perPage:100 })` | **0 docs** |
| **Lib** | `tracking.findUser({ type:'USER:login', targetUserId:'6a30a88…', perPage:100 })` | 10 docs — but they're a **different user's** events (`updaterId 6a0b6e1d…`), and `perPage` is ignored |
| **Direct (works)** | `POST /database/search { collectionName:'trackings', query:{'data.type':'USER:login'}, updaterId:'6a30a88…', perPage:100 }` | **100 docs** (app then client-filters by `updaterId`) |

→ The lib can't be scoped to a target user and ignores `perPage`. **Ask:** make `tracking.findUser`
honor `updaterId`/`targetUserId` scoping + `perPage`.

### `user.findAdmin` (item 3.1) — CSR-rep / admin-staff list
| | Call | Result |
|---|---|---|
| **Lib** | `user.findAdmin({ brandId:'idlookup', perPage:10 })` | **0 docs** |
| direct `{collectionName:'users', isAdmin:true}` | 10 docs — but **NOT staff** | `isAdmin` is **ignored**; `_id`-equal to the unfiltered default user list (regular customers) |
| `user.find({ isAdmin:true })` (our attempted workaround) | 10 docs — same default list | also ignored |

→ `findAdmin` returns 0 **and** `isAdmin` filtering is a no-op everywhere, so there is **no working
path to the CSR/admin staff** (not even a direct one). **Ask:** make `user.findAdmin` actually return
the admin/CSR users.

---

## 2. Item 2.2 — REASSESSED 2026-06-18: Kwan is likely RIGHT; `findUserContacts` + `findUserAdminNotes` cover it

> **UPDATE 2026-06-18 — supersedes the original §2 analysis below.** Kwan's point: the test user
> `6a30a88` simply had no messages, so the 0-results were *data*, not a method bug. Re-checking live:
> that user now has **1 contactMessage** (`6a31ca36`, `targetUserId=6a30a88`) and **1 admin note**, and
> `findUserContacts`→**1** / `findUserAdminNotes`→**1** return them. More importantly, **our own
> write-path agrees with Kwan**: `submitContact` (api.js:785–845) routes *member* contact submissions
> to `message.contact.create` → the **`contactMessage`** collection with `targetUserId` set, and
> `findUserContacts` reads `/contactMessage/admin/find/:userId` *by targetUserId* — i.e. it reads back
> exactly what members write. So "a single user's messages & notes" = contactMessages-by-`targetUserId`
> (`findUserContacts`) + admin notes (`findUserAdminNotes`). **We are conceding 2.2 to Kwan's methods.**
>
> **One open confirmation (doesn't block conceding):** our code also references a `userContact`
> collection (`/database/search collectionName=userContact`, the `userContactCsrMail`/`userContact`
> types, `/message/userContact/list`). We can't read it (403) to tell whether it's a *separate* store
> with data `findUserContacts` misses, or just a legacy alias for "contactMessage by targetUserId."
> Asked Kwan to confirm. If it's all contactMessage → 2.2 fully closed.
>
> _Original (pre-reassessment) analysis retained below for the record:_

### (Original) `findUserContacts` / `findUserAdminNotes` do NOT read the `userContact` collection

Verified by the **backend URL each method actually hit** (decisive — independent of doc count):

| Lib method | Backend URL hit (live) | Collection it reads |
|---|---|---|
| `user.findUserContacts({ userId })` | `GET /api/contactMessage/admin/find/6a30a88dce24e4018b18e016` | **contactMessage** (public contact-form tickets) |
| `user.findUserAdminNotes({ userId })` | `GET /api/message/admin/findNotes?referenceId=…&referenceCollection=users` | **admin notes** |

Neither touches the `userContact` collection (the `userContactCsrMail` CSR-outbound + `userContact`
member-inbound thread — the same data BC's own `getUserContacts` / `/message/userContact/list` serves
to the member's message center). Both returned 0 for this test user simply because he has no
tickets/notes — but the **URL** proves the collection mismatch.

**Direct call we issue today for this data — ALSO blocked (live 2026-06-17):**
```
POST /api/database/search { collectionName:'userContact', targetUserId:'<userId>' }
→ 403 "Invalid Database Search Role."
POST /api/database/search { brandId:'idlookup', collectionName:'userContact', targetUserId:'<userId>' }
→ 403 "Invalid Database Search Role."
```
So for the userContact data there is currently **no working path** for our role: the lib methods read
the wrong collections (above), and the direct `userContact` call is role-gated. (Auth is fine — the
same in-session auth returned 200 for the `users`/`trackings` direct calls in §1; only `userContact`
403s. Tested under `frontend@csrManager.pds` — the only account available to us.)

**Ask (reframed):** (1) **open the `userContact` collection** to the CSR role (it's still gated, unlike
`optOut`/`managedContact` which you opened — §4), **and** (2) add a per-user finder for
`collectionName:'userContact'` keyed by `targetUserId`.

---

## 2b. Item 2.3 — REASSESSED 2026-06-18: Kwan now says `message.contact.find`; likely RIGHT

> **UPDATE 2026-06-18 — supersedes the original §2b below.** Kwan's revised answer for 2.3 is
> `csrWrapper.api.message.contact.find` (not the two per-user methods he first cited). Given the §2
> reassessment — member messages are written to the **`contactMessage`** collection (linked by
> `targetUserId`) — `message.contact.find` returns **all** contactMessages (members + visitors) =
> the unified inbox. So it **likely covers 2.3**, consistent with it being correct for 2.4. **We are
> conceding 2.3 to `message.contact.find`**, pending the same data-model confirmation as §2 (is the
> `userContact` collection a separate store, or all contactMessage-by-targetUserId?).
>
> _Original (pre-reassessment) analysis retained below for the record:_

### (Original) `findUserContacts` / `findUserAdminNotes` CANNOT serve the all-users inbox

BC suggested the **same two methods** for item 2.3 (list ALL `userContact` records / unified inbox).
They fail on **two independent counts** — verified live 2026-06-17 (login confirmed: `user.find`
returned docs first, so these are real per-call results, not session glitches):

**(i) Both are hard PER-USER — they cannot enumerate all users.** Called with no userId:
| Call | Backend URL hit | Result |
|---|---|---|
| `user.findUserContacts({})` | `GET /api/contactMessage/admin/find/undefined` | **HTTP 500** "Internal server error" (userId is a required path param) |
| `user.findUserContacts()` | — (throws before request) | `TypeError: Cannot read properties of undefined (reading 'userId')` |
| `user.findUserAdminNotes({})` | `GET /api/message/admin/findNotes` | **HTTP 400** "referenceId must be a mongodb id / should not be empty" |

With a real userId they return cleanly (0 docs for this test user) — confirming they only work
**one user at a time**. There is no all-users variant.

**(ii) Wrong collection** (same as §2): they read `contactMessage` and admin-notes, not `userContact`.

So item 2.3 cannot be built from these even by iterating: it would be the wrong collection, and
there is no global user-list finder to drive the iteration anyway.

**Direct call we issue today for the all-users inbox — ALSO blocked (live 2026-06-17):**
```
POST /api/database/search { collectionName:'userContact', perPage:20 }                 → 403 "Invalid Database Search Role."
POST /api/database/search { brandId:'idlookup', collectionName:'userContact', perPage:20 } → 403 "Invalid Database Search Role."
```
Same situation as 2.2: no working path for our role — lib reads the wrong collection, direct is
role-gated. (Same auth that returned 200 for `users`/`trackings` in §1; only `userContact` 403s.)

**Ask (reframed):** (1) **open the `userContact` collection** to the CSR role, **and** (2) add an
all-users finder for it (`csrWrapper.api.userContact.findAll({ perPage, lastId })`).

## 2c. Item 2.4 — visitor contact messages: BC is CORRECT, `message.contact.find` covers it ✅

Unlike 2.2/2.3, here BC's suggestion holds. Verified live 2026-06-17 (login-confirmed):

| Call | Endpoint | Result |
|---|---|---|
| **Lib** `csrWrapper.api.message.contact.find({ perPage:20 })` | `GET /api/contactMessage/admin/find` | **20 docs, all `type:"contact"`** — the visitor contact messages ✅ |
| **Direct (our original 2.4 call)** `POST /database/search { collectionName:'contact' }` | `POST /api/database/search` | **403 "Invalid Database Search Role"** (gated) |

`message.contact.find` returns the visitor contact-form submissions (`type:"contact"`). It is also
**already what our Visitor/contact inbox UI uses** (`csrFindContactMessages`); the separate
`contact`-collection call (`csrFindContacts`) is plumbed but **invoked by no page** — dead path.

**Resolution: we WITHDRAW the item-2.4 ask** (the `contact`-collection finder) and use
`message.contact.find`. One honest caveat: we couldn't diff against the raw `contact` collection
(it's 403), so we can't *prove* `message.contact.find` is the complete set — but there's no functional
gap (our UI already relies on it and the `contact`-collection path is unused).

## 2d. Item 2.5 — CSR sale: `ApiWrapper.billing.sale`/`tokenSale` can't do on-behalf-of sales

BC suggested the **consumer** `ApiWrapper.api.billing.tokenSale` / `ApiWrapper.api.billing.sale`.
Verified live in the admin context 2026-06-17:

- `window.ApiWrapper` **is** loaded in the admin build, and `billing.sale` + `billing.tokenSale`
  both exist. Full consumer billing surface: `[sale, tokenSale, signup, getOrders,
  getActivatedProductTypes, cancelOrUncancelOrder]`.
- `window.CsrWrapper` has **no `billing` namespace** (re-confirmed).

**But these consumer methods cannot create a CSR order for an existing customer:**

1. **No `payerId` / on-behalf-of param.** The consumer billing methods operate on the **logged-in
   session user**. There is no parameter to attribute the order to a different customer. (`payerId`
   appears **0×** in both the local and the deployed `api-wrapper` IIFE source; it's not in the
   billing method list.) In the CSR app the session is the CSR's (`csrManager`), so a sale would be
   attributed to the CSR, not the customer.
2. **`billing.sale` requires the customer's full card** — `billings:[{creditCard:{pan,expMonth,expYear,cvv}}]`
   + `userInfo`. A CSR doing retention/comp/downsell on an existing customer never has the raw PAN/CVV
   (PCI), so this path is unusable for them.
3. **`billing.tokenSale` uses the *session user's* stored token** — i.e. the CSR's, not the
   customer's. With no `payerId`, it can't charge the customer's saved card on their behalf.

**Direct call we issue today** (`csrCreateOrder`, apiWrapperCsr.js):
```
POST /api/commerceBilling/sale
{ ...saleBody, payerId:'<customerUserId>', billingSeriesId:'<we hand-build, type "sale">' }   // admin session (connect.sid)
→ CSR-initiated order on the customer's account
```
We hand-build `billingSeriesId` because there's no CSR billing.sale to inject it; without it BC 406s
"billingSeriesId should not be empty". (Not executed in this probe — a real sale creates a real
order/charge; this is the path our code uses, flagged in-code as "validate with one real low-value sale".)

**Ask (unchanged):** add `csrWrapper.api.billing.sale({ payerId, ...saleBody })` on the CSR IIFE that
injects `billingSeriesId` itself (like the consumer wrapper does for consumer sales). *Or* confirm the
consumer `billing.sale`/`tokenSale` accept a `payerId`/target-customer when called in a CSR session —
which neither deployed IIFE supports today.

## 2e. Item 2.7 — link a visitor contact to a user: `replyLinkUrl` is the wrong method

BC suggested `csrWrapper.api.message.contact.replyLinkUrl`. That's a different operation — verified
live 2026-06-17:

- `message.contact.replyLinkUrl({ messageId })` → `GET /contactMessage/admin/replyUrl` → returns
  **just a URL**: `{ replyLinkUrl: "https://dev./contact?type=contact&hash=…&contactMessageId=…" }`.
  It's a read-only deeplink generator (the link a user gets by email to reply). It has **no
  `targetUserId` param** and **associates nothing** — it cannot link a contact to a user.

**The method that actually does this already exists** — `message.contact.setTargetUser`
(`POST /contactMessage/admin/setTargetUserId`), which our code wraps as `csrSetContactTargetUser`
("Links a contactMessage to a specific user so it appears in findUserContacts"). Confirmed present on
the live csrWrapper (`setTargetUser` = function). Since visitor contacts ARE contactMessages (§2c),
this should cover "link a visitor contact to a user."

`contact.changeContactToUserContact` (our original ask) is confirmed **absent** (no `contact`
namespace) — and it's also dead plumbing on our side (wired at `apiRouterAdmin.js:350` but invoked by
no page).

**Resolution / ask:** the right answer is `message.contact.setTargetUser`, not `replyLinkUrl`. If BC
confirms `setTargetUser` performs the same association as `changeContactToUserContact` (sets the
contact's `targetUserId` so it surfaces under the user), we **withdraw** the
`changeContactToUserContact` ask and use `setTargetUser`. (We have not executed `setTargetUser` — it
mutates a record — so please confirm equivalence, or flag any difference, e.g. collection conversion.)

> Aside (separate BC bug): `replyLinkUrl` returned a malformed host `https://dev./contact` (missing
> domain). Not part of 2.7, but worth fixing.

## 2f / 5b. Self-review of items 2.6, 3.1, 3.2 (NOT yet sent to BC) — can existing methods cover them?

Tested live 2026-06-17 before asking BC, to avoid requesting what we can self-serve.

### 3.1 `user.findAdmin` (CSR-rep list) — NOT self-serve, STILL NEEDS BC FIX ❌
Count looked solved (all return 10), but `_id`-equivalence flips it — **`isAdmin` is IGNORED by
`/database/search`**:
| Call | count | `_id` set |
|---|---|---|
| `user.findAdmin({brandId})` | **0** | — (broken) |
| direct `/database/search {collectionName:'users', isAdmin:true}` | 10 | == unfiltered default |
| `user.find({brandId, isAdmin:true})` | 10 | == unfiltered default |
| `user.find({brandId})` (unfiltered) | 10 | (baseline) |
All three 10-doc results are the **same `_id` set** — the default user list (regular customers; the
first "admin" is our test signup user `6a30a88…`). So `isAdmin` filtering is a no-op and there is **no
working path to the CSR/admin staff**. (This also means the §1 "findAdmin lib 0 / direct 10" contrast
was misleading — that "10" is the default list, not staff.) **Keep the BC-fix ask for `findAdmin`.**
⚠ Do NOT route `csrFindCsReps` through `user.find`+isAdmin — it would show customers as CSR reps.

### 3.2 `tracking.findUser` — STILL NEEDS BC FIX ❌
No param shape returns the target user's events:
| Call | count | whose events |
|---|---|---|
| direct `/database/search {trackings, query:{'data.type'}, updaterId, perPage:100}` | 100 | all users (app client-filters) |
| `tracking.findUser({type, updaterId, perPage:100})` | 0 | — |
| `tracking.findUser({type, targetUserId, perPage:100})` | 10 | **wrong user** — all 10 are `updaterId 6a0b6e1d…` (the caller), NOT target `6a30a88…` |
| same with `perPage:10` | 10 | — (perPage ignored either way) |
→ Confirms List C: `tracking.findUser` returns the **caller's own** events, ignores the target-user
param, and caps at 10 (ignores `perPage`). Keep the BC-fix ask.

### 2.6 `offer.findByShmName` — STILL NEEDS BC ❌ (and it's a CSR-context resolution bug)
Offer lookup is used by admin `UserDetailPage:972` (`adminFindOffer`). Live:
| Call | Result |
|---|---|
| csrWrapper `offer` namespace | **absent** |
| direct CSR `/commerce/offer/findByShmName` ({signup.main}, {signup}+key, {agent.retention}, {agent.comp}) | **403 "No offer."** (all) |
| consumer `ApiWrapper.offer.findByShmName` (same shmNames, admin context) | **"No offer."** (all) |
| (consumer site, consumer context — for contrast) | the SAME `comp.offer.signup.main` resolves fine |
→ The offer exists (resolves in the consumer context) but **does not resolve in the CSR/admin
context** — looks like a brand/clientId scoping issue, not just a missing method. Ask BC to (a) add
`csrWrapper.api.offer.findByShmName`, AND (b) make offer lookup resolve under the CSR/admin context
(today it 403s "No offer." for every shmName via every path).

## 3. List B "please ADD" — confirmed ABSENT on the live IIFE

Introspected the deployed `csrWrapper.api` tree directly; these have **no namespace at all**
(`exists:false`, no siblings):

- `billing.sale` — **absent** (no `billing` namespace)
- `offer.findByShmName` — **absent** (no `offer` namespace)
- (`contact.find` no longer requested — superseded by `message.contact.find`, see §2c)
- (`contact.changeContactToUserContact` no longer requested — superseded by existing
  `message.contact.setTargetUser`, see §2e; pending BC confirmation of equivalence)
- No global `commerceOrder` finder and no all-user `userContact` finder exist either.

---

## 4. Corrections to earlier state (BC has opened more than we last recorded)

| Collection / method | Earlier note (2026-06-16) | **Live 2026-06-17** |
|---|---|---|
| `managedContact.find` (Unsubscribe list) | 403 "Invalid Database Search Role" | **READABLE — returned 10 real docs** |
| `optOut.find` (Data Removal list) | 403 | **READABLE — clean empty envelope (200)** |
| `userContact` collection (2.2/2.3) | 403 | **STILL 403 "Invalid Database Search Role"** (direct call, both shapes) |

→ `optOut`/`managedContact` can now be migrated to the lib (no BC action needed; re-verify with a
filtered query before switching). `userContact` remains gated — see §2 / §2b.

---

## 5. Everything already migrated still works (regression check, live)

| Lib method | Endpoint | Result |
|---|---|---|
| `user.find` | `POST /database/search` (users) | 10 docs |
| `user.getUserDetail` | `POST /user/management/detail` | full user object |
| `user.findOrders` | `POST /commerceMgmt/userOrders` | 1 order |
| `user.getOrder` | `POST /commerceMgmt/getUserOrder` | order object |
| `user.findOrderPayments` | `POST /commerceMgmt/orderPayments` | 1 payment |
| `user.findOrderHistories` | `POST /commerceMgmt/orderHistories` | 1 history |
| `message.contact.find` | `GET /contactMessage/admin/find` | 20 docs |
| `message.contact.histories` | `GET /contactMessage/admin/histories` | 1 |

---

## Net asks for BC after this run

1. **FIX** `user.findAdmin` (returns 0; `isAdmin` filter is a no-op → no path to CSR staff, §1/§5b) and
   `tracking.findUser` (returns 0 / caller's events; ignores `perPage`, §1/§5b).
2. **ADD** `csrWrapper.api.billing.sale({ payerId, … })` (§2d) and `offer.findByShmName` + fix offer
   resolution in the CSR context (§5b). (Global `commerceOrder` finder still open if needed.)
3. **CONFIRM** the data model (closes 2.2/2.3): is the `userContact` collection a *separate* store, or
   is member correspondence all `contactMessage` linked by `targetUserId`? If the latter, 2.2/2.3 are done.
4. **WITHDRAWN / CONCEDED by us:**
   - 2.2 → `findUserContacts` + `findUserAdminNotes` (§2, reassessed — member msgs are contactMessages).
   - 2.3 → `message.contact.find` (§2b, reassessed).
   - 2.4 → `message.contact.find` (§2c). · 2.7 → `message.contact.setTargetUser` (§2e, pending equivalence).
   - No longer needed: opening `managedContact` / `optOutRequest` — already readable (§4).

---

### Caveat on the probe
The first run hit a login-timing glitch (session not fully authenticated → spurious blanket 403s on
every `/database/search` call). The numbers in this doc are from the clean run where ID discovery
succeeded and results are internally consistent (`user.find` returns data, dedicated endpoints return
data, direct contrast returns 200 + rows). Tighten the login-wait in the probe before relying on it again.

---

## Addendum 2026-06-26 — ASK D: `attachment.download` won't serve live-call recordings

**Live, byte-verified.** `csrWrapper.api.attachment.download({ attachmentId:'6a3d7295d2a2310fd7ef9ed9' })`
→ **"attachment not found"**. The sent `attachmentId` **exactly equals** the attachment object's `id`
field, so it is **not a client wiring bug** (client wiring confirmed complete — link shipped in commits
`958acb0` + `bd3b5e0`, clickable + correct label).

**Attachment object** (from `findUserContactMessages`/histories):
`{ fieldname:'file', originalname:'liveCall_27.aac', mimetype:'audio/aac',
id:'6a3d7295d2a2310fd7ef9ed9', filename:'liveCall_27.aac', size:157037, bucketName:'attachments',
metadata:{compressed:'zstd', …} }`

**Parent message:** `type:'contact'`, `data.type:'outbound'`, `liveCallId:27`, **`brandId:'unknown'`**,
`trackingIds.clientId:'curl'` / `apiId:'cli'` (telephony backend).

**Root cause (bc-iife-investigator, against the deployed csrWrapper bundle):**
- NOT a bucket problem — recording is in `bucketName:'attachments'`, the same bucket as ordinary attachments.
- Discriminator is parent-message **`brandId:'unknown'`** → the brand-scoped lookup appears to exclude
  telephony attachments.
- Deployed csrWrapper has **no** live-call/recording method (`liveCall.*`/`recording.*`/`call.*`/`voice.*`
  all absent); `/attachment/download` is the only file-retrieval path.

**Two resolution paths offered to BC:**
- (a) Fix server-side retrieval so `attachment.download` serves telephony / `brandId:'unknown'` attachments; OR
- (b) Name an extra param (e.g. `brandId` / `bucketName`) we should forward. The IIFE auto-forwards unknown
  params as GET params (`const {playAudioFlag, ...o}=e; params:o`), so path (b) needs **no IIFE change on
  our side**. `playAudioFlag` is stripped pre-GET → **not** the fix.

**Status:** ❌ open. Reproduced live, not yet wired into `demo-bc-csr-asks.js` (the byte-verification above
stands as the proof; add an attachment-download probe to the demo on next pass).
