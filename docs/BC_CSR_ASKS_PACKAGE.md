# BC CSR asks — consolidated package (with a runnable proof)

**Prepared 2026-06-18 · re-verified live 2026-06-22 (no flips — A/B/C all still ❌, userContact still CONFIRM) · ASK D added 2026-06-26 (live-call recording download).** Every item is reproduced live against `dev.admin.www.bytecrtrs.com`. Rather
than argue from a document, **run the demo** — it calls BC's own API and prints what it returns:

```
CSR_USER='<csr account>' CSR_PWD='<pwd>' node scripts/demo-bc-csr-asks.js
```

It prints, per ask: what we call → what BC returns → what we expected → verdict, plus a working
contrast. Four asks + one question (ASK D is reproduced live but is not yet wired into the demo script
— see its block below for the byte-verified evidence). **Setup + run instructions: `BC_CSR_DEMO_HOWTO.md`** (no embedded
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

## ASK D — ✅ RESOLVED (no BC change) — live-call recordings play via `playAudioFlag`

**✅ RESOLUTION (live, 2026-06-26):** the 404 only occurs on **download** (no flag). Calling
`attachment.download({ attachmentId, playAudioFlag: true })` **SUCCEEDS** and plays the recording via
BC's audio control — confirmed live (promise resolved `OK-PLAY` vs the download path's 404 AxiosError).
So **no BC change is needed for playback.** Wired in commit `76b8536` (audio attachments → `playAudioFlag`,
render ▶️). **Residual (low priority):** *downloading a recording to disk* (no flag) still 404s — only
matters if a CSR needs to save vs. listen. Original download-path investigation kept below for record.

