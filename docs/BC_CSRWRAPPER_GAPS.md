# BC ask — deployed `csrWrapper` IIFE is missing documented methods (forces hand-rolled endpoints)

**Raised:** 2026-06-12 · **From:** PDS / idlookup CSR tooling · **Status:** OPEN

We're migrating CSR calls off hand-rolled direct `POST/GET` (which replicate auth/captcha/
`billingSeriesId` by hand — the class of bug that caused the refund 406 and the CSR-sale 406)
onto the `csrWrapper.api.*` library. Audit of the **deployed** csrWrapper IIFE
(`dev.admin.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js`) vs `csrApi.csv` shows the
bundle is **behind the docs** — several documented methods/namespaces aren't deployed, so we
must keep hand-rolling. Please deploy these on the live csrWrapper:

| Needed method | For our method | Today (hand-rolled) | Notes |
|---|---|---|---|
| **`api.billing.sale`** | `csrCreateOrder` | `POST /commerceBilling/sale` (we now inject `billingSeriesId` ourselves) | No `billing` namespace on the deployed IIFE. CSR-initiated sales — highest risk (real charges). |
| **`api.offer.findByShmName`** | `csrFindOfferByShmName` | `POST /commerce/offer/findByShmName` | No `offer` namespace deployed. |
| **`api.contact.find`** + **`api.contact.changeContactToUserContact`** | `csrFindContacts`, `csrChangeContactToUserContact` | `POST /database/search`, `/message/admin/user/changeContactToUserContact` | No top-level `contact` namespace deployed. |
| **A global order finder** (orders without a `userId`) | `csrFindOrders` | `POST /database/search` (collection `commerceOrder`) | `user.findOrders` requires a userId; CSR sometimes has only an order id. |
| **An unfiltered `userContact` finder** | `csrFindAllUserContacts` | `POST /database/search` (collection `userContact`) | No IIFE equivalent. |
| **`api.tracking.findUser` with `perPage` + `displayFields`** (or server-side `updaterId` scoping) | `csrFindUserTracking` | `POST /database/search` with `perPage:100` + `displayFields` | The deployed `tracking.findUser` omits these → returns the capped-10 mixed-user page (the bug we already worked around). Migrating to the IIFE as-is would REINTRODUCE it. Tied to the separate server-side `updaterId` scoping ask (`BC_CSR_TRACKING_SCOPE.md`). |

**Already resolved by us (FYI):** the doc-vs-bundle drift also hid two of our own bugs the
audit caught — `csrCreateOrder` was missing `billingSeriesId` (fixed: inject type `'sale'`),
and `csrUpdateScheduleDueTimestamp` targeted a non-existent IIFE method + wrong path (fixed to
the real `user.updateSchedule` → `/commerceMgmt/updateSchedule`).

**Also worth confirming (collection-name drift):** the deployed IIFE's `/database/search`
builders use collection names that differ from ours — `user.findAdmin`→`admins` (ours:
`users`+isAdmin), `optOut.find`→`optouts` (ours: `optOutRequest`), `managedContact.find`→
`managedcontacts` (ours: `managedContact`). One side is wrong; please confirm the canonical
collection names so we can migrate `csrFindCsReps`/`csrFindOptOuts`/`csrFindManagedContacts`
safely.

Once these are on the live bundle we migrate ~5 more methods to the library and drop the
hand-rolled paths.
