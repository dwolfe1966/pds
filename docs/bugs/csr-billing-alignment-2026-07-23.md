# Billing-status alignment: admin view ↔ CSR view — 2026-07-23

The admin billing tool and the CSR billing view are two surfaces of the **same system, one company**. The
admin view encodes the **current/established business logic**; the goal here is to have the CSR view reflect
that same logic. This is an internal reconciliation, not a comparison of two teams.

**Reference data:** `docs/bugs/csr-admin-user-billing-state-7-23.csv` — 72 users, admin-view trajectory + terminal, exported 2026-07-23.
**Deploy candidate:** `admin.315994c7.js` (NOT yet deployed).

---

## Executive summary

Across all **72 users**, the admin view reported **55 `[active]`** (of which **29** were mid-decline but
still active), **7 `[canceled (pending period end)]`**, **8 `[canceled→expired (voluntary)]`**, **2
`[expired (involuntary)]`**, and **0 `[suspended]`**. One difference remained between the current CSR logic
and the admin view: payment-error handling. The CSR logic had begun treating a hard decline (suspected fraud
/ stolen card) — and order-level "suspend" events — as **access-terminating**, so it would have shown **14**
hard-declined customers (all of which the admin view keeps `[active]`, including Asyus King and Esteven
Nordby) as **Inactive / no-access**. That was the only category where the access bucket itself differed; the
rest is vocabulary depth (the CSR's finer S-codes sitting beneath the admin view's 5 coarse terminals).

We updated the CSR logic so a payment error **never pauses access** — those customers now stay in their real
state (active/dunning) and instead surface a **non-blocking vCard warning** ("⚠ Recent transaction flagged —
{reason} · access not affected") that clears once a later charge succeeds; genuine deactivations (order not
active + `subStatus: suspended`) still read no-access. Validated on the live order data: the CSR view now
reflects the same access state as the admin view for **72/72 users (0 differences)**, with **14** warning
flags raised on the fraud/stolen cohort. Deploy `admin.315994c7.js` to make it live.

---

## 1. Admin-view terminal states (the current logic), across the 72

| Admin terminal | Count | Meaning | Has access? |
|---|---|---|---|
| `[active]` | 55 | order active (incl. 29 that are mid-decline / dunning but still active) | **Yes** |
| `[canceled→expired (voluntary)]` | 8 | user canceled, access period ended | No |
| `[canceled (pending period end)]` | 7 | user canceled, still inside paid period | **Yes** (until period end) |
| `[expired (involuntary)]` | 2 | ended without a voluntary cancel (e.g. refund/charge-off) | No |
| `[suspended]` | 0 | — none in this cohort | (No, when it occurs) |

Key fact of the current logic: **a fraud/decline customer stays `[active]`.** 29 of the 55 actives carry a
`D1.x` decline in their trajectory (including the ones flagged this week — kingasyus, esteven, christenbury)
yet remain `[active]` in the admin view. A payment error does **not** move the customer off `[active]`.

---

## 2. Initial differences (current CSR logic vs the admin view)

### DIFF-1 (primary — introduced earlier today, now aligned)
Earlier today a "terminal-stop" change had the CSR logic mark **fraud-declined / order-suspend customers as
Inactive / No-access** (kingasyus, esteven, christenbury). The admin view shows all three `[active]`.
- **Why it differed:** the CSR logic treated a `59:Suspected Fraud` decline — and an order-level "suspend"
  event — as access-terminating. The current logic does not: the decline is just a failed charge; the order
  stays active.
- **Impact:** every fraud/stolen-declined-but-active customer would read Inactive in the CSR view while the
  admin view read active → a systematic difference on the exact cohort under discussion.

### DIFF-2 (vocabulary depth — by design, reconciled via crosswalk below)
The CSR uses a finer S-code vocabulary (`trial-S0-paid`, `trial-D1.1`, `subscriber-S1-paid`, …) that sits
beneath the admin view's 5 coarse terminals. Both are correct; they just need to **map cleanly** so a CSR
reads the same status. The crosswalk in §4 defines that mapping; DIFF-1 was the only case where the *access
bucket* itself differed.

### Potential residual differences — to confirm with the live pull (§5)
The trajectory abstracts the underlying order fields, so these can only be confirmed per-user against real data:
- **canceled (pending) vs canceled→expired** — our split depends on `status==='active' + subStatus canceled + dueTimestamp>now`; must verify we don't collapse the two.
- **DM0 (cascade-validate) actives** — validate-only, `$0` captured; confirm we show them as active (has-access), not "unpaid/inactive".
- **refund → expired (involuntary)** — confirm refunded orders read no-access, not a lingering active.

