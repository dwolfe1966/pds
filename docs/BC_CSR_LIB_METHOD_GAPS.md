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

**QUEUED — lib exists, needs its own equivalence/field check before switching:**
| Our call (direct today) | Lib method | Why not yet |
|---|---|---|
| order detail → `/commerceMgmt/getUserOrder` | `user.getOrder` | single-object `{order}`; run id-equivalence then switch |
| tickets inbox → `/contactMessage/admin/find` | `message.contact.find` | _id set matched (20==20) BUT empirical "breaks inbox+dashboard" scar — verify `latestReply` fields + `lastId` paging first |
| ticket thread → `/contactMessage/admin/histories` | `message.contact.histories` | verify by contactMessageId |
| reply link → `/contactMessage/admin/replyUrl` | `message.contact.replyLinkUrl` | verify returned URL |

## List C — lib method EXISTS but returns WRONG results (BC must FIX, do NOT switch)

These passed shape-match but FAILED result-equivalence — switching would silently empty the UI.
| Our call | Lib method | Result-equivalence finding |
|---|---|---|
| CSR-rep list | `user.findAdmin` | lib returned **0 docs** vs direct **10** (same query). Likely wrong collection/args. |
| tracking tabs (Searches/Reports/Logins) | `tracking.findUser` | lib returned **0** vs direct **100** for `{type,updaterId,perPage:100}`. Appears to scope to the *caller's own* tracking, not a target user's — can't carry our `updaterId` scoping. |

**Until BC fixes these two, we keep the direct calls** (the alternative is an empty CSR-rep list
and empty Searches/Reports/Logins tabs).

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
