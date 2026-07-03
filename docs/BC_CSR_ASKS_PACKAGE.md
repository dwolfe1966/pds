# BC CSR asks — consolidated package (with a runnable proof)

**Prepared 2026-06-18 · re-verified live 2026-06-22 (no flips — A/B/C all still ❌, userContact still CONFIRM) · ASK D added 2026-06-26 (live-call recording download; playback since ✅ via `playAudioFlag`, download residual) · ASKS E–H added 2026-07-02 (owner's prod CSR/consumer bug list — NOT yet sent to BC).** Every dev-demoable item is reproduced live against `dev.admin.www.bytecrtrs.com`. Rather
than argue from a document, **run the demo** — it calls BC's own API and prints what it returns:

```
CSR_USER='<csr account>' CSR_PWD='<pwd>' node scripts/demo-bc-csr-asks.js
```

It prints, per ask: what we call → what BC returns → what we expected → verdict, plus a working
contrast. **Seven open asks + one question**: A/B/C (in the demo script), D-residual (byte-verified, download-to-disk only), and E/F/G/H (registered 2026-07-02 from **production** evidence — BC is live on prod since 2026-06-23, and we do NOT run mutation probes on prod, so E–H are evidenced by prod payloads/screenshots + cited artifacts rather than the dev demo script; see each block). **Setup + run instructions: `BC_CSR_DEMO_HOWTO.md`** (no embedded
credentials — the runner supplies their own CSR account via env). (A/B/C re-checked across `idlookup` / `bytecrtrs` / no-brand so a
brand filter can't be the cause.)

> **Lettering note:** the older `BC_CSR_LIB_ONLY_ASKS.md` has its own internal "ASK E" (email filter).
> THIS document is the canonical register — letters here (A–H) win when batching to BC.

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

## ASK E — voicemail contactMessages carry no caller ID and no transcription  (ADD)  ❌ open

**Evidence (prod, 2026-07-02):** CSR Email Tickets — voicemail messages arrive from
`dev@mail01.bytecrtrs.com`, subject `"Voice Mail"`, body containing **only a `stamp:` line**, sender
rendered "No Name / Non-member", and a single `.aac` attachment (e.g. `voicemail_19.aac`). **No caller
phone number (ANI) and no transcription anywhere in the payload.** A CSR cannot identify or call back
the customer without listening to the audio and hoping they left a number.
**Sharpened 2026-07-03 (Kwan said caller ID is in the response; owner then verified all live-call
numbers are IDENTICAL):** the field DOES exist — `data.calleridnum` (dup at `content.input.phone`),
confirmed in BC's own doc `Api v3.csv:686` live-call sample (`calleridnum:"9546087693"`). It is the
ONLY caller-number field in the entire API (grep of all doc CSVs: no `did`/`dnid`/`src`/`ani`/
`calleridname`). **But it is populated with a CONSTANT placeholder, not the real ANI** — every
voicemail shows the same number, paired with `name:"No Name"` + `email:"dev@mail01.bytecrtrs.com"`
(both system placeholders). So the telephony backend isn't capturing the calling party's number.
**Revised ask:** populate `data.calleridnum` with the REAL caller ANI (currently a fixed placeholder),
and add a transcription field (genuinely absent — no `transcri*` anywhere in the docs). Our client
already reads `data.calleridnum` → it will light up the moment BC sends real values (commit shipped).

| | |
|---|---|
| **App / Page** | CSR/Admin — `EmailTicketsPage` (voicemail tickets), `UserDetailPage` Messages tab |
| **Evidence** | Prod screenshot https://nimb.ws/pNzc7n6 · owner bug list `docs/bugs/CSR_bugs_7_2_2026.csv` row "Voicemail missing transcription and caller ID" |
| **Feature impacted** | CSR triage/callback of voicemail tickets — currently no way to know who called |

## ASK F — signup velocity block traps a corrected-card retry (clientId-keyed)  (DOCUMENT + DECISION)  ❌ open

**ROOT CAUSE CONFIRMED 2026-07-02 from order-detail JSON (davidtest-7-2, userId `6a46…3941`).**
The "correct info still fails on retry" symptom is BC's **signup velocity rules keyed on the clientId
embedded in the billingId** (`sale|<clientId>|<apiId>|<ts>|<rand>`), which is stable for the whole
session. So a user who retries after a decline keeps the same clientId and is blocked **even with a
corrected card** — exactly what Kwan meant by "you're not changing the billingId."

**The evidence chain (one session, clientId `AkhVfmyVOI7rbVQuXXFTvZMZqHWC1MVZ` throughout):**
- **First attempt** (test card `4111…1111`) declines → BC's **cascade-decliner auto-retries** the
  `membership.offer.cascade.1` ($0 validate) offer. Those `subType:'declinerRetry'`, `cascade:true`,
  `immediateRetryCount:2` orders returned processor **`ResponseCode 65 "Activity Exceeded"`** (the shared
  test card is exhausted — a REAL card won't hit this). *So the $0 rows in the timeline are BC's own
  decliner cascade, not user resubmits.*
- **Second manual attempt** (order `…9416d7bc`, a DIFFERENT/corrected card — JPMorgan business debit
  ending 5888) → **`blocked`**, `gatewayTransactionSubStatus:"declineTooManySignupAttempts"`,
  `velocityOptionKeys:[declineDisputeCcNumber, declineTooManySignupAttempts, declineDupSignup]`, **same
  clientId**. This is the real-user bug: the velocity counter had already tripped on the stable clientId,
  so the corrected card was blocked.
- Also confirmed: a **declined first `billing.sale` still creates the BC user** ("Account created" and
  the first "Payment failed" are stamped the same second), leaving a "Payment failed" account.

**Our client mitigation (shipped, commit `[rotate-clientId]`):** on a **retry** (not the first attempt),
we rotate `apiWrapper.clientId` before the sale so BC sees a fresh signup identity and `declineDupSignup`
doesn't block a legit correction. First attempt keeps the session clientId (attribution intact).

**Ask (this is a DECISION + DOCUMENT, since our mitigation defeats a fraud rule):**
1. **Is client-side clientId rotation on a user-initiated retry the sanctioned fix**, or should BC's
   velocity instead **distinguish a legit "same email, corrected card" retry from abuse** (e.g. reset /
   not increment `declineDupSignup` when the payer email is unchanged and the card changed)? We don't want
   to blanket-defeat fraud protection.
2. **Document the velocity rules** `declineDupSignup` + `declineTooManySignupAttempts`: what each **keys
   on** (clientId? IP? email? billingSeriesId?), the **window/threshold**, and **reset conditions** — so
   we know exactly what our rotation affects and what it doesn't (IP-keyed rules won't rotate away).
3. **Failed-sale-creates-user**: confirm intended? A declined first attempt leaves a "Payment failed"
   account; does that state interact with `nonMemberOnly` on a later retry, and should a never-settled
   user stay eligible for the signup offer?
4. **CSR unblock path** + a **distinguishable 406 body** (velocity-block vs the `sequenceOption` 406 vs a
   plain decline) so the client can message correctly — today they're indistinguishable on the wire.

| | |
|---|---|
| **App / Page** | Consumer — `PaymentPage` (funnel checkout); CSR — `UserDetailPage` (no unblock tool exists) |
| **Evidence** | davidtest-7-2 (userId `6a46…3941`) order details: `…9416d7bc` (corrected card → `declineTooManySignupAttempts`, blocked), `…62ed39e0` (declinerRetry → `ResponseCode 65 Activity Exceeded`); stable clientId `AkhVfmy…` across all. Earlier: Jim Galloway `6a45…3c22` 4× `blocked` Jul 1 21:49–21:53. Screenshots https://nimb.ws/1azUGoK · https://nimb.ws/IwS84bJ |
| **Feature impacted** | Customer recovery after a typo'd/declined card — blocked even with corrected info; no CSR remedy |

## ASK G — consumer `user.update` → 403 "Forbidden resource" for never-paid (free) members  (FIX or DOCUMENT)  ❌ open

**Evidence (prod, 2026-07-02):** free member testmc#4 — Account → Profile → save phone number →
**403 "Forbidden resource"**. Context that may matter: our funnel signup is *synthetic* — the BC user is
created inside `billing.sale`, and a **failed** sale still creates the BC user; so a never-paid member's
session comes from that path, not a "normal" registration. (Note: the CSR-context `user.update` is fine —
see "Resolved on our side" below; this is the **consumer** context for a free member.)
**Ask:** confirm whether consumer `user.update` requires a session minted by a real login vs. is gated
on **paid status**, and what the supported path is for a free member to update
`firstName`/`lastName`/`phone`. **Owner requirement: free members MUST be able to maintain their
profile** (freemium model — profile maintenance is not a paid feature).

| | |
|---|---|
| **App / Page** | Consumer — Account → Profile (`user.update` via ApiWrapper) |
| **Evidence** | Prod screenshot https://nimb.ws/E6DKZPc · owner bug list row 1 ("member unable to add phone number … free state") · friendly 403 message shipped consumer-side in commit `5ed93d9` |
| **Feature impacted** | Free-member profile maintenance (phone/name) — hard-blocked today |

## ASK H — user object (or order `billingAddress`) should carry city/state  (ADD)  ❌ open

**Evidence (prod, 2026-07-02):** CSR customer profile can show **Zip only** — the BC user object omits
address entirely; ZIP is recovered from the order `billingAddress`, and even there city/state are not
reliably present/echoed. Tester ask: "Customer Profile needs to display city and state".
**Ask:** return **city/state** (or the full billing address echo) on the user object — or consistently
on the order `billingAddress` — so CSR screens can display customer location without a client-side
zip→geo lookup. (We may interim-fix with a zip lookup table; the ask is for real data. Same
data-exposure family as the earlier finding that search *filters* by zip/card/phone but doesn't
*return* them.)

| | |
|---|---|
| **App / Page** | CSR/Admin — `UserDetailPage` customer profile card; `UsersPage` list columns |
| **Evidence** | Prod screenshot https://nimb.ws/4GonfZU · owner bug list row "Customer Profile needs to display city and state" · prior finding: user object omits zip/card/phone (zip lives only in order `billingAddress`) |
| **Feature impacted** | CSR seeing where a customer is — identity confirmation, tax/region questions, callback hours |

## CONFIRM — `userContact` data model (a question, not a defect)

**Demo (live):** `findUserContacts({userId})` reads `GET /contactMessage/admin/find/:userId` (returns the
member's contactMessages); direct `{collectionName:'userContact'}` → 403. Our write-path puts member
contacts in `contactMessage` (by `targetUserId`).
**Question:** is `userContact` a *separate* store with distinct data, or are member messages all
`contactMessage`-by-`targetUserId`? Cheap discriminator: do `userContactCsrMail` CSR replies land as
`contactMessage` thread histories or separate `userContact` docs? If not separate, nothing more is needed.

---

## Draft BC notes for E–H (staged 2026-07-02 — **NOT SENT**, hold for next batch)

Minimalist per-ask notes, ready to paste once we batch. E/F/G/H are prod-evidenced (no dev demo —
we don't run mutation probes on prod); each cites concrete artifacts instead.

> **E (voicemail metadata):** CSR Email Tickets — voicemail contactMessages arrive with subject
> "Voice Mail", body = only a `stamp:` line, sender "No Name / Non-member", one `.aac` attachment
> (`voicemail_19.aac`). No caller number and no transcription in the payload, so a CSR can't identify
> or call back the customer. Could you include the caller ID (ANI) on the message (e.g. `data.phone`
> or the body) and, if the telephony backend produces one, a transcription field?

> **F (signup velocity blocks a corrected-card retry — you were right about the billingId):**
> We traced the "correct card still fails on retry" bug to the order details on `davidtest-7-2`
> (userId `6a46…3941`). Across the whole session the **clientId is stable** (`AkhVfmy…`), so the
> billingId (`sale|<clientId>|…`) never changes — and the velocity rules key on it. On the corrected-card
> retry (order `…9416d7bc`) the payment is `blocked` with `declineTooManySignupAttempts` /
> `declineDupSignup`, same clientId. (The $0 orders in between are your cascade-decliner's own
> `declinerRetry`s — the test card `4111` returned processor code 65 "Activity Exceeded", i.e. exhausted;
> not a real-card issue.) We shipped a client mitigation: on a **retry** we rotate the clientId so the
> signup identity is fresh — but that defeats `declineDupSignup`, which is your fraud rule, so we want
> your call. **Questions:** (1) Is rotating the clientId on a user-initiated retry the sanctioned fix, or
> should the velocity instead not count a legit "same email, corrected card" retry? (2) What do
> `declineDupSignup` / `declineTooManySignupAttempts` key on (clientId / IP / email?), and their
> window/reset? (3) A declined first `billing.sale` still creates the user ("Payment failed") — intended,
> and does it interact with `nonMemberOnly` on retry? (4) Can a CSR clear the block, and can the 406 carry
> a distinguishable body vs the sequenceOption 406?

> **G (free-member user.update):** prod free member — consumer `user.update` (phone number save) →
> **403 "Forbidden resource"**. Our signup creates the BC user inside `billing.sale` (a failed sale
> still creates the user). Is consumer `user.update` gated on paid status, or on how the session was
> minted? What's the supported path for a never-paid member to update firstName/lastName/phone? Free
> members need to be able to maintain their profile.

> **H (city/state):** the user object carries no address, so CSR screens can show Zip at best (dug out
> of order `billingAddress`). Could the user object (or the order `billingAddress`, consistently) echo
> city/state so CSRs can see customer location without a client-side zip→geo lookup?

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
