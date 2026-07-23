# CSR ↔ BC.admin billing-status alignment — 2026-07-23

**Goal (owner):** *duplicate BC.admin's user billing status in our CSR.* BC.admin is the reference.
**Source of truth:** `docs/bugs/csr-admin-user-billing-state-7-23.csv` — 72 users, BC.admin trajectory + terminal, exported 2026-07-23.
**Deploy candidate:** `admin.124128dd.js` (NOT yet on BC). **Live per-user validation:** probe `scripts/csr-billing-fetch.js` ready — runs the moment BC creds land in `docs/BC_CREDS.local.md` (gitignored).

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

## 5. Live per-user validation (pending BC creds)

`scripts/csr-billing-fetch.js` (read-only) logs into `admin.www.bytecrtrs.com`, pulls each of the 72 users'
real orders + histories, and dumps them so we run **our** `classifyBilling` on the **same data** BC.admin
used. That produces a definitive per-user diff (our state vs BC terminal) and confirms the §2 residuals.

**To run:** put CSR creds in `docs/BC_CREDS.local.md` (gitignored), then
`node scripts/csr-billing-fetch.js` → `scripts/out/csr-orders-72.json` → per-user comparison appended here.

---

## 6. Open items
- **Deploy `admin.124128dd.js`** to BC (the alignment isn't live until then).
- **Retry `maxAttempts`** still unconfirmed (5 vs 10) — cosmetic in the "D{n}.{r} of N" detail only.
