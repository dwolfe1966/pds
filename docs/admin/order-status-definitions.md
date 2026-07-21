# CSR Status Definitions — canonical spec (DRAFT for owner review, 2026-07-21)

**Why this exists:** CSRs report our billing/status labels disagree with the legacy system and with
BC's own order-status view. Root cause: we invented a client-side plan vocabulary
(`Free/Trial/Subscriber/Cancelled/Refunded/Expired/Payment failed`) and derive it from raw BC order
fields — but we (a) conflate three *different* BC objects that share status words, and (b) misread two
overloaded terms. This doc pins down what each BC term actually means, grounded in BC's own API docs
(`docs/new-api/bc client library - csrApi.csv`), then defines what CSR should display.

Legend: ✅ = proven from BC doc data · ⚠️ = needs BC confirmation (do NOT guess).

---

## DECISIONS FOR OWNER (answer these first — they shape everything below)

1. **Mirror BC's words, or keep friendly derived labels?** The complaint is comparative ("vs the
   legacy system," "BC built a corresponding order-status view"). §2 below is a *third* invented
   vocabulary — the same move that caused the mismatch. Choose:
   - **(A) Mirror BC** — CSR shows BC's own terms verbatim (active/inactive + subStatus + reason) so our
     screen matches BC's order-status view 1:1. Least surprise, no derivation drift.
   - **(B) Derived labels** — keep friendlier states (Trial / Subscriber / Cancelled-active-until-X). More
     readable, but must be provably correct and reconciled against BC's view.
   - **(C) Both** — show BC's raw status AND a derived label side by side.
2. **What did the LEGACY system actually display?** I have no legacy anchor. Tell me the exact labels/
   columns CSRs saw before, so "correct" is defined against the thing they're comparing to.
