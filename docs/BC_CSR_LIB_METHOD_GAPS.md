# BC ask — CSR lib methods (so we can stop calling endpoints directly)

**Filed:** 2026-06-16 · **From:** PDS / idlookup · **For:** BC CTO + dev
**Context:** BC asked us not to call API endpoints directly — all CSR calls should go through
the csrWrapper IIFE (`csrWrapper.api.*`). We audited every CSR call against the **deployed**
csrWrapper surface (introspected live, not the docs). Two lists below.

## Deployed csrWrapper surface (ground truth, 2026-06-16)

`auth.{login,logout}`, `user.{create,update,getUserDetail,find,findAdmin,findUserContacts,
findUserAdminNotes,findOrders,getOrder,findOrderPayments,findOrderHistories,cancelUncancelOrder,
refundVoidOrder,updateSchedule}`, `optOut.find`, `message.contact.{create,createCsrReply,find,
histories,replyLinkUrl,setActor,setTags,setTargetUser}`, `message.note.{createContactAdminNote,
createUserAdminNote,updateAdminNote}`, `managedContact.{find,unsubscribe}`, `tracking.findUser`,
`shape.getBrandIds`, `attachment.{download,remove}`.
**Absent:** any `billing`, `offer`, or top-level `contact` namespace; any *global* order finder;
any *all-user* contact finder.

## List A — we will switch these to EXISTING lib methods (our work, no BC action)

These hand-roll a direct HTTP call today but a lib method already exists. We're migrating them.

| Our call (direct today) | Existing lib method | Note |
|---|---|---|
| customer search → `/database/search` users | `user.find` | envelope differs from our parser — needs adapter |
| CSR-rep list → `/database/search` users(isAdmin) | `user.findAdmin` | |
| data-removal list → `/database/search` optOutRequest | `optOut.find` | |
| unsubscribe list → `/database/search` managedContact | `managedContact.find` | |
| tracking tabs → `/database/search` trackings | `tracking.findUser` | lib drops our `perPage:100`+`displayFields` — verify no capped/mixed-user regression |
| per-customer orders → `/commerceMgmt/userOrders` | `user.findOrders` | envelope differs — needs adapter |
| order detail → `/commerceMgmt/getUserOrder` | `user.getOrder` | |
| order payments → `/commerceMgmt/orderPayments` | `user.findOrderPayments` | |
| order histories → `/commerceMgmt/orderHistories` | `user.findOrderHistories` | |
| tickets inbox → `/contactMessage/admin/find` | `message.contact.find` | envelope differs — broke inbox before; adapt + verify |
| ticket thread → `/contactMessage/admin/histories` | `message.contact.histories` | |
| reply link → `/contactMessage/admin/replyUrl` | `message.contact.replyLinkUrl` | |

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
