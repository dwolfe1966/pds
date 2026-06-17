# BC ask — CSR lib methods (so we can stop calling endpoints directly)

**Filed:** 2026-06-16 · **From:** PDS / idlookup · **For:** BC CTO + dev
**Context:** BC asked us not to call API endpoints directly — all CSR calls should go through
the csrWrapper IIFE (`csrWrapper.api.*`). We audited every CSR call against the **deployed**
csrWrapper surface (introspected live, not the docs). Two lists below.

## ⭐ MESSAGE TO BC — all changes required (copy/paste)

Hi — we've moved the CSR app onto the csrWrapper library wherever a working method exists
(8 reads migrated + verified). To finish, we need three things from your side. Grouped by type.

**Sample-call notes:** all direct calls carry `?clientId=…&apiId=…` query params (omitted below for
brevity) and the CSR session cookie. The ids shown are real **dev test records** so you can reproduce.

### 1. Open these `/database/search` collections for the `csrManager` role
Login + `users` + `trackings` work. These 5 still return `403 "Invalid Database Search Role"`,
which blocks the matching CSR screens. Same call shape for each — only `collectionName` changes:

```
POST /api/database/search
{ "brandId": "idlookup", "collectionName": "commerceOrder", "query": {}, "perPage": 20 }
→ 403 { "message": "Invalid Database Search Role", "statusCode": 403 }      (want: 200 { docs:[…], noMoreDocs })
```
| Collection (set as `collectionName`) | CSR screen it blocks |
|---|---|
| `commerceOrder` | global order/purchase search |
| `optOutRequest` | Data Removal list |
| `managedContact` | Unsubscribe list |
| `userContact` | support inbox + a user's notes |
| `contact` | visitor contact-message list |

### 2. ADD these lib methods (none exist — no way to call them except directly)
For each: the **direct call we make today** (sample) → the **lib method we want**.

