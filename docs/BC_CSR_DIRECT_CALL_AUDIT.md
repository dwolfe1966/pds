# CSR direct-API-call audit — what BC must provide to reach ZERO direct calls

**Date:** 2026-06-22. **Trigger:** BC (Kwan) requires client code to use **only csrWrapper lib
methods** — no direct `/api/...` calls. This audit enumerates **every** direct call the CSR/admin app
can make, classifies each, and derives the **BC-facing list** needed to remove them all.

## How CSR calls work today
Every CSR call goes `admin page → api.admin* → apiRouterAdmin.js → apiWrapperCsr.js`. In
`apiWrapperCsr.js` each method is one of:
- **lib-first** via `_viaCsr('api.x.y', args, directFallback, opts)` — tries the csrWrapper IIFE
  method; on absent-method/load-fail/(guarded)bad-shape it runs the **direct fallback** (`_csrPost`/
  `_csrGet`).
- **direct-only** — calls `_csrPost`/`_csrGet` straight, no lib path.

**The mandate removes the direct fallback.** So any call that *relies* on the fallback today — because
the lib method is absent, broken, or returns an unusable shape — **breaks at cutover**. The
`{ validate: _isUsableList }` guard on a read is a tell: it exists because the lib's shape was
distrusted, so the page may currently be served by the direct fallback.

## Classification legend
- ✅ **SAFE** — lib-first, lib serves good data; dropping the direct fallback is a no-op.
- 🟡 **CONFIRM** — lib-first but `validate`-guarded or manual-try-then-direct; the fallback may be
  silently rescuing it. Needs shape confirmation (probe/UI) before the fallback can be removed.
- 🟠 **MIGRATE (ours)** — direct-only today, but the lib method **exists on the deployed surface**;
  our work to switch (verify shape first). No BC action *if* the shape is usable.
- 🔴 **BC ASK** — no usable lib path (absent method, wrong collection, role-gate, or broken behavior).
  BC must add/fix/grant.

Deployed csrWrapper namespaces (live 2026-06-22): `user, optOut, message, managedContact, shape,
attachment, tracking` (+ flat aliases). **No `offer`, no `billing`, no top-level `contact`.**

---

## A. READS / finders

| # | Method | Transport (lib → direct fallback) | Pages | Class |
|---|---|---|---|---|
| 1 | `csrFindUsers` | `user.find` → `/database/search` | UsersPage | 🟡 CONFIRM (guarded) |
| 2 | `csrFindCsReps` | `user.findAdmin` (no brand → 10 staff) → `/database/search {admins}` | /cs-reps | ✅ MIGRATE-safe (probe: `findAdmin({})` returns real CSR staff, `_isUsableList` passes) |
| 3 | `csrGetUserDetail` | `user.getUserDetail` → `/user/management/detail` | UserDetailPage | ✅ SAFE (unguarded lib) |
| 4 | `csrFindUserOrders` | `user.findOrders` → `/commerceMgmt/userOrders` (+ dead `/database/search` probe ladder) | UserDetailPage, OrdersPage fan-out | 🟡 CONFIRM (guarded; "different envelope" history) |
| 5 | `csrFindOrders` | **direct-only** `/database/search {commerceOrder}` → **403** | OrdersPage, PurchasesPage | 🔴 BC ASK C |
| 6 | `csrGetUserOrder` | `user.getOrder` → `/commerceMgmt/getUserOrder` (+ `/database/search` probe) | UserDetailPage / order detail | ✅ SAFE (unguarded lib) |
| 7 | `csrFindOrderPayments` | `user.findOrderPayments` → `/commerceMgmt/orderPayments` | UserDetailPage / order detail | 🟡 CONFIRM (guarded) |
| 8 | `csrFindOrderHistories` | `user.findOrderHistories` → `/commerceMgmt/orderHistories` | UserDetailPage / order detail | 🟡 CONFIRM (guarded) |
| 9 | `csrFindOfferByShmName` | `offer.findByShmName` (**absent**) → `/commerce/offer/findByShmName` → **403 "No offer."** | UserDetailPage | 🔴 BC ASK A |
| 10 | `csrFindOptOuts` | **direct-only** `/database/search {optOutRequest}` | DataRemovalPage | 🟠 MIGRATE → `optOut.findOptOuts` (verify shape/collection) |
| 11 | `csrFindUserContacts` | **direct-only** `/database/search {userContact}` → **403** | UserDetailPage, MailActivityPage, NotesPage | 🔴 BC ASK D |
| 12 | `csrFindAllUserContacts` | **direct-only** `/database/search {userContact}` all-users → **403** | EmailTicketsPage | 🔴 BC ASK D |
| 13 | `csrFindUserAdminNotes` | `user.findUserAdminNotes` → `_csrGet /message/admin/findNotes` | UserDetailPage, NotesPage | 🟡 CONFIRM (guarded) |
| 14 | `csrFindContactMessages` | `message.contact.find` → `_csrGet /contactMessage/admin/find` | EmailTicketsPage, MyDashboard | 🟡 CONFIRM (guarded; "inbox+dashboard" history) |
| 15 | `csrFindUserContactMessages` | **composition**: direct `/contactMessage/admin/find/:userId` + paged inbox scan via #14 | UserDetailPage, EmailTicketsPage | 🟡 CONFIRM + 🔴 (needs server-side email filter — see B-2) |
| 16 | `csrFindContactHistories` | `message.contact.histories` → `_csrGet /contactMessage/admin/histories` | ticket thread | 🟡 CONFIRM (guarded) |
| 17 | `csrGetContactReplyLinkUrl` | `message.contact.replyLinkUrl` → `_csrGet /contactMessage/admin/replyUrl` | ticket reply | ✅ SAFE (unguarded lib) |
| 18 | `csrFindManagedContacts` | **direct-only** `/database/search {managedContact}` | UnsubscribePage, DataRemovalPage | 🟠 MIGRATE → `managedContact.findManagedContacts` (verify shape) |
| 19 | `csrFindContacts` | delegates to #14 (`message.contact.find`) | visitor contacts | ✅ SAFE (via #14) |
| 20 | `csrFindUserTracking` | **direct-only** `/database/search {trackings}` | UserDetailPage activity | ✅ MIGRATE (probe: lib `tracking.findUser` scopes correctly to one user — stale "all users" comment is wrong; confirm perPage on a high-volume user) |

