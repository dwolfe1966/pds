---
name: project_csr_billing_classification
description: CSR billing lifecycle classification — the S-code taxonomy, BC data mapping, files, and live-validated cases
metadata:
  type: project
---

Built 2026-07-22: a per-customer billing lifecycle classifier that mirrors the legacy S-code business rules across the whole CSR/admin app. Replaces the old confusing two-axis account-status + plan-badge.

**Core module:** `src/pages/admin/billingClassification.js` — `classifyBilling(order)` (per-order) + `getCustomerStatus(user, orders)` (customer rollup, folds account suspension). Spec/evidence: `docs/admin/csr-billing-classification-spec.md`; legacy defs (gitignored, local): `docs/legacy/` (KPI deck kpi1-3.jpeg + P&L CSV + PDS Data Dictionary).

**High-level classification (CEO-authoritative 2026-07-22, S for paid + D for declines):**
`trial-S0-paid` | `trial-S0-unpaid` | `trial-S0-norenewal` | `trial-D{n}.{x}` (in retry, still trial) |
`subscriber-S{n}-paid` | `subscriber-D{n}.{x}` (renewal declining) | `subscriber-S{n}-norenewal` | `inactive`.
Detailed `stateCode`: `S0-paid` / `S0-unpaid` / `S{n}-paid` (billed month n) / **`D{n}.{x} of {max}`** (declining cycle-n charge, retry x).

**Taxonomy rules (CEO — Hana Ang — is the legacy authority; supersedes earlier owner directions):**
- **S0** = trial (base identity — everyone who signed up; "no matter what they are still S0"). **S1/S2… = subscriber = a monthly charge SUCCEEDED** (S1 = billed month 1). Keep **S** for the paid ladder.
- **A retry is a DECLINE (`D{n}.{x}`), and the customer STAYS a trial (S0) until a bill SUCCEEDS** — they are NOT a subscriber while retrying. (This REVERSED the earlier "assume S1 while retrying" call.) `D1.x` = first monthly charge failing; `D2.x` = a subscriber's month-2 renewal failing (bucket=subscriber then, since they cleared S1). `.x` = `schedule.data.retry`.
- **-norenewal** = has access but cancelled/won't renew; **inactive** = no access.
- **NO retry model for S0** — we do NOT retry the $1 trial. If the $1 fails (ISF) we still let them in; at ~day 7 we attempt the full $49 (multiple times) = the D1.x retries.
- **suspended** = fraud OR retries exhausted (~5 tries → no access until they bill). ⚠️ maxAttempts: CEO says ~5, deck said 10 — set to **5**, CONFIRM.
- **Never-captured ($0 ever collected)** is a distinct beast from a happy-path unpaid: same code but risk = **High/red** + a "⚠ Never captured — $0 collected" note (happy-path = Medium/yellow).
- **Decline type drives behavior**: `51:ISF` → BC RETRIES (dunning, S1-unpaid.x). `59:Suspected Fraud` → BC SUSPENDS/stops (order subStatus `suspended`, no schedule) → "Fraud stop" (noted distinctly).

**BC data mapping (verified live — see [[bytecrtrs_api_reference]]):**
- `order.schedule.data.sequence` = next charge's sequence; `schedule.data.retry` = **authoritative retry counter** (NOT `transient.sequenced.retry`, which read 0 on godwill); `schedule.dueTimestamp` + `data.totalPrice.amount` = next event.
- Trial books as `commercePayments[] {type:'sale', status:'fulfilled', sequence:0}`. Failed attempts ARE stored as `{type:'sale', status:'rejected', sequence:N, retry:M}` with `requestResult.primaryCodeMessage` decline (e.g. "51:Insufficient Funds"). A `$0 type:'validate'` = card auth, NOT a capture.
- Card type (cpd) DEFINITIVE at `commerceTokens[0].transient.bin.extra.cpd` ∈ {credit,prepaid,debit}. Prepaid/debit = low propensity.
- Live prices in `commercePriceRules` (`_DESC_` "S0"/"S1+"): S0 $1/7d → S1+ $49.98/30d. READ live, NEVER hardcode (deck's $1/$39.97 are stale legacy).
- `maxAttempts` = 10 (KPI deck; `RETRY_RULES.maxAttempts` — ⚠ OWNER-UNCONFIRMED, only open item).

**Live-validated customers (2026-07-22):** Cassie=trial-S0-paid; godwill/lacanda12=subscriber-S1.2-unpaid (ISF); 7213veenme=never-captured (S1-unpaid or S0-unpaid, High risk, $0); christenbury=inactive/Fraud-stop (59); Tera=trial-S0-norenewal (cancelled trial). rakim/amyjo/moninoso = S0-failed cluster.

**Surfaces (all one vocabulary):** Users list badge (`UsersPage` PlanBadge→classification), user-detail vCard (headline classification pill + Access/State/Risk/Event/Next grid + notes: fraud/never-captured/no-renewal), Orders&Payments tab (decluttered: summary rectangle + consolidated `BillingEventsTable` — When·Charge·Outcome·Notes, actionable orders link to `/purchases/:id`), Purchases/Orders lists (`OrderBillingBadge`), `PurchaseDetailPage` (`BillingLifecyclePanel`). Components: `BillingLifecyclePanel.js`, `BillingEventsTable.js`, `OrderBillingBadge.js`.

**Deploy candidate: admin bundle `admin.14ee842c.js`** (NOT on BC). 417 tests (`src/tests/billingClassification.test.js`). See [[project_backlog]] HP-1.
