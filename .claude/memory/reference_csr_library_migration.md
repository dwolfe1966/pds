---
name: csr-direct-endpoint-csrwrapper-library-migration-map
description: "Which apiWrapperCsr.js csr* methods can migrate to the csrWrapper IIFE library, which can't (BC gaps), and 4 \"fake lib-first\" methods that silently always hand-roll. Plus the stale \"different envelope\" comment trap."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7cf476e3-95d5-4760-901e-3e85bff7c6de
---

Analysis 2026-06-11 (deployed csrWrapper IIFE `/tmp/bc-csr.js`). Goal: move CSR calls off
hand-rolled `_csrPost`/`_csrGet` (which replicate auth/captcha/billingSeriesId by hand — the
refund-406 bug class) onto `csrWrapper.api.*`.

**Envelope comments are EMPIRICAL, not stale — do NOT blindly migrate (corrected 2026-06-12).**
A survey agent claimed `_unwrapBcResponse(getData())` normalizes everything so the "IIFE
returns a different envelope, kept direct" comments are stale. **That's wrong:** at least two
methods carry empirical warnings from people who tried the IIFE — `csrFindContactMessages`
("…breaking the inbox + dashboard") and `csrFindUserOrders` ("returns a different envelope
shape than callers expect"). `_viaCsr` does NOT fall back when the IIFE *succeeds* with a
different shape, so a bad migration silently breaks the CSR caller. **Each read migration needs
per-method LIVE verification** (load the actual CSR page, compare data) — not a bulk swap.
Reverted a "safe subset" migration on 2026-06-12 for exactly this reason. Migrations deferred
to post-launch.

**Deployed csrWrapper IIFE surface:** `user.{create,update,getUserDetail,find,findAdmin,
findUserContacts,findUserAdminNotes,findOrders,getOrder,findOrderPayments,findOrderHistories,
cancelUncancelOrder,refundVoidOrder,updateSchedule}, optOut.find, message.contact.{create,
createCsrReply,find,histories,replyLinkUrl,setActor,setTargetUser,setTags}, message.note.
{createContactAdminNote,createUserAdminNote,updateAdminNote}, managedContact.{find,unsubscribe},
tracking.findUser, shape, attachment`. **NO `billing`, `offer`, or top-level `contact`
namespace** (csrApi.csv documents `api.contact.*` etc. — docs ahead of bundle).

**4 FAKE lib-first** (reference an IIFE method that DOESN'T EXIST → silently ALWAYS hit the
hand-rolled direct fallback): `csrCreateOrder`→`api.billing.sale` (refund-bug-class, every
CSR sale hand-rolls /commerceBilling/sale), `csrUpdateScheduleDueTimestamp`→`api.user.
updateScheduleDueTimestamp` (IIFE method is `updateSchedule`, path `/commerceMgmt/updateSchedule`
not `…DueTimestamp` — likely BROKEN, verify live), `csrFindOfferByShmName`→`api.offer.findByShmName`,
`csrChangeContactToUserContact`→`api.contact.changeContactToUserContact`.

**MIGRATE now (~10):** csrFindUsers(`user.find`), csrFindUserOrders(`user.findOrders`),
csrGetUserOrder(`user.getOrder`, pass userId), csrFindOrderPayments, csrFindOrderHistories,
csrFindContactMessages(`message.contact.find`), csrFindContactHistories, csrGetContactReplyLinkUrl
+ verify-collection-name: csrFindCsReps(`user.findAdmin`, collection 'admins' vs ours), csrFindOptOuts
(`optOut.find`, 'optouts' vs 'optOutRequest'), csrFindManagedContacts(`managedContact.find`, 'managedcontacts').

**CAN'T migrate → BC asks (5):** csrFindOrders (no global commerceOrder finder), csrFindAllUserContacts,
csrFindContacts (no `contact` ns), csrFindUserTracking (IIFE `tracking.findUser` drops our
`perPage:100`+`displayFields` → reintroduces the capped-10 mixed-user bug; also still needs
server-side updaterId scoping — see [[reference_bc_sale_sequenceoption_406]] sibling tracking issue),
csrCreateOrder (`billing.sale` not on IIFE).

**DO NOT migrate (semantic trap):** csrFindUserContacts — IIFE's same-named `user.findUserContacts`
returns **contactMessages** (GET /contactMessage/admin/find/:userId), NOT our `userContact`
collection (notes/CSR-mail). Different data.
