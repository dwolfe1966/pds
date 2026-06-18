---
name: csr-lib-live-evidence-2026-06-17
description: "Live re-verification 2026-06-17 of every csrWrapper lib method (csrManager): findAdmin & tracking.findUser lib-broken reproduced (lib 0 / direct 10 & 100); optOut+managedContact now READABLE (was 403); findUserContacts/findUserAdminNotes URL-proven to read contactMessage/findNotes not userContact; billing/offer/contact namespaces absent."
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

Re-tested the FULL deployed csrWrapper surface live (account `frontend@csrManager.pds`,
`dev.admin.www.bytecrtrs.com`, 2026-06-17). Harness `scripts/probe-csr-all-lib-methods.js`,
raw out `scripts/out/all-lib-methods.json`. Findings written up for BC in
`docs/BC_CSR_LIB_METHOD_LIVE_EVIDENCE.md`. **This run is authoritative over earlier point-in-time
notes** — see [[csr-auth-state-2026-06-16]] (partially superseded).

Test record: user `6a30a88dce24e4018b18e016` (`testingreg061526d@idlookup.ai`),
order `6a30a88dce24e4018b18e032`, contactMessage `6a31ca36f009300c72f299b2`.

**List C "lib broken" — REPRODUCED live, same session/userId (the contrast BC wanted):**
Both lib methods POST to the SAME `/api/database/search` the direct call uses, yet return 0 →
wrong query body, NOT a permission/transport issue.
- `tracking.findUser({type:'USER:login', updaterId:'6a30a88…', perPage:100})` → **0 docs (200)**;
  direct `/database/search {collectionName:'trackings', query:{'data.type':'USER:login'}, updaterId, perPage:100}` → **100 docs**.
- `user.findAdmin({brandId:'idlookup', perPage:10})` → **0 docs (200)**;
  direct `/database/search {collectionName:'users', isAdmin:true, perPage:10}` → **10 docs**.
  ⚠ CORRECTION (`_id`-check, probe-csr-31-idcheck.js): that direct "10" is NOT staff — `/database/search`
  IGNORES `isAdmin` (top-level AND under query); the 10 are the default user list (`_id`-equal to an
  unfiltered query; first "admin" = test signup user 6a30a88). So 3.1 = findAdmin returns 0 AND isAdmin
  filtering is a no-op → NO working path to CSR staff. Do NOT route csrFindCsReps through
  user.find+isAdmin (would show customers as CSR reps). Count-equivalence is insufficient — always _id-check.

**CORRECTED grant state (BC opened more than [[csr-auth-state-2026-06-16]] recorded):**
- `managedContact.find` → **READABLE, 10 real docs** (was 403). Can migrate now.
- `optOut.find` → **READABLE, clean empty envelope 200** (was 403). Can migrate now.
- `user.find` (users) still works (10). `users`+`isAdmin:true` works via DIRECT (10) but lib findAdmin returns 0 (above).
- **`userContact` collection STILL 403 "Invalid Database Search Role"** (direct `/database/search`,
  both with/without brandId, per-user + all-users). Confirms items 2.2/2.3 have NO working path for
  csrManager: lib reads wrong collection, direct is role-gated. Auth is fine (same session 200s on
  users/trackings); only userContact 403s. Probe `scripts/probe-csr-usercontact-direct.js`. Item 2.3
  also: findUserContacts/findUserAdminNotes are hard PER-USER (no userId → 500 / 400 / throw).

**Item 2.2 URL-proof (findUserContacts/findUserAdminNotes do NOT read userContact collection):**
- `user.findUserContacts({userId})` → `GET /api/contactMessage/admin/find/:userId` (contactMessage collection).
- `user.findUserAdminNotes({userId})` → `GET /api/message/admin/findNotes?referenceId=…&referenceCollection=users` (admin notes).
- Both returned 0 for this user (no tickets/notes); URL proves the collection mismatch regardless.

