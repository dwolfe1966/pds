# What's NOT addressed — open items after live UAT (2026-06-02)

Synthesis of the full live test pass (anonymous + authenticated member + CSR, real browser). Companion to `test-log-6-2.csv`. "Addressed/verified" items are omitted — this lists only what is **open, broken, deferred, blocked, or BC-owned.**

---

## 1. Broken / regressed — confirmed live (front-end, actionable now)

| Bug | State | Evidence |
|---|---|---|
| **#50** | ❌ BROKEN | Reactivation re-purchase with a valid test Visa → **"Payment declined: nonMemberOnlyCommerceOffer."** Original bug reproduced. |
| **#57** | ❌ BROKEN | After cancel, member account shows "You do not have an active subscription" + "Upgrade to Pro" — **no Reactivate button**. |
| **#59** | ⚠️ INCONSISTENT | Post-cancel: dashboard keeps reports + search, but the Account tile says "no active subscription." Cancel lightbox promised period-end access. |
| **CSR cancel-at-period-end** (NEW) | ❌ BROKEN | `PurchaseDetailPage` reads `order.transient.canceled` to choose Cancel vs Reactivate, but BC sets `order.subStatus === 'canceled'`. So an order that is `status=active, subStatus=canceled` shows **"Cancel Order"** instead of **"Reactivate Order"** — a CSR can't reactivate it from the UI. |

**Root pattern:** the cancel-at-period-end state (status active + subStatus canceled) is mis-handled in three places — consumer account tile (#57), consumer access logic display (#59), and CSR order detail. All check the wrong field. This is the same class as the consumer `refreshSubscription` work and ties directly to **#74**.

> test21 was left cancelled by this flow and could NOT be restored via either UI (consumer #50 blocks; CSR button bug). Restored out-of-band by calling the reactivate API directly (`api.user.cancelUncancelOrder({orderId, flag:false})`), which returned `success:true` and cleared the sub-status. Consumer account now shows ACTIVE.

## 2. Open — minor front-end

| Bug | State |
|---|---|
| **#79** | Dashboard "run a new search" state field is a text input (placeholder "ST", maxlen 2), not a dropdown. (The `/people-search` page *does* use a dropdown.) |
| **#69** | Member SRP "X of Y" count grows on Load More instead of showing the true total up front. |

## 3. Deferred by design (product calls — not gaps)

#34 (SUP checkbox per shN), #35 (compliance CTA copy), #42 (remove Address search), #51 (thin-match flow), #23c (city typeahead), #53 (red-border-by-default).

## 4. Could NOT verify — blocked by BC "Input Password" captcha

Every **new search** (anonymous **and** authenticated member) is gated by BC's captcha modal on the dev host, so the SRP/results never render to an automated session:
- **#3, #5, #10, #11, #15** (anon SRP behaviors), **#43, #69** (member search).

Code for these is present in the bundle; behavior is just not observable without the captcha password. NOTE: confirm whether this "Input Password" gate is **dev-only** — if it appears for real end users in production, it's a launch blocker in itself.

## 5. BC / API-dev owned (not front-end)

| Bug | Note |
|---|---|
| **#74** | **Critical.** Does cancel stop the renewal charge? Order stays `status=active` after cancel. Confirm before any cohort renews. |
| **#73** | CSR fresh-signup "forbidden resource" on Customers/Orders. NOT reproduced for an established admin — specific to newly-provisioned CSRs. |
| **#21 / #75** | Welcome email not sent on signup. |
| **#66** | Trial length: observed `$1` on 5/23 → renewal 6/22 = **~30 days** vs 7-day checkout copy. Confirm dueTimestamp. |
| **#41 / #44 / #45** | Report depth (name vs phone), report↔PDF parity, PDF "fictional data" disclaimer — bounded by BC report data. |
| **#63 / #64 / #65 / #72** | Event logging (visitor LP, failed search/signup, cancel lightbox) not wired to the events API. |
| **#76** | Card type / BIN metadata location. |
| **#77 / #78** | shN/shL/shM attribution mapping + queryability; $1-fail→passthru attribution. The big reporting block. |

## 6. Fixed this session (for completeness)

#67 broken/double logo (was live-broken on the public header; inlined data-URI fix, verified by re-render). #61/#62 admin deep-links (verified live). All authenticated member happy-path items (#18/#39/#41/#44/#46/#47/#49/#58/#71) verified live. CSR #60 customer search, user-detail tabs, Notes & Messages tab verified live.

---

## Recommended priorities before launch

1. **Fix the cancel-at-period-end cluster (#50/#57/#59 + CSR order button).** A member who cancels cannot self-service reactivate, and a CSR can't reactivate from the order page. High user-trust impact. All three are the same wrong-field check.
2. **Confirm the BC captcha is dev-only** (§4) — if it gates real-user searches in prod, nothing else matters.
3. **Get a definitive BC answer on #74** (renewal charge after cancel).
4. Small front-end: #79 dropdown, #69 count.