**1. Global order search** — browse all orders (`user.findOrders` needs a userId, so it can't do this)
```
POST /api/database/search
{ "brandId":"idlookup", "collectionName":"commerceOrder", "query":{}, "perPage":20 }
→ { docs:[commerceOrder…], noMoreDocs }
WANT:  csrWrapper.api.order.find({ brandId:"idlookup", perPage:20, lastId })
```

**2. One user's `userContact` notes / CSR-mail** (`user.findUserContacts` returns *contactMessages* — different data)
```
POST /api/database/search
{ "collectionName":"userContact", "targetUserId":"6a30a88dce24e4018b18e016" }
→ { docs:[userContact…], noMoreDocs }
WANT:  csrWrapper.api.user.findUserContactNotes({ userId:"6a30a88dce24e4018b18e016", lastId })
```

**3. ALL `userContact` records** (unified support inbox)
```
POST /api/database/search
{ "collectionName":"userContact", "perPage":20 }
→ { docs:[userContact…], noMoreDocs }
WANT:  csrWrapper.api.userContact.findAll({ perPage:20, lastId })
```

**4. Visitor `contact` messages**
```
POST /api/database/search
{ "collectionName":"contact", "perPage":20 }
→ { docs:[contact…], noMoreDocs }
WANT:  csrWrapper.api.contact.find({ perPage:20, lastId })
```

**5. CSR sale / order creation** (`billing.sale`) — we hand-build `billingSeriesId` today or BC 406s
```
POST /api/commerceBilling/sale
{ "shmName":"<offer>", "payerId":"6a30a88dce24e4018b18e016", …saleBody,
  "billingSeriesId":"<we generate this client-side>" }
→ created order
WANT:  csrWrapper.api.billing.sale({ shmName:"<offer>", payerId:"…", …saleBody })   // lib injects billingSeriesId
```

**6. Offer lookup by shm name** (`offer.findByShmName`)
```
POST /api/commerce/offer/findByShmName
{ "shmName":"<offer-shm>" }
→ offer doc (we read transient.priceInfo s0/s1)
WANT:  csrWrapper.api.offer.findByShmName({ shmName:"<offer-shm>" })
```

**7. Link a visitor contact to a user** (`contact.changeContactToUserContact`)
```
POST /api/message/admin/user/changeContactToUserContact
{ "messageId":"6a31ca36f009300c72f299b2", "targetUserId":"6a30a88dce24e4018b18e016" }
→ updated record
WANT:  csrWrapper.api.contact.changeContactToUserContact({ messageId:"…", targetUserId:"…" })
```

### 3. FIX these existing lib methods — they return the WRONG data

**1. `user.findAdmin`** (CSR-rep / admin-staff list) — direct returns 10 staff, lib returns 0
```
DIRECT (works):  POST /api/database/search { "brandId":"idlookup", "collectionName":"users", "isAdmin":true, "perPage":10 }  → { docs:[10 staff…] }
LIB (broken):    csrWrapper.api.user.findAdmin({ brandId:"idlookup", perPage:10 })                                          → { docs:[] }   ← want the 10 staff
```

**2. `tracking.findUser`** (a customer's Searches / Reports / Logins) — direct returns the user's events, lib returns 0
```
DIRECT (works):  POST /api/database/search { "collectionName":"trackings", "query":{ "data.type":"USER:login" }, "updaterId":"6a30a88dce24e4018b18e016", "perPage":100 }  → { docs:[that user's events…] }
LIB (broken):    csrWrapper.api.tracking.findUser({ type:"USER:login" })   → returns 0 for a target user (seems scoped to the caller's own tracking)
WANT:            csrWrapper.api.tracking.findUser({ type:"USER:login", updaterId:"6a30a88dce24e4018b18e016", perPage:100 })   // scope to a target user + honor perPage
```
(Same root issue as `BC_CSR_TRACKING_SCOPE.md`.)

Once #1–#3 land, we switch the last few calls (`optOut.find`, `managedContact.find`, and the items above) onto the library and we're fully off direct endpoint calls. Thanks!

---

## Deployed csrWrapper surface (ground truth, 2026-06-16)

`auth.{login,logout}`, `user.{create,update,getUserDetail,find,findAdmin,findUserContacts,
findUserAdminNotes,findOrders,getOrder,findOrderPayments,findOrderHistories,cancelUncancelOrder,
refundVoidOrder,updateSchedule}`, `optOut.find`, `message.contact.{create,createCsrReply,find,
histories,replyLinkUrl,setActor,setTags,setTargetUser}`, `message.note.{createContactAdminNote,
createUserAdminNote,updateAdminNote}`, `managedContact.{find,unsubscribe}`, `tracking.findUser`,
`shape.getBrandIds`, `attachment.{download,remove}`.
**Absent:** any `billing`, `offer`, or top-level `contact` namespace; any *global* order finder;
any *all-user* contact finder.

## List A — switch to EXISTING lib methods (our work, no BC action)

Gated on **result-equivalence** (lib vs direct on the SAME query/perPage → same `_id` set +
count, including a filtered query), not shape-match. Shape-match alone is insufficient — see
List C below where two methods shape-matched perfectly yet returned empty results.

**DONE — equivalence GREEN + verified end-to-end in the UI (local prod bundle, 2026-06-16):**
| Our call (direct before) | Lib method now used | Verification |
|---|---|---|
| customer search → `/database/search` users | `user.find` | unfiltered 10==10 + by-email 1==1 (same _ids); UI: list + search render |
| per-customer orders → `/commerceMgmt/userOrders` | `user.findOrders` | 1==1; UI: Orders tab renders |
| order payments → `/commerceMgmt/orderPayments` | `user.findOrderPayments` | 1==1 |
| order histories → `/commerceMgmt/orderHistories` | `user.findOrderHistories` | 1==1 |

**DONE (round 2) — equivalence GREEN (incl. field-set + paging) + UI-verified:**
| Our call (direct before) | Lib method now used | Verification |
|---|---|---|
| order detail → `/commerceMgmt/getUserOrder` | `user.getOrder` | same `order._id`; UI: Orders tab |
| tickets inbox → `/contactMessage/admin/find` | `message.contact.find` | page1 20==20 + page2 (lastId) 20==20, **identical key set incl. latestReply**; UI: inbox loads + thread opens |
| ticket thread → `/contactMessage/admin/histories` | `message.contact.histories` | 1==1, sameKeys |
| reply link → `/contactMessage/admin/replyUrl` | `message.contact.replyLinkUrl` | identical replyLinkUrl |

**All 8 verified List-A reads now go lib-first (direct fallback retained).** Remaining direct
calls are List B (no lib) / List C (lib broken) below, plus `optOut.find`/`managedContact.find`
(can't verify until BC opens those collections).

## List C — lib method EXISTS but returns WRONG results (BC must FIX, do NOT switch)

These passed shape-match but FAILED result-equivalence — switching would silently empty the UI.
| Our call | Lib method | Result-equivalence finding |
|---|---|---|
| CSR-rep list | `user.findAdmin` | lib returned **0 docs** vs direct **10** (same query). Likely wrong collection/args. |
| tracking tabs (Searches/Reports/Logins) | `tracking.findUser` | lib returned **0** vs direct **100** for `{type,updaterId,perPage:100}`. Appears to scope to the *caller's own* tracking, not a target user's — can't carry our `updaterId` scoping. |

**Until BC fixes these two, we keep the direct calls** (the alternative is an empty CSR-rep list
and empty Searches/Reports/Logins tabs).

---

## Plain message for BC (copy/paste) — with the endpoints we call today

Hi — we're moving all CSR calls onto the csrWrapper library (no direct endpoint calls). Most are
done. Two asks remain. For each we list the endpoint + params + response we use today, so the lib
method can wrap the same call.

### Please ADD these lib methods (none exist today — no way to call them except directly)

1. **Global order search** (browse all orders, not one user's)
   - We call: `POST /api/database/search`
   - Params: `{ brandId: 'idlookup', collectionName: 'commerceOrder', ...filters, lastId? }`
   - Returns: `{ docs: [commerceOrder…], noMoreDocs }`
   - (`api.user.findOrders` needs a `userId` and 400s on bare brandId, so it can't do this.)

2. **Find a single user's `userContact` notes / CSR-mail**
   - We call: `POST /api/database/search`
   - Params: `{ collectionName: 'userContact', targetUserId, lastId? }`
   - Returns: `{ docs: [userContact…], noMoreDocs }`
   - (`api.user.findUserContacts` returns **contactMessages** — different data — so it doesn't cover this.)

3. **Find ALL `userContact` records** (unified support inbox)
   - We call: `POST /api/database/search`
   - Params: `{ collectionName: 'userContact', lastId? }`
   - Returns: `{ docs: [userContact…], noMoreDocs }`

4. **Find visitor `contact` messages**
   - We call: `POST /api/database/search`
   - Params: `{ collectionName: 'contact', ...filters, lastId? }`
   - Returns: `{ docs: [contact…], noMoreDocs }`

5. **CSR-initiated sale / order creation** (`billing.sale` on the CSR IIFE)
   - We call: `POST /api/commerceBilling/sale`
   - Params: the sale body **+ a `billingSeriesId` we have to hand-build** (type `sale`); without it BC 406s "billingSeriesId should not be empty"
   - Returns: the created order
   - (A lib `billing.sale` would inject billingSeriesId itself, like the consumer wrapper does.)

6. **Offer lookup by shm name** (`offer.findByShmName`)
   - We call: `POST /api/commerce/offer/findByShmName`
   - Params: `{ shmName, key? }`
   - Returns: the offer doc (we read `transient.priceInfo` s0/s1)

7. **Link a visitor contact to a user** (`contact.changeContactToUserContact`)
   - We call: `POST /api/message/admin/user/changeContactToUserContact`
   - Params: `{ messageId, targetUserId }`
   - Returns: the updated record

### Please FIX these existing lib methods — they return the wrong data

8. **`user.findAdmin`** (CSR-rep / admin-staff list)
   - Direct equivalent we still use: `POST /api/database/search` with
     `{ brandId: 'idlookup', collectionName: 'users', isAdmin: true }` → `{ docs: [staff…], noMoreDocs }` (10 rows)
   - Lib `user.findAdmin({ brandId })` returns **0 docs** for the same data. Please make it return the CSR/admin staff.

9. **`tracking.findUser`** (a customer's Searches / Reports / Logins)
   - Direct equivalent we still use: `POST /api/database/search` with
     `{ collectionName: 'trackings', query: { 'data.type': type }, updaterId, perPage: 100 }` → `{ docs: [tracking…], noMoreDocs }`
   - Lib `tracking.findUser({ type })` returns **0** for a target user — it appears to return only the *caller's own* tracking. Please let it scope to a target user (`updaterId`/`targetUserId`) and honor `perPage`. (Same root issue as `BC_CSR_TRACKING_SCOPE.md`.)

Once these land we can finish moving fully onto the library. Thanks!

## List B — NO lib method exists; please ADD these to the csrWrapper IIFE

We have no way to make these calls without hitting an endpoint directly.

1. **Global order search** — a finder for the `commerceOrder` collection (search ALL orders, not
   one user's). Powers the global Orders/Purchases page. No `user.findOrders`-style global finder exists.
2. **All-user contact finder** — list `userContact` docs across all users (the unified support inbox).
3. **Per-user `userContact` finder** — return the `userContact` collection (CSR notes / CSR-mail) for a
   `userId`. NOTE: `user.findUserContacts` exists but returns **contactMessages**, not the `userContact`
   collection — different data, so it doesn't cover this.
4. **Visitor contact finder** — a finder for the `contact` collection (visitor contact-form messages).
   There is no top-level `contact` namespace.
5. **CSR order/sale creation** — `billing.sale` on the CSR IIFE (no `billing` namespace today).
6. **Offer lookup by shm name** — `offer.findByShmName` (no `offer` namespace today).
7. **Change contact → userContact** — `contact.changeContactToUserContact` (no `contact` namespace).

## One clarification that affects List A

The lib finders `user.find` / `optOut.find` / `managedContact.find` / `tracking.findUser` post to
`/database/search` internally, so they're still subject to the per-collection
"Invalid Database Search Role" gate. As of 2026-06-16 you've enabled `users` and `trackings`;
`commerceOrder`, `optOutRequest`, `managedContact`, `userContact`, `contact` still 403. So switching
to the lib method satisfies the no-direct-calls policy, but those collections also need the role
enabled to actually return data. (If the intent is to retire `/database/search` entirely, then the
List B finders should target dedicated endpoints rather than that collection search.)