**CODE FIXES DONE (2026-06-17, apiWrapperCsr.js; consumer build clean):**
- **2.4** `csrFindContacts` now delegates to `csrFindContactMessages` (message.contact.find) instead of
  the gated `POST /database/search {collectionName:'contact'}` (403). NOTE: the all-inbox finder is
  `csrFindContactMessages` (NO "User"); `csrFindUserContactMessages` is the per-user one that REQUIRES
  userId — don't confuse them.
- **2.7** `csrChangeContactToUserContact` KEPT on the direct call (IIFE has no contact.* method) but
  comment now records the setTargetUser candidate is NOT a drop-in: BC's csrApi.csv shows
  `setTargetUser({contactMessageId, currentRevisionId, targetUserId})` needs a concurrency token, and
  "changeContactToUserContact" may be a collection conversion vs setTargetUser's field-set — equivalence
  unconfirmed (asked in BC msg 2.7). Did NOT do a live setTargetUser mutation: it can't prove equivalence
  and the path is dead anyway. Both paths unused by any page.

**List B absent confirmed live (exists:false, no namespace):** `billing.sale`, `offer.findByShmName`,
`contact.find`/`contact.changeContactToUserContact`. No global commerceOrder finder, no all-user userContact finder.

**All 8 already-migrated reads still GREEN:** user.find, getUserDetail, findOrders, getOrder,
findOrderPayments, findOrderHistories, message.contact.find (20), message.contact.histories.

**BC PER-ITEM RESPONSES — evaluated live, results in `docs/BC_CSR_LIB_METHOD_LIVE_EVIDENCE.md`:**
BC pushed back on each ask suggesting an existing lib method. Outcomes:
- **2.2** (per-user userContact notes): BC said findUserAdminNotes/findUserContacts. REJECTED —
  findUserContacts→`/contactMessage/admin/find/:userId` (contactMessage), findUserAdminNotes→
  `/message/admin/findNotes` (admin notes); NEITHER reads userContact. Direct userContact ALSO 403s.
- **2.3** (all-users inbox): same two methods. REJECTED — both are hard PER-USER (no userId → 500/400/throw)
  + wrong collection. Need all-users userContact finder + collection opened.
- **2.4** (visitor contacts): BC said message.contact.find. ✅ ACCEPTED/WITHDREW our ask — it returns
  20 docs all `type:"contact"` (visitor msgs); already what our UI uses. (Our code fix owed — see ACTION above.)
- **2.5** (CSR sale): BC said consumer `ApiWrapper.billing.sale`/`tokenSale`. REJECTED — they're consumer/
  session-bound with NO `payerId` (0× in both IIFE builds); sale needs the customer's full card (PCI),
  tokenSale charges the session user's token. csrWrapper has no billing ns. Still need CSR `billing.sale({payerId})`.
- **2.7** (link contact→user): BC said message.contact.replyLinkUrl. REJECTED — replyLinkUrl only returns a
  deeplink `{replyLinkUrl:"https://dev./contact?...&contactMessageId=..."}` (no targetUserId, no association).
  BUT the right method EXISTS: `message.contact.setTargetUser` (POST /contactMessage/admin/setTargetUserId,
  our `csrSetContactTargetUser`) — WITHDREW changeContactToUserContact pending BC confirming equivalence.
  (changeContactToUserContact also dead plumbing: apiRouterAdmin.js:350, no page calls it.)
  Aside bug: replyLinkUrl returns malformed host `https://dev./contact` (missing domain).
- Pattern: concede where BC is right (2.4, 2.7→setTargetUser) to keep credibility on the real gaps
  (2.2/2.3/2.5 + findAdmin/tracking fixes + offer.findByShmName + global order finder).
- Probes added: probe-csr-all-lib-methods, -usercontact-vs-suggested, -usercontact-allusers,
  -usercontact-direct, -contact-2.4, -billing-2.5, -link-2.7 (all login-confirmed, read-only).

**Probe caveat:** first run hit a login-timing glitch (session not authed → spurious blanket 403s on
every /database/search). Trust only runs where ID discovery succeeds (user.find returns data). Add a
login-confirmation wait before relying on the harness again.