3. **Trial→Subscriber is broken for 100% of customers** (see §3 #7) — confirms the derivation is
   unreliable and argues for (A)/(C) over (B), or for a payment-count rule if we keep (B).

---

## 0. The core mistake: three objects, one status vocabulary

BC has **three separate objects**, each with its OWN status field. They are NOT interchangeable, but
they reuse the same words (`active`, `fulfilled`, `expired`, `unsubscribed`, `requested`). Reading a
status off the wrong level is the primary bug.

| Object | Field | Values seen in BC docs | What it describes |
|---|---|---|---|
| **User (account)** | `user.status` | `active`, `blocked` (enum also: inactive/removed/banned) | login/ban state — can they access the account at all |
| **Order (entitlement / subscription)** | `order.status` | `active`, `inactive` | is this purchase currently granting access |
| | `order.subStatus` | `expired`, `canceled` | *why* an order is the way it is |
| | `order.statusReason` | `SuccessfulTx`, `correct\|refund` | the event that last changed it |
| **Payment (single transaction)** | `payment.status` | `fulfilled`, (pending/failed) | did this one charge settle |
| | `payment.type` | `sale`, `refund`, `void` | what kind of transaction |

**Not billing at all** (must NEVER drive a billing label): `status:"requested"` and
`subStatus:"unsubscribed"` appear on **contact/message** records (contactMessage, userContact,
phone/email contacts) — `requested` = a contact request pending; `unsubscribed` = a comms opt-out.
✅ (csrApi.csv: `requested` at contactMessage L2188; `unsubscribed` on `type:"phone"/"email"` contacts L2280/L2334).

---

## 1. Term-by-term definitions (what BC actually means)

### `active` (order.status)
✅ Order is currently granting access. Set with `statusReason:"SuccessfulTx"` the moment a sale settles
(orderHistory L1208). **An order can be `active` AND `subStatus:"canceled"` at the same time** — see Cancelled.

### `inactive` (order.status)
✅ Order is NOT granting access. This is an **umbrella** — it does not, by itself, tell a CSR *why*.
The reason lives in `subStatus` + `statusReason`. **Displaying raw "Inactive" to a CSR is meaningless**
and is one of the complaints. Always resolve it to Expired / Cancelled / Refunded.

### `fulfilled` (PAYMENT.status — NOT an order status)
✅ A single transaction settled. Appears on `payments[].status` (sale L1798) and is the return of a
successful `refundVoidOrder` (L2131). **We currently show "fulfilled" in order/purchase status columns
(`OrdersPage`, `PurchasesPage`) as if it were the subscription state — that is a level-confusion bug.**
`fulfilled` answers "did the money move," never "what is this customer's plan."

### `expired` (order.subStatus) — ⚠️ OVERLOADED, the big one
✅ Marks an order no longer active. **BC stamps `subStatus:"expired"` on refunds too** — the refunded-order
lifecycle (L1177–1220) ends at `status:inactive, subStatus:expired, statusReason:"correct|refund"`.
So `expired` alone does **not** mean "subscription naturally lapsed." You MUST read `statusReason`:
- `subStatus:expired` + `statusReason:SuccessfulTx`/none → genuinely **Expired** (term ended)
- `subStatus:expired` + `statusReason:*refund*` → actually **Refunded** (display Refunded, not Expired)

⚠️ **Confirm with BC:** does `expired` also cover *involuntary* churn (a renewal charge that declined),
or only voluntary/term-end lapse? CSRs need to tell "customer let it lapse" from "we failed to bill them."
If BC collapses both into `expired`, that's a gap to raise.

### `canceled` (order.subStatus)
✅ The order was set to cancel. **Cancel does NOT immediately revoke access** — `cancelUncancelOrder(flag:true)`
returns the order still `status:"active"` (L1984). So:
- `status:active` + `subStatus:canceled` + `dueTimestamp` in future → **Cancelled — active until <date>** (cancel-at-period-end; they STILL have access). Showing a flat "Cancelled" here (implying no access) is wrong.
- `status:inactive` + `subStatus:canceled` → **Cancelled — ended** (access gone).
`cancelUncancelOrder(flag:false)` reactivates. (Spelling: BC uses one-l `canceled`; our code also checks `cancelled`.)

### `SuccessfulTx` (order.statusReason)
✅ Last state change was a successful transaction (the activating sale). Signals a real paid activation.

### `correct|refund` (order.statusReason)
✅ Last state change was a correction/refund (`refundVoidOrder`). The refund signal at the order level.
Pipe-delimited (`correct|refund`) — match on substring `refund`, not equality.

### `void` vs `refund` (payment.type) — ⚠️
✅ `refundVoidOrder` takes `commercePaymentType: 'refund'` (partial, returns money) or `'void'`
(voids the entire amount). ⚠️ Confirm whether a full **void** yields a different terminal order state or
CSR-displayed label than a partial **refund** (e.g. "Voided" vs "Refunded"; access implications).

---

## 2. Canonical CSR display states (the target vocabulary)

Resolve every order to exactly ONE of these, in this precedence order, from
`(order.status, order.subStatus, order.statusReason, schedule.dueTimestamp, payments[])`:

| CSR label | Condition | Has access now? |
|---|---|---|
| **Free** | no orders on the user | no (never bought) |
| **Payment failed** | order(s) exist, **no** `sale` payment with `status:fulfilled` | no |
| **Refunded** | order.status `inactive` AND (`statusReason` matches `refund` OR the order was fully voided) | no (revoked) |
| **Partial refund** ⚠️ | a `refund` payment settled but order.status is still `active` | **yes** — still active |
| **Cancelled — active until \<date\>** | `status:active` + `subStatus:canceled` + `dueTimestamp` > now | **yes**, until date |
| **Cancelled — ended** | `status:inactive` + `subStatus:canceled` | no |
| **Expired** | `status:inactive` + `subStatus:expired` + reason NOT refund | no |
| **Trial** | `status:active`, not canceled, within first cycle (collected < one recurring price) | yes |
| **Active (Subscriber)** | `status:active`, not canceled, past first cycle | yes |

Precedence rationale: Refunded must beat Expired (both carry `subStatus:expired`); Cancelled-active
must beat Expired/Active so CSR sees the pending cancel; Payment-failed beats everything (no money ever
settled) so a failed order never masquerades as Active/Trial. **Refunded is terminal only when
order.status went `inactive`** — a partial refund that left the order `active` is "Partial refund," not
a revoked "Refunded." **Trial vs Active(Subscriber) keys off settled `sale`-payment COUNT, not a
collected-vs-price comparison** (see §3 #7).

**Account axis stays separate:** `user.status` (Active / Suspended[=blocked]) is an independent chip —
a Suspended account can still hold an Active subscription and vice-versa. Do not merge the two axes.

---

## 3. Current-code gaps this spec corrects

1. ✅ **Raw "Inactive" renders as the badge label** on `OrdersPage.js` / `PurchasesPage.js`
   (`resolveStatus` returns raw `order.status`; the badge capitalizes anything it doesn't recognize →
   "Inactive"). So a **refunded, an expired, and a cancelled-ended order all show an identical flat
   "Inactive"** with no way to tell them apart — a prime driver of the CSR complaints (§1 `inactive`).
   (Note: `fulfilled` does NOT leak here — order.status is only active/inactive; that's a payment-level
   value. Earlier worry downgraded after verifying the code.)
2. Refunded orders can read as **Expired** wherever `subStatus:expired` is shown without checking
   `statusReason` (§1 `expired`). `userState.getPlanState` handles precedence; the flatter pages don't.
3. Flat **"Cancelled"** on a cancel-at-period-end order hides that the customer still has access (§1 `canceled`).
4. **`orderHistories` (BC's status-transition timeline) is plumbed end-to-end but rendered nowhere.**
   This is very likely "the order status system BC built to view." Surfacing it per order gives CSRs the
   authoritative history (who changed status, when, why) instead of our reconstructed event feed.
5. **Refund detection is too loose** (`orderIsRefunded`, `userState.js:55-63`): it returns true on
   `transient.amount.refunded > 0` or any settled refund payment — so a **$0.10 partial refund on a still-active
   annual sub would display as "Refunded / access revoked."** Terminal "Refunded" must require order.status
   to have gone `inactive` (§2), else it's a **Partial refund** and the sub is still active.
6. Trial detection uses a `< 10` magic-number fallback when the recurring price is unknown
   (`userState.js:82`) — replace with the real offer price from `getOrder` schedule.
7. 🔴 **Trial NEVER converts to Subscriber — for 100% of customers** (owner-confirmed 2026-07-21).
   `getPlanState` (`userState.js:79-83`) computes `stillTrial = collected < recurring`, where
   `collected = transient.amount.collected` (frozen at the FIRST/trial charge — renewals are booked as new
   payments/revisions and never accumulate into it) and `recurring = schedule.data.totalPrice.amount` (always
   the standard cycle price). So `collected < recurring` is **permanently true → every paying customer is
   stuck at "Trial," none ever reads "Subscriber."** Fix: derive Trial vs Subscriber from the **count of
   settled `sale` payments** (`commercePayments[].type==='sale' && status==='fulfilled'`): 1 = Trial,
   ≥2 = Subscriber (past first cycle). ⚠️ Or ask BC if a trial/first-cycle flag exists.

---

## 4. BC confirmations to request (don't guess)
- ⚠️ Does `subStatus:expired` distinguish **voluntary lapse** vs **failed-renewal (involuntary)** churn? If not, request a reason/flag.
- ⚠️ Does a **partial refund** leave order.status `active`, or move it `inactive`? (Determines Refunded vs Partial-refund; §2.)
- ⚠️ Is there a **trial/first-cycle flag** on the order, or must we count settled `sale` payments to know Trial vs Subscriber? (§3 #7.)
- ⚠️ Terminal state + CSR label for **void** vs partial **refund**.
- ⚠️ Full order-status enum + subStatus enum (docs show a sample, not an exhaustive list) — confirm no states beyond active/inactive × expired/canceled.
- ⚠️ Is there a dunning/grace/retry state between active and expired (the `PurchaseDetailPage` decline/velocity decoding implies retries exist)?
