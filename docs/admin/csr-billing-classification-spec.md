# CSR Billing Classification — legacy scheme to mirror (owner context 2026-07-22)

**Why:** the billing engine was **ported from the legacy business**, but our CSR status/plan labels were
NOT — they're a thin client-side re-derivation that CSRs find confusing and, critically, **don't tell a
rep what happens NEXT**. Owner got escalated on this. This doc captures the legacy scheme to mirror + the
new requirement (visualize upcoming expected events). Pairs with `docs/admin/order-status-definitions.md`
(BC's raw field vocabulary) — that's the *data*; this is the *classification + forecast* on top.

---

## 1. The legacy billing engine (sophistication we're mirroring the OUTPUT of)
The engine itself lives in BC (ported). CSR doesn't re-implement it — it must **read its state and
forecast its next move**. What the engine does (owner):
- **BIN-based risk gating** — scans card BIN#s for low payment-success propensity; blocks certain BINs
  from certain ads.
- **ISF trial grace** — a customer whose payment fails for **ISF** (insufficient funds) is still granted
  the trial, then a **cascade** of attempts tries to capture the initial billing.
- **Trial → subscriber conversion** — at **day 7**, convert the trial to a paid subscription; if the
  charge fails, **retry up to 10 times** before giving up.
- **Failure codes** — decline/failure reasons classified as **C1, D1, …** (C-series / D-series).

## 2. The classification scheme (S-codes) — mirror EXACTLY
Owner's definitions (confirm the full enumerated list — this is the seed):
- **S0** = **Trial** (in the 7-day trial window).
- **S1** = **Subscriber, month 1** (first successful monthly charge / first cycle billed).
- **S2** = **Subscriber, month 2** … **Sn** = subscriber at month *n*.
- **S{n}.{m}** = **retry attempt** *m* against the transition out of state *n*
  (e.g. **S0.1, S0.2, …** = retry attempts to convert the trial → subscriber;
  **S1.1, S1.2, …** = retry attempts on the month-1 → month-2 renewal). Up to **10** (`m ≤ 10`).
- **C1, D1, …** = failure/decline codes attached to a failed attempt.

Key property the labels MUST convey (the thing that's broken today): **each state implies a NEXT expected
event** — S0 → "converts on day 7"; S0.3 → "retry 4 of 10 on \<date\>"; S1 → "renews month 2 on \<date\>";
S1.5 → "retry 6 of 10, cancels after 10". A rep should read the code and know what happens next and when.

## 3. What the CSR must SHOW (three layers)
1. **Current S-code** (the mirrored classification), replacing/augmenting today's Free/Trial/Subscriber/…
2. **Billing event HISTORY** — the timeline of what happened (charges, declines w/ C/D codes, status
   transitions). BC's `orderHistories` + `commercePayments` are plumbed already (`csrFindOrderHistories`)
   but **rendered nowhere** — this is where they get surfaced.
3. **UPCOMING expected events (NEW / the headline ask)** — a forecast: next billing attempt + amount +
   date, which retry number we're on and how many remain, when the trial converts, when it cancels if
   retries exhaust. So a rep sets correct expectations on a call.

## 4. Mapping to BC data — what we likely have vs. need (to verify)
| Need | Candidate BC source | Status |
|---|---|---|
| Subscriber month N (S1/S2/…) | count of settled `sale` payments (`commercePayments[].type=sale,status=fulfilled`) | ✅ derivable (this is also the fix for the "Trial never converts" bug — do NOT use `transient.amount.collected`) |
| Trial (S0) | active order, 0 settled renewal charges, within first cycle | ✅ derivable |
| Billing event history | `orderHistories` (status transitions) + `commercePayments` (attempts) | ✅ plumbed, ⚠️ not rendered |
| **Retry attempt number (the `.m`)** | count of FAILED attempts since last success on this order | ⚠️ derivable IF BC returns failed attempts; **verify BC exposes them** |
| **Next scheduled attempt date** | `schedule.dueTimestamp` | ✅ have (next-charge date) — confirm it advances per-retry |
| **Max retries (10) + which attempt** | legacy rule (10) is OURS to encode; current attempt from history | ⚠️ **BC ask**: does BC expose the retry counter / schedule of the remaining cascade? |
| **Failure codes C1/D1** | `PurchaseDetailPage` already decodes `BC_DECLINE_LABELS` (velocity/subStatus) + `GATEWAY_CODE_LABELS` (ISO-8583) | ⚠️ map these to the legacy C/D taxonomy — confirm the crosswalk |
| Trial→sub timing (day 7) | order timestamp + trial period | ✅ derivable |

## 5. Open questions (BEFORE building)
**For owner (legacy doc):**
- The **complete S-code enumeration** + exact transition rules (what advances S0→S0.1→…→S1, and what
  moves S1→cancel). Is `.m` keyed to the state you're LEAVING (my read) or entering?
- The **full C/D failure-code list** and their meaning (C-series vs D-series distinction).
- The **retry cascade schedule** — the 10 attempts over what cadence (daily? backoff?)? Same for the ISF
  initial-billing cascade (how many, what spacing)?
- Does the CSR need to see the **BIN-risk / ad-block** disposition too, or just the subscription lifecycle?

**For BC (data exposure — likely a BC ask):**
- Does BC expose the **current retry attempt #** and the **remaining scheduled attempts** (dates/amounts)
  for an order in dunning, or only the single next `schedule.dueTimestamp`? Forecasting the cascade needs
  the schedule, not just the next tick.
- Are **failed** payment attempts returned in `commercePayments` (with decline code), or only settled ones?
- Is the retry/cascade logic **running inside BC** (so state is authoritative there), confirming CSR is
  read-only forecast, not a re-implementation?

## 6. Build shape (once unblocked) — proposed
- A `classifyBilling(order, payments, histories)` pure function → `{ sCode, label, nextEvent: {type, date,
  attempt, maxAttempts, amount} }`, replacing the ambiguous plan labels for CSR surfaces.
- Surface **orderHistories** as the event-history timeline (finally render the plumbed endpoint).
- A **"What happens next"** panel on the user/order detail: the forecast line + a small timeline of
  upcoming attempts.
- Reconcile against **BC's own admin order-status view** (owner getting us access) so our codes match.

See [[project_backlog]] HP-1 and `docs/admin/order-status-definitions.md`.
