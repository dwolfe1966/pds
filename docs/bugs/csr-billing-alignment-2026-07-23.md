# CSR ↔ BC.admin billing-status alignment — 2026-07-23

**Goal (owner):** *duplicate BC.admin's user billing status in our CSR.* BC.admin is the reference.
**Source of truth:** `docs/bugs/csr-admin-user-billing-state-7-23.csv` — 72 users, BC.admin trajectory + terminal, exported 2026-07-23.
**Deploy candidate:** `admin.124128dd.js` (NOT yet on BC).

---

## Executive summary

Across all **72 users**, BC.admin reported **55 `[active]`** (of which **29** were mid-decline but still
active), **7 `[canceled (pending period end)]`**, **8 `[canceled→expired (voluntary)]`**, **2 `[expired
(involuntary)]`**, and **0 `[suspended]`**. The one place our CSR diverged from BC.admin was payment-error
handling: our classifier had begun treating a hard decline (suspected fraud / stolen card) — and order-level
"suspend" events — as **access-terminating**, so it would have shown **14** hard-declined customers (all of
which BC.admin keeps `[active]`, including Asyus King and Esteven Nordby) as **Inactive / no-access**. That
was the only category where the access bucket itself disagreed; the rest was vocabulary (our finer S-codes
vs BC's 5 coarse terminals).

We changed the classifier so a payment error **never pauses access** — those customers now stay in their
real BC state (active/dunning) and instead surface a **non-blocking vCard warning** ("⚠ Recent transaction
flagged — {reason} · access not affected") that clears once a later charge succeeds; genuine BC
deactivations (order not active + `subStatus: suspended`) still read no-access. Validated on the live order
data: our CSR now matches BC.admin's access state for **72/72 users (0 mismatches)**, with **14** warning
flags raised on the fraud/stolen cohort. Deploy `admin.124128dd.js` to make it live.

---

## 1. BC.admin terminal states (the reference), across the 72

| BC.admin terminal | Count | Meaning | Has access? |
|---|---|---|---|
| `[active]` | 55 | order active (incl. 29 that are mid-decline / dunning but still active) | **Yes** |
| `[canceled→expired (voluntary)]` | 8 | user canceled, access period ended | No |
| `[canceled (pending period end)]` | 7 | user canceled, still inside paid period | **Yes** (until period end) |
| `[expired (involuntary)]` | 2 | ended without a voluntary cancel (e.g. refund/charge-off) | No |
| `[suspended]` | 0 | — none in this cohort | (No, when it occurs) |

Key fact: **BC keeps a fraud/decline customer `[active]`.** 29 of the 55 actives carry a `D1.x` decline in
their trajectory (including the ones flagged this week — kingasyus, esteven, christenbury) yet BC.admin
still classifies them `[active]`. A payment error does **not** move BC off `[active]`.

---

## 2. Initial differences (our CSR vs BC.admin)

### DIFF-1 (primary — self-inflicted earlier today, now fixed)
Earlier today a "terminal-stop" change made our CSR mark **fraud-declined / order-suspend customers as
Inactive / No-access** (kingasyus, esteven, christenbury). **BC.admin shows all three `[active]`.**
- **Why it differed:** we treated a `59:Suspected Fraud` decline — and an order-level "suspend" event —
  as access-terminating. BC does not: the decline is just a failed charge; the order stays active.
- **Impact:** every fraud/stolen-declined-but-active customer would read Inactive in our CSR while BC.admin
  read active → a systematic mismatch on the exact cohort under discussion.

### DIFF-2 (vocabulary — by design, reconciled via crosswalk below)
Our CSR uses a finer S-code vocabulary (`trial-S0-paid`, `trial-D1.1`, `subscriber-S1-paid`, …) where
BC.admin uses 5 coarse terminals. These are not "wrong," but they must **map cleanly** onto BC's 5 states
so a CSR reads the same status. The crosswalk in §4 defines that mapping; §2 DIFF-1 was the only case where
the *access bucket* itself disagreed.

### Potential residual differences — to confirm with the live pull (§5)
The trajectory abstracts the underlying order fields, so these can only be confirmed per-user against real data:
- **canceled (pending) vs canceled→expired** — our split depends on `status==='active' + subStatus canceled + dueTimestamp>now`; must verify we don't collapse the two.
- **DM0 (cascade-validate) actives** — validate-only, `$0` captured; confirm we show them as active (has-access), not "unpaid/inactive".
- **refund → expired (involuntary)** — confirm refunded orders read no-access, not a lingering active.

---

## 3. Changes made (this session, in `admin.124128dd.js`)

1. **Removed the terminal-stop-on-fraud/suspend.** Access now follows BC's order status. A fraud-declined
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

## 4. Alignment crosswalk (our CSR state → BC.admin terminal)

| Our classification / phase | BC.admin terminal | Access | Notes |
|---|---|---|---|
| `trial-S0-paid`, `trial-S0-unpaid`, `subscriber-S{n}-paid` (status active) | `[active]` | Yes | healthy |
| `trial-D{n}.{r}` / dunning (status active + retry) | `[active]` | Yes (at-risk) | **+ ⚠ flag if the decline was fraud/stolen** |
| `trial-S0-norenewal` / `subscriber-S{n}-norenewal` (cancel-at-period-end) | `[canceled (pending period end)]` | Yes | access until period end |
| `inactive` (canceled, access ended) | `[canceled→expired (voluntary)]` | No | |
| `inactive` (refunded / expired) | `[expired (involuntary)]` | No | |
| `order_suspended` (order not active + subStatus suspended) | `[suspended]` | No | none in this cohort |

After the §3 changes, our access bucket matches BC.admin for every category. The S-code adds *detail beneath*
BC's terminal (which cycle, which retry, paid vs unpaid) without contradicting it.

---

## 5. Live per-user validation — DONE ✅ (2026-07-23, real BC data)

Pulled all 72 users' real orders from `admin.www.bytecrtrs.com` (read-only, `scripts/csr-billing-fetch.js`)
and ran **our** classifier on the **same data** BC.admin used (`src/tests/csrBillingCompare.test.js`).

**Result: access bucket matches BC.admin for 72/72 users. Zero mismatches.** 14 problematic-transaction
warnings raised — all on BC=`[active]` customers (correctly staying active + flagged), incl. kingasyus &
esteven. Per-user detail: `docs/bugs/csr-billing-peruser-2026-07-23.md` (gitignored — customer PII).

**BC.admin terminal → our classification (live pairings):**

| BC.admin terminal | → our classification | count | access match |
|---|---|---|---|
| `[active]` | `trial-S0-paid` | 18 | ✅ |
| `[active]` | `trial-D1.2` (dunning, retry 2) | 16 | ✅ |
| `[active]` | `trial-D1.1` (dunning, retry 1) | 13 | ✅ |
| `[active]` | `trial-S0-unpaid` (validate-only / cascade) | 8 | ✅ |
| `[canceled (pending period end)]` | `trial-S0-norenewal` | 7 | ✅ |
| `[canceled→expired (voluntary)]` | `inactive` | 8 | ✅ |
| `[expired (involuntary)]` | `inactive` | 2 | ✅ |

Every BC terminal maps to a consistent CSR state; our S-code adds detail *beneath* BC's terminal without
contradicting it. **The only intentional collapse:** BC's two no-access terminals (`canceled→expired` and
`expired`) both map to our single **`inactive`** — that's the owner's chosen taxonomy (2026-07-22), not a
defect; the phase/`stateName` still carries the finer reason (Cancelled vs Expired) if we ever want to split.

---

## 6. Open items
- **Deploy `admin.124128dd.js`** to BC (the alignment isn't live until then).
- **Retry `maxAttempts`** still unconfirmed (5 vs 10) — cosmetic in the "D{n}.{r} of N" detail only.
