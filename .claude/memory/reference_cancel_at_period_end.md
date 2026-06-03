---
name: cancel-at-period-end-order-shape-check-substatus-not-transient-canceled
description: "A cancelled-but-in-period order is status=active + subStatus=canceled + transient.canceled=true; code must treat it as operative via subStatus, not reject on transient.canceled."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2a7937d0-2c0b-462e-b57c-c5bc0b3fde3f
---

When a member cancels (cancel-at-period-end), the BC order shape (verified live
2026-06-02 via getUserOrders) is:
```
status: "active", subStatus: "canceled", transient.canceled: true,
transient.cancelable: false, dueTimestamp: <future ms>
```
The user keeps access until `dueTimestamp`. The trap: `transient.canceled` is
`true` even though access continues — so any `if (transient.canceled) reject`
wrongly drops them to free.

**The operative-order rule (use this everywhere):** an order grants access if
`status === 'active'` AND `(subStatus !== 'canceled' OR dueTimestamp > now)`.
Check the `subStatus === 'canceled' && dueTimestamp > now` case BEFORE any
`transient.canceled` rejection.

This pattern broke #50/#57/#59 (consumer) and the CSR order button — all three
checked the wrong field. Fixed 2026-06-02/03:
- `AuthContext.refreshSubscription` — reordered the operative-order find.
- `AccountPage` — already showed Reactivate when `subscription.subStatus ===
  'canceled'`; the refreshSubscription fix lit it up.
- `PurchaseDetailPage` (CSR) — `canceled = transient.canceled || subStatus === 'canceled'`.

Reactivate = un-cancel (`cancelSubscription(orderId, { flag:false })` consumer /
`api.user.cancelUncancelOrder({orderId, flag:false})` CSR). Do NOT route reactivate
to a re-purchase — BC rejects the offer with `nonMemberOnlyCommerceOffer` (#50).
Ties to [[feedback_subscription_state_authority]] and BC #74 (does cancel stop the
renewal charge — still open).
