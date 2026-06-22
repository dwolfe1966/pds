---
name: bc-getorder-definitive-price
description: "BC Ask A RESOLVED (Kwan 2026-06-23): the CSR definitive/upcoming customer price comes from csrWrapper.api.user.getOrder's schedule, NOT the offer endpoint. Exact field paths + that offer.findByShmName is only for NEW-sale templates (folds into Ask B)."
metadata:
  node_type: memory
  type: reference
  originSessionId: current
---

**Ask A (offer/price lookup) is WITHDRAWN — Kwan 2026-06-23.** The CSR doesn't need
`offer.findByShmName` (which 403s "No offer." in CSR context) to show a customer's price. Use the
already-working lib method **`csrWrapper.api.user.getOrder({ userId, orderId })`** (our `csrGetUserOrder`).

**Definitive / upcoming price field paths** (live-verified 2026-06-22, `scripts/probe-csr-getorder-price.js`,
returns `{ order: {...} }`):
- **`order.schedule.data.totalPrice`** → `{ amount, code }` = the next recurring charge (the definitive
  price the customer actually pays — e.g. `49.98 usd`). Better than the offer's `s0/s1` template.
- **`order.schedule.dueTimestamp`** (epoch ms) + **`order.dueTimestamp`** = next/upcoming billing date.
- **`order.schedule.type`** = `commerceBillingRecur`; **`order.schedule.data.sequence`** = which cycle.
- **`order.transient.amount.collected`** = collected to date; **`order.status`** = active/canceled.
- Customer **name** is on the USER record (firstName/lastName/email via `getUserDetail`), not the order.

Implemented in `UserDetailPage` order card (surfaces `schedule.data.totalPrice` next to the existing
"Next: {date}"). Admin bundle `admin.7a8565bb.js`.

**The offer endpoint is NOT fully dead:** `adminFindOffer`/`csrFindOfferByShmName` is still used for the
**create-order catalog** (NEW retention/comp/signup sale prices, `UserDetailPage` ~974-1025) — that 403s
but has hardcoded `fallbackPrice` and folds into **Ask B** (CSR `billing.sale`), not a standalone ask.

Net BC asks now **4**: B (CSR billing.sale), C (global commerceOrder), D (userContact reads), E
(contactMessage email filter). See `docs/BC_CSR_LIB_ONLY_ASKS.md`. Relates to
[[reference_cancel_at_period_end]] (order subStatus/dueTimestamp) and [[bc-csr-asks-package]].
