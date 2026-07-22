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

## 1b. ✅ AUTHORITATIVE DEFINITIONS (legacy KPI deck + master P&L CSV, received 2026-07-22)
Source: `docs/legacy/kpi1.jpeg` (Customer Lifecycle Terminology), `kpi2.jpeg` (Business KPIs),
`kpi3.jpeg` (lifecycle state-machine diagram), `Copy of Mocked up KPI - C W.csv` (weekly master P&L by
partner). These ARE the definitions — no longer guessed.

**Lifecycle state machine (kpi3):** `Sale → Trial Period → Membership → Cancel`
`Ads → Clicks → Signup(S0) → 5-day trial → 1st Bill(S1) → 2nd Bill(S2) → S3+ → Cancel Membership →
Remaining Membership (still has access) → Expired (no access)`

**Terminology (kpi1):**
- **S0** = a **signup/conversion** — card + trial fee (typically 5-day / $1.00). User becomes a member.
- **S1.0** = stayed through trial → **first month charged** ($39.97, billed **in advance**).
- **S1.x** = **retry sequence on a failed S1.0**: `S1.1` = 1st retry, `S1.2` = 2nd, … `S1.x` = all retries;
  after retries exhaust the **system auto-cancels** the member. (Generalizes to `Sn.m` = retry *m* on the
  month-*n* bill — kpi3 shows the retry box for the $39.97 first bill; the CSV carries S1.x…S9.x.)
- **C0** = customer cancels **within day 1** (poor first impression signal).
- **C1** = customer cancels **before the first monthly charge is attempted**.
- **Decline** = member through trial, but the monthly billing attempt **fails** (ISF / issuer decline).
- **Identity:** **`S0 = S1.0 + C0 + C1 + Declines`** (every trial resolves into exactly one of these).

**Business KPIs (kpi2):** Sales=S0 · CPA=cost per S0 · **LTV/GSR**=gross subscription revenue ($1 trial +
$39.97/mo) · **Retention**=% of trial members still paying each month (S1.0 + S1.x predict cohort revenue) ·
Cancels · Refunds/Chargebacks (CS request OR bank chargeback).

**Master P&L CSV** = weekly time-series **by Partner** (Campaign Group). Metric rows enumerate the
taxonomy: `S0#`, `S1.0%`, `S1.x%`, `S2.x%`…`S9.x%` (retention by cycle), `C0+C1%`, `casD%`, `cpd-C/P/D%`,
`3ds%`, and financials (GSR, CPA, eCPA, EBITDA, Contribution Margin, Var Costs). Validation oracle for
aggregate rollups.

## 1c. ✅ DEFINITIVE DATA DICTIONARY (legacy CEO, `docs/legacy/data-dictionary.csv`, 2026-07-22) — CORRECTIONS
This supersedes any inference above where they differ. Key definitions (with two I had **wrong**):
- 🔴 **`cpd-C / cpd-P / cpd-D` = CARD TYPE, not failure codes** — **C**redit / **P**repaid / **D**ebit
  (`data.cpd ∈ {credit,prepaid,debit} ÷ M0#`). This is the **payment-propensity** dimension (prepaid/debit
  convert worse) — the read side of the BIN-risk gating. **Surface per-customer** (owner 2026-07-22).
- 🔴 **`casD` = cascade rate** — payment routed through the card **cascade (retry across processors)**,
  `transactionMeta.cascade==true`. **`CasA`** = cascade-approve (imputed). **`eCPA` = CPA×(1−casD−casA)**.
  This is PROCESSOR cascade — distinct from the `Sn.x` *billing-retry* cascade (do not conflate).
- **`C0` / `C1`** = early cancels — C0 = same period (day-1), C1 = first period (pre-first-charge).
  **Surface per-customer** (owner 2026-07-22).