## B. MUTATIONS / writes

| # | Method | Transport | Pages | Class |
|---|---|---|---|---|
| 21 | `csrUpdateUser` | `user.update` → `/user/management/update` | UserDetailPage | ✅ SAFE |
| 22 | `csrCreateUser` | `user.create` → `/user/management/create` | Users create | ✅ SAFE |
| 23 | `csrCancelUncancelOrder` | `user.cancelUncancelOrder` → `/commerceMgmt/cancelUncancelOrder` | UserDetailPage | ✅ SAFE |
| 24 | `csrRefundVoidOrder` | `user.refundVoidOrder` → `/commerceBilling/correct` | UserDetailPage | ✅ SAFE |
| 25 | `csrUpdateScheduleDueTimestamp` | `user.updateSchedule` → `/commerceMgmt/updateSchedule` | UserDetailPage | 🟡 CONFIRM (lib method name/path historically differed) |
| 26 | `csrCreateOrder` | `billing.sale` (**absent**) → `/commerceBilling/sale` (hand-built `billingSeriesId`) | UserDetailPage create-order | 🔴 BC ASK B |
| 27 | `csrCreateAdminNote` | manual-try `message.note.createUserAdminNote` → `/message/admin/createNote` (+legacy) | UserDetailPage, NotesPage | 🟡 CONFIRM (manual try, not `_viaCsr`) |
| 28 | `csrCreateContactAdminNote` | `message.note.createContactAdminNote` → `/message/admin/createNote` | ticket | ✅ SAFE |
| 29 | `csrUpdateAdminNote` | manual-try `message.note.updateAdminNote` → `/message/admin/updateNote` (+legacy) | NotesPage | 🟡 CONFIRM (manual try, not `_viaCsr`) |
| 30 | `csrCreateContactMessage` | `message.contact.create` → `/contactMessage/admin/create` | UserDetailPage | ✅ SAFE |
| 31 | `csrCreateCsrMail` | composition of #30 + #32 (both lib) | UserDetailPage billing action | ✅ SAFE (via #30/#32) |
| 32 | `csrCreateCsrReply` | `message.contact.createCsrReply` → `_csrPostFormData /contactMessage/admin/csrReply` | ticket reply | ✅ SAFE |
| 33 | `csrSetContactActor` | `message.contact.setActor` → `/contactMessage/admin/setActor` | ticket | ✅ SAFE |
| 34 | `csrSetContactTargetUser` | `message.contact.setTargetUser` → `/contactMessage/admin/setTargetUserId` | ticket | ✅ SAFE |
| 35 | `csrSetContactTags` | `message.contact.setTags` → `/contactMessage/admin/setTags` | ticket | ✅ SAFE |
| 36 | `csrUnsubscribeManagedContact` | `managedContact.unsubscribe` → `/managedContact/management/unsubscribe` | UnsubscribePage, DataRemovalPage, UserDetailPage | ✅ SAFE |
| 37 | `csrChangeContactToUserContact` | `contact.changeContactToUserContact` (**absent**) → `/message/admin/user/changeContactToUserContact` | **none (dead code)** | ⚪ DELETE or repoint to `setTargetUser` |

