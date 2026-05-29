---
name: BC getUserOrders returns 403 for no-orders users
description: BC's /commerceBilling/getUserOrders returns HTTP 403 when the authenticated user has no orders, instead of an empty array
type: reference
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
`POST /api/commerceBilling/getUserOrders` returns HTTP **403 Forbidden** when the authenticated user has zero active orders. Confirmed against BC production (`www.idlookup.ai`) and dev (`dev.www.idlookup.ai`) on 2026-05-18.

**Implication for client code:** treat 403 on this endpoint as equivalent to an empty orders list (i.e., "not subscribed"), NOT as an auth failure. The existing client code already routes 403 users to `/payment` and that's correct — do not change that behavior, and do not treat 403 here as a session-expiry signal.

**How to apply:** if you find a 403 on `getUserOrders` in a debugging trace, do NOT assume it's an auth bug. Look at whether the user has any active subscription. If they're a fresh sign-up with no purchase yet, the 403 is BC behaving as designed.

Source response that confirmed the alternate state (active orders) returns a JSON array with order objects containing `status: "active"`, `_id`, `commercePriceRules`, `transient.canceled`, etc.