**Demo (live, 2026-06-26):** `csrWrapper.api.attachment.download({ attachmentId })` → **"attachment
not found"** for a **valid** attachmentId. Byte-verified: we sent `attachmentId:
'6a3d7295d2a2310fd7ef9ed9'`, which **exactly equals** the attachment object's `id` field — so it is
**not a client bug**. The attachment object (from `findUserContactMessages`/histories) is a real call
recording:
`{ originalname:'liveCall_27.aac', mimetype:'audio/aac', id:'6a3d7295d2a2310fd7ef9ed9',
filename:'liveCall_27.aac', size:157037, bucketName:'attachments',
metadata:{compressed:'zstd',…} }`.
The discriminator is the **parent message** (`type:'contact'`, `data.type:'outbound'`, `liveCallId:27`,
**`brandId:'unknown'`**, `trackingIds.clientId:'curl'`/`apiId:'cli'` — telephony backend). The recording
sits in the **same** `bucketName:'attachments'` as ordinary attachments, so it is **not a bucket
problem** — the brand-scoped lookup appears to exclude `brandId:'unknown'` (telephony) attachments. The
deployed csrWrapper has **no** live-call/recording method (no `liveCall.*`/`recording.*`/`call.*`/
`voice.*`); `attachment.download` is the **only** file-retrieval path.
**Update (live, 2026-06-26) — param overrides ruled out:** with a FRESH authenticated session we
forwarded both candidate params via the IIFE — `GET /attachment/download?attachmentId=6a3d7295…ed9&bucketName=attachments&brandId=unknown` — and BC returned **`404 Not Found`** (clean 404, auth passed;
a stale-session attempt returns 403, so this is genuinely the attachment lookup, not auth). So **`bucketName` and `brandId` are NOT the override params** — path (b) with those is empirically dead.
**Ask (either):** (a) **[now primary]** fix server-side retrieval so `attachment.download` serves
telephony / `brandId:'unknown'` attachments; **or** (b) name the *actual* discriminating param/value we
should forward (not `bucketName`/`brandId` — tested, still 404). The IIFE auto-forwards unknown params
as GET params, so (b) needs **no IIFE change on our side**. (`playAudioFlag` is stripped pre-GET — not the fix.)

| | |
|---|---|
| **App / Page** | CSR/Admin — `UserDetailPage` (`/users/:id`) ticket/Messages view (call-recording attachment link) |
| **Function chain** | clickable attachment → `csrWrapper.api.attachment.download({ attachmentId })` → `GET /attachment/download` → **"attachment not found"** |
| **Feature impacted** | Listening to / downloading live-call recordings from the ticket view (link shipped: commits `958acb0` + `bd3b5e0`) |

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

---

## Appendix 1 — library methods we explored per ask (and why each fails)

Pulled from `src/services/apiWrapperCsr.js`; cross-checked against the live demo 2026-06-22.

### ASK A — offer/price lookup
| Method explored | Why it doesn't work |
|---|---|
| `csrWrapper.api.offer.findByShmName` | **Namespace absent** — `csrWrapper.api.offer` = `false` (live). |
| direct `POST /commerce/offer/findByShmName` | **403 "No offer."** in a CSR session, all brands — role/clientId gate. |
| consumer `ApiWrapper.api.offer` | Resolves (s0=$1) but only in the **consumer** session/context — not usable from the CSR app. |

### ASK B — CSR billing sale
| Method explored | Why it doesn't work |
|---|---|
| `csrWrapper.api.billing.sale` | **Namespace absent** — `csrWrapper.api.billing` = `false`. |
| consumer `ApiWrapper.api.billing.sale` | Exists but has **no `payerId`** → bills the logged-in session user (the CSR); also needs the customer's full card (PCI). |
| consumer `ApiWrapper.api.billing.tokenSale` | Charges the **session user's** stored token, not the customer's. |
| direct `POST /commerceBilling/sale` | Works, but we must hand-build `billingSeriesId` or BC 406s (the refund-bug class). |

### ASK C — global order search
| Method explored | Why it doesn't work |
|---|---|
| `csrWrapper.api.user.findOrders` / `findUserOrders` | Exists but **per-user only** (requires `userId`) — not a global finder. |
| direct `POST /database/search {collectionName:'commerceOrder'}` | **403 "Invalid Database Search Role."** all brands (also tried `commerceOrders` plural). |
| *(no global `commerceOrder` finder on csrWrapper)* | — |

### ASK D — live-call recording download
| Method explored | Why it doesn't work |
|---|---|
| `csrWrapper.api.attachment.download({ attachmentId })` | **"attachment not found"** for a *valid* attachmentId (byte-verified == attachment `id`). Parent message `brandId:'unknown'` (telephony) → brand-scoped lookup appears to exclude it. |
| extra GET param via auto-forward (`brandId` / `bucketName`) | **Available to us with no IIFE change** — the IIFE auto-forwards unknown params as GET params; we just need BC to name which one. (`playAudioFlag` is stripped pre-GET → not the fix.) |
| `csrWrapper.api.liveCall.* / recording.* / call.* / voice.*` | **All absent** on the deployed csrWrapper — `attachment.download` is the only file-retrieval path. |

### CONFIRM — `userContact` data model
| Method explored | Why it doesn't work |
|---|---|
| `csrWrapper.api.user.findUserContacts({userId})` | Reads `GET /contactMessage/admin/find/:userId` → returns the **contactMessage** collection, not `userContact`. |
| `csrWrapper.api.user.findUserAdminNotes` | Reads `GET /message/admin/findNotes` → returns **admin notes**, not `userContact`. |
| direct `POST /database/search {collectionName:'userContact'}` | **403 "Invalid Database Search Role."** |

---

## Appendix 2 — calls already switched to the lib (`_viaCsr` lib-first, direct kept as fallback)

**23 working lib-first migrations** (verified GREEN; lib succeeds → used, else falls back):

| Domain | Method → lib target |
|---|---|
| **Users** | `csrFindUsers`→`user.find` · `csrFindCsReps`→`user.findAdmin` · `csrGetUserDetail`→`user.getUserDetail` · `csrUpdateUser`→`user.update` · `csrCreateUser`→`user.create` |
| **Orders** | `csrFindUserOrders`→`user.findOrders` · `csrGetUserOrder`→`user.getOrder` · `csrCancelUncancelOrder`→`user.cancelUncancelOrder` · `csrRefundVoidOrder`→`user.refundVoidOrder` · `csrFindOrderPayments`→`user.findOrderPayments` · `csrFindOrderHistories`→`user.findOrderHistories` · `csrUpdateScheduleDueTimestamp`→`user.updateSchedule` |
| **Notes** | `csrFindUserAdminNotes`→`user.findUserAdminNotes` · `csrCreateContactAdminNote`→`message.note.createContactAdminNote` |
| **Contact/messages** | `csrCreateContactMessage`→`message.contact.create` · `csrFindContactMessages`→`message.contact.find` · `csrFindContactHistories`→`message.contact.histories` · `csrCreateCsrReply`→`message.contact.createCsrReply` · `csrSetContactActor`→`message.contact.setActor` · `csrSetContactTargetUser`→`message.contact.setTargetUser` · `csrSetContactTags`→`message.contact.setTags` · `csrGetContactReplyLinkUrl`→`message.contact.replyLinkUrl` |
| **Managed contacts** | `csrUnsubscribeManagedContact`→`managedContact.unsubscribe` |

**3 "fake lib-first"** — target points at a method that **doesn't exist**, so they *always* hit the direct fallback. These are the code-side footprint of the asks above:
- `csrFindOfferByShmName`→`offer.findByShmName` *(absent — ASK A)*
- `csrCreateOrder`→`billing.sale` *(absent — ASK B)*
- `csrChangeContactToUserContact`→`contact.changeContactToUserContact` *(absent; dead plumbing, no page calls it)*

**Still direct-only** (no lib path, or semantic-trap): `csrFindOrders` (ASK C), `csrFindUserContacts` / `csrFindAllUserContacts` (userContact gate), `csrFindOptOuts`, `csrFindManagedContacts`, `csrFindUserTracking`, `csrFindUserContactMessages`, `csrCreateAdminNote`, `csrCreateCsrMail`.