---

## 3. Changes made (this session, in `admin.315994c7.js`)

1. **Removed the terminal-stop-on-fraud/suspend.** Access now follows the order status. A fraud-declined
   active order with a scheduled retry → **dunning (has access)**, matching BC.admin `[active]`.
2. **Added a non-blocking `problematicTransaction` warning.** When the most-recent sale is a hard decline
   (fraud / stolen / lost / pickup / revoked), the vCard shows **"⚠ Recent transaction flagged — {reason} ·
   access not affected."** It clears automatically once a later sale succeeds. It **never** changes
   access/classification — it's a CSR heads-up only (owner: *"note somewhere in the vCard that a recent
   transaction is problematic."*)
3. **Restored a genuine-deactivated-suspend branch.** Only when the order is **not active** *and*
   `subStatus === 'suspended'` do we read no-access — matching BC.admin's `[suspended]` terminal (0 in this
   cohort, but kept for correctness).
4. **UI:** the vCard warning and the Orders/Purchases badge now show a **⚠ warning**, not a 🚫 block.
5. **Tests realigned** (47/47): fraud decline → has-access + warning; warning clears on later success;
   genuine deactivated suspend → no-access.

---

## 4. Alignment crosswalk (CSR state → admin-view terminal)

| CSR classification / phase | Admin-view terminal | Access | Notes |
|---|---|---|---|
| `trial-S0-paid`, `trial-S0-unpaid`, `subscriber-S{n}-paid` (status active) | `[active]` | Yes | healthy |
| `trial-D{n}.{r}` / dunning (status active + retry) | `[active]` | Yes (at-risk) | **+ ⚠ flag if the decline was fraud/stolen** |
| `trial-S0-norenewal` / `subscriber-S{n}-norenewal` (cancel-at-period-end) | `[canceled (pending period end)]` | Yes | access until period end |
| `inactive` (canceled, access ended) | `[canceled→expired (voluntary)]` | No | |
| `inactive` (refunded / expired) | `[expired (involuntary)]` | No | |
| `order_suspended` (order not active + subStatus suspended) | `[suspended]` | No | none in this cohort |

After the §3 changes, the CSR access bucket reflects the admin view for every category. The S-code adds *detail beneath*
the admin terminal (which cycle, which retry, paid vs unpaid) without contradicting it.

---

## 5. Live per-user validation — DONE ✅ (2026-07-23, real BC data)

Pulled all 72 users' real orders from `admin.www.bytecrtrs.com` (read-only, `scripts/csr-billing-fetch.js`)
and ran the CSR classifier on the **same data** the admin view uses (`src/tests/csrBillingCompare.test.js`).

**Result: the CSR access bucket reflects the admin view for 72/72 users. Zero differences.** 14 problematic-transaction
warnings raised — all on admin=`[active]` customers (correctly staying active + flagged), incl. kingasyus &
esteven. Per-user detail: `docs/bugs/csr-billing-peruser-2026-07-23.md` (gitignored — customer PII).

**Admin-view terminal → CSR classification (live pairings):**

| Admin-view terminal | → CSR classification | count | aligned |
|---|---|---|---|
| `[active]` | `trial-S0-paid` | 18 | ✅ |
| `[active]` | `trial-D1.2` (dunning, retry 2) | 16 | ✅ |
| `[active]` | `trial-D1.1` (dunning, retry 1) | 13 | ✅ |
| `[active]` | `trial-S0-unpaid` (validate-only / cascade) | 8 | ✅ |
| `[canceled (pending period end)]` | `trial-S0-norenewal` | 7 | ✅ |
| `[canceled→expired (voluntary)]` | `inactive-voluntary` → "Inactive (voluntary)" | 8 | ✅ |
| `[expired (involuntary)]` | `inactive-involuntary` → "Inactive (involuntary)" | 2 | ✅ |

Every admin terminal maps to a consistent CSR state; our S-code adds detail *beneath* the admin terminal without
contradicting it. **Inactive now splits voluntary vs involuntary to mirror BC** (owner 2026-07-23):
a customer-initiated cancel (a `canceled` entry in the order history — even after the order later shows
`expired`) → **Inactive (voluntary)**; an expiry/refund/charge-off with no voluntary cancel → **Inactive
(involuntary)**. Verified live: 8/8 and 2/2 map exactly.

---

## 6. Open items
- **Deploy `admin.315994c7.js`** (the alignment isn't live until then).
- **Retry `maxAttempts`** still unconfirmed (5 vs 10) — cosmetic in the "D{n}.{r} of N" detail only.
