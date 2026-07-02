# Customer State Model — one derivation, every surface

**Status: DRAFT for owner approval (2026-07-02).** Motivated by bug list 7/2 items 8–11:
refunded user shown "Active/Trial" in the CSR directory, "active (canceled)" order badges,
"Active + Expired" chip pairs, and a consumer billing tab that hides refunds. All four are
the same defect: **every surface derives customer state its own way.**

## 1. Two orthogonal dimensions (never mix them in one chip)

| Dimension | Source of truth | Values |
|---|---|---|
| **Account** | BC `user.status` | `active`, `blocked` (CSR suspend), `removed`, … |
| **Subscription** | BC orders (`getOrders` / CSR `user.getOrder`) | derived — see §2 |

"Active" today sometimes means the account, sometimes the subscription — that's the
ambiguity the tester flagged. Rule: **chip 1 = account, chip 2 = subscription**, visually
distinct (account chip only shown when NOT `active` — a normal account needs no badge).

## 2. Subscription state derivation (single shared function)

`deriveSubscriptionState(orders) → { state, sub }` — priority order:

1. **`none`** ("Free") — no orders, or `getUserOrders` 403 (BC's "no orders" answer).
   Includes payment-attempted-but-blocked users (order exists but no fulfilled sale payment
   → still `none`, optionally `sub: 'payment_failed'` for CSR display).
2. **`refunded`** — order carries a fulfilled `refund` payment ≥ collected. Terminal;
   beats everything below.
3. **`expired`** — subStatus canceled/inactive AND `dueTimestamp <= now`.
4. **`canceling`** ("Cancels <date>") — `subStatus === 'canceled'` AND `dueTimestamp > now`
   (cancel-at-period-end; access continues — see reference_cancel_at_period_end).
5. **`trial`** — active order, inside trial window (schedule seq0 price $1, first renewal
   not yet billed).
6. **`active`** ("Member") — active order past trial.

Consumer `isPaid` = state ∈ {trial, active, canceling}. (Matches today's narrow-paywall
semantics; no behavior change intended.)

## 3. Rendering rules

| Surface | Today | Rule |
|---|---|---|
| CSR directory Plan column | "Trial" shown for refunded user | render `deriveSubscriptionState` label; Status column = ACCOUNT status only |
| CSR profile chips | "Active + Expired" / "Active + Cancelled" side-by-side | subscription chip always; account chip only when not `active`. Non-applicable states not rendered (tester's "grey out" ask, solved by omission) |
| CSR order badge | "active (canceled)" | `canceling` → "Active — cancels Jul 6"; `refunded` → "Refunded"; `expired` → "Expired" |
| CSR Timeline | Refund appears only as CSR Note | emit a first-class `refund` timeline event (type + amount + who) |
| Consumer /account Subscription & Billing | refunded/expired shows "$1.00 Paid", no refund row | billing history renders refund rows (−$1.00 Refunded); subscription block shows the derived label; Cancel button always confirms, and shows success/failure feedback |

## 4. Implementation shape

- `src/services/customerState.js` — pure function + label/color maps, unit-tested against
  real BC order fixtures (trial, canceling, expired, refunded, blocked-sale, none).
- Consumer AuthContext `isPaid` + AccountPage consume it; CSR directory, profile,
  order-detail, timeline consume the same module (admin build imports the same file).
- **Non-goal:** no new stored flags anywhere — this stays a pure derivation from BC
  (feedback_subscription_state_authority).

## 5. Open questions for owner

1. Directory Plan column for never-paid users: one bucket ("Free") or split "Free" vs
   "Payment failed"? (CSR triage value vs. clutter.)
2. `refunded` + still-inside-paid-window: does a refund immediately revoke access
   (isPaid=false) — assumed YES — or honor the window?
3. Consumer copy for `canceling`: "Member until Jul 6" vs "Cancelled — access ends Jul 6".