---

## C. THE BC-FACING LIST (to reach zero direct calls)

### Hard asks — no usable lib path (BC must ADD / FIX / GRANT)
1. **A — `offer.findByShmName` + CSR offer grant.** Add `csrWrapper.api.offer.findByShmName`; make
   offer resolve in the CSR clientId/role (currently 403 "No offer." all brands). *(csrFindOfferByShmName)*
2. **B — CSR `billing.sale({payerId,…})`.** Add a `csrWrapper.api.billing.sale` that bills the
   *customer* (payerId) and injects `billingSeriesId`. *(csrCreateOrder)*
3. **C — global order search.** Open `commerceOrder` to the CSR role, or add a global order finder
   (today: 403 "Invalid Database Search Role"). *(csrFindOrders)*
4. **D — `userContact` reads.** Open the `userContact` collection to the CSR role **and** provide
   per-user + all-users finders, OR confirm member messages are all `contactMessage`-by-`targetUserId`
   (then #11/#12 migrate to existing methods). Direct is 403 today. *(csrFindUserContacts, csrFindAllUserContacts)*
5. **E — server-side email filter on `/contactMessage/admin/find`.** Today we page through up to 40
   inbox pages client-side to find a member's older tickets. *(csrFindUserContactMessages)*

_(Two candidate asks were investigated and DROPPED after focused, auth-gated probing — they were
probe-param artifacts, not real gaps: `findAdmin` returns CSR staff with no brand, and `tracking.findUser`
scopes correctly to one user. Both migrate clean. See §D.)_

### Confirm-shape — lib EXISTS and returns real docs (probe-verified); WE migrate, minimal BC involvement
Probe (§D) confirmed these return usable data via the lib → drop the direct fallback ourselves, no new
BC method. Only two need BC to confirm shape on a *populated* set (probe saw 0 docs = empty data, not a
bad method):
- **Migrate-safe now** (lib returned real docs): `user.find`, `user.findAdmin` (no brand — /cs-reps),
  `user.findOrders`, `user.findOrderPayments`, `user.findOrderHistories`, `user.getUserDetail`,
  `user.getOrder`, `message.contact.find`, `message.contact.histories`, `message.contact.replyLinkUrl`,
  `managedContact.findManagedContacts`, `tracking.findUser` (scopes per-user; confirm perPage at volume).
- **Confirm on populated data** (probe saw 0 docs): `optOut.findOptOuts`, `user.findUserAdminNotes`.
- **Confirm path/name** (historically drifted): `user.updateSchedule`, `message.note.createUserAdminNote`,
  `message.note.updateAdminNote`.

### Ours only (no BC action)
- Migrate the 🟠/🟡 reads above off `_csrPost`/`_csrGet` to the confirmed lib methods.
- Remove the dead `/database/search` probe ladders in #4/#6 once the lib path is confirmed.
- Delete or repoint `csrChangeContactToUserContact` (#37) to `message.contact.setTargetUser`.

**Migration status — 2026-06-22 (DONE):** the three direct-only reads are now lib-first
(`_viaCsr` + guarded fallback), filter-verified live first:
- `csrFindOptOuts` → `optOut.find` (proper envelope, `_isUsableList` passes).
- `csrFindManagedContacts` → `managedContact.find` (honors `type` filter: email→10, phone→0).
- `csrFindUserTracking` → `tracking.findUser` (scopes server-side to the target user; returns the
  `data` field the activity tab renders) — stale "returns all users" comment corrected.
- Dead `/database/search` commerceOrder ladders in `csrFindUserOrders`/`csrGetUserOrder` **removed**.
Build `admin.aa9b4f63.js`; full jest suite green (335/335, also fixed 2 pre-existing `csrFindUsers`
timeouts). `csrChangeContactToUserContact` repoint still pending (dead code, no page calls it).
The 10 already-lib-first reads keep their guarded fallback for launch-week safety (lib is primary =
compliant at runtime; direct only fires if the lib breaks) — strip those fallbacks as a verified
follow-up once BC sets a direct-call cutover date.

---

## D. Runtime probe results (lib-vs-fallback ground truth)
Ran `scripts/probe-csr-all-lib-methods.js` live (dev csrManager account, 2026-06-22). Per lib method:
exists? + docCount returned (read-only).

| Lib method | exists | lib docs | direct contrast | Verdict |
|---|---|---|---|---|
| `user.find` | ✅ | 10 | — | ✅ migrate-safe |
| `user.getUserDetail` | ✅ | (obj) | — | ✅ safe |
| `user.findOrders` | ✅ | 1 | — | ✅ migrate-safe (envelope OK — "different envelope" no longer reproduces) |
| `user.getOrder` | ✅ | (obj) | — | ✅ safe |
| `user.findOrderPayments` | ✅ | 2 | — | ✅ migrate-safe |
| `user.findOrderHistories` | ✅ | 2 | — | ✅ migrate-safe |
| `message.contact.find` | ✅ | 20 | — | ✅ migrate-safe (inbox/dashboard OK) |
| `message.contact.histories` | ✅ | 1 | — | ✅ migrate-safe |
| `message.contact.replyLinkUrl` | ✅ | (url) | — | ✅ safe |
| `managedContact.find` | ✅ | 10 | — | ✅ migrate-safe |
| `optOut.find` | ✅ | 0 | — | 🟡 method OK, 0 docs (no opt-outs) → confirm `docs[]` shape on a populated set |
| `user.findUserAdminNotes` | ✅ | 0 | — | 🟡 method OK, 0 docs → confirm shape on a user with notes |
| `user.findUserContacts` | ✅ | 1 | — | reads **contactMessage**, not `userContact` (semantic — ASK D) |
| `tracking.findUser` | ✅ | 3 (all scoped to target user) | direct 100 (all users) | ✅ **migrate** — focused probe: `distinctUpdaterIds:1`, all = target user. Lib scopes correctly; the stale "returns all users" code comment is WRONG. (Direct 100 = the unscoped set we client-filter.) |
| `user.findAdmin` | ✅ | **10 staff (no-brand)** | direct(admins) 200 → 10 staff | ✅ **migrate** — focused probe `findAdmin({})` → 10 `csr.NNNN@csr.pds` `roles:['csr']`, `usableList:true`. The all-lib `0` was the `{brandId:'idlookup'}` **trap**; the `admins` 403 was the un-authed glitch. |
| `billing.sale` | ❌ absent | — | — | 🔴 ASK B |
| `offer.findByShmName` | ❌ absent | — | — | 🔴 ASK A |
| `contact.find` / `contact.*` | ❌ absent | — | — | 🔴 (ASK D-adjacent; `changeContactToUserContact` is dead anyway) |

**Probe takeaways:**
- **Good news:** all 6 previously-distrusted (`validate`-guarded) order/message reads return **docs via
  the lib** (the probe's `getData()`+array extraction mirrors `_isUsableList`) — the old "different
  envelope / breaks inbox+dashboard" failures no longer reproduce. **Migration candidates** (confirm
  field-level shape per page, then drop the fallback). `managedContact.find` (10 docs) too.
- **`/cs-reps` (`findAdmin`) is FINE — not a BC ask.** A focused, auth-gated probe
  (`scripts/probe-csr-findadmin-tracking-verify.js`) shows `findAdmin({})` → 10 real CSR staff
  (`csr.NNNN@csr.pds`, `roles:['csr']`, `usableList:true`). `csrFindCsReps` already calls `findAdmin`
  WITHOUT the `idlookup` brand, so it migrates clean. The all-lib probe's `0` was the
  `{brandId:'idlookup'}` **trap**; the `admins` 403 was the un-authed glitch (authed → 200/10).
- **`tracking.findUser` is FINE — not a BC ask.** Same focused probe: lib returns 3 docs **all scoped to
  the one target user** (`distinctUpdaterIds:1`). The lib scopes correctly; our stale code comment
  ("returns events for every user") is wrong. Migrate (drop the direct call + client filter).
  *(Caveat: this user had 3 events — confirm `perPage` on a high-volume user, but scoping is proven.)*
- **⚠️ Probe-hygiene lesson (re-learned):** an un-authed CSR session returns blanket `0`/`403` on
  `/database/search`. ALWAYS gate on a login-confirmation (user.find returns docs) before trusting any
  result, and never pass `{brandId:'idlookup'}` to `findAdmin` (staff are `bytecrtrs`).

## Scope note
This audit is **CSR only**. Kwan's mandate also applies to the **consumer** client
(`apiWrapper.js` direct fallbacks at ~947–1313: `tracking/create`, `contactMessage` create/reply,
`user/update`, `cancelOrUncancelOrder`, `changePassword`, `managedContact/unsubscribe/mail`). That is a
**separate sweep** — not included here.