- **M-notation = cohort/aggregate grain** (parallel to the deck's per-customer S-notation): **M0** = paid
  members acquired that week (first payment); **M1.0%** = made first recurring bill (survived trial → cycle
  1); **M1.x%…M9.x%** = retention curve, cohort still paying in cycle 1..9 (matured cohorts only).
  `Sn` (customer sequence) ↔ `Mn` (cohort cycle) — same lifecycle, two grains.
- **Unit economics:** `GSR/member = trial_fee + price × Σ(M1..M24 retention)`; `CM$/member = GSR − VarCosts
  − eCPA`; `Contr Mgn% = CM$ ÷ GSR`; `CPA Target = GSR×(1−target margin) − VarCosts`.
- **Funnel metrics** (site→signup→paid) are defined too (Visitors, Search%, CAPTCHA pass%, SRP View%,
  Report Select%, Thin Match%, SUP PII/Billing/Attempt/CVR%, M0 records vs thin) — the ACQUISITION grain,
  keyed on OUR events (landing_view, result_click, signup_complete, payment_start/paid). Relevant to
  task (ii)/(iii), not the per-customer CSR view.

⚠️ **Prices are LEGACY** (owner 2026-07-22): the `$1 trial / $39.97` figures are historical. **Read the
live price + period from BC `commercePriceRules` (`_DESC_` S0 / S1+) at runtime — never hardcode.**

**Three grains, one taxonomy:** (a) **per-customer** CSR view (THIS build) = current `S{seq}.{retry}` +
next expected event + history + C0/C1 + cpd card-type; (b) **cohort retention** (C W, M-notation); (c)
**acquisition funnel** (site→paid). CSR build = (a); (b)/(c) inform KPI dashboards (task ii/iii).

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

## 3b. ✅ JSON INTERROGATION (2026-07-22) — BC already speaks S-codes
Interrogated the BC API doc example responses (no live prod probe — see gap below). **The owner's
intuition is confirmed: BC's billing response encodes the classification + rules natively.**

- **BC uses the S-code labels itself.** `commercePriceRules[]._DESC_` literally reads **`"S0"`** and
  **`"S1+"`** (csrApi/Api example responses), each with `conditions: [{ sequence: 0 }]` / `{ sequence:
  "v > 0" }` and `candidates[].id.{ amount, period }`:
  - **S0** → `sequence: 0` → $1.01 / **7 d** (the trial)
  - **S1+** → `sequence: "v > 0"` → $39.01 / **30 d** (the subscription)
  (Doc sample only shows S0 + S1+; the LIVE response likely carries the finer S1/S2/… + retry variants.)
- **The live S-code coordinates are in `order.schedule.data`:**
  - `schedule.data.sequence` = the **S-number** (0 = S0/trial, N = S{N})
  - `schedule.data.retry` = the **`.m`** retry attempt
  - `schedule.dueTimestamp` = **when the next event fires**
  - `schedule.data.totalPrice.amount` = **next charge amount**
  - `schedule.type: "commerceBillingRecur"`, `eventKey: CommerceBillingRecurScheduleEvent`
- **Retry config** on the order + each payment: `immediateRetry`, `immediateRetryCount`.
- **Per-attempt history:** `commercePayments[]` (each has `retry`, `commerceBillingRouting.billingSeriesId`
  = `sale|…` / `correct|…`, decline info) + `orderHistories[]` (status transitions).
- **Cascade/decline code vocabulary** (HowTo.csv): `processorDown, verifyRetry, dropCvv, dropCvvWFlag,
  quadzero, superbad, autoExpire, declinerPassthru, declinerRetry, prepaidDecliner, gatewayPassthru,
  gatewayConfigError, ineligible` — the source taxonomy the legacy **C/D** codes map onto.

**⚠️ The one thing the DOCS can't settle:** the sample `schedule` is a **single next event**, not an array
of all 10 future retries. So from docs alone I can't confirm "ALL future events pre-mapped" vs. "next
event, recomputed per attempt (dynamic)." **Resolve by capturing a REAL response** — owner pull a live
`findOrders`/`getOrder` JSON for an actual trial customer (CSR read, safe) and paste it; that shows the
true production shape (finer S-labels + whether the full cascade schedule is listed).

## 4. Mapping to BC data — CONFIRMED (was: to verify)
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
