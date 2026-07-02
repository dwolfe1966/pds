# CSR/Consumer bug list 2026-07-02 — status

Source: `CSR_bugs_7_2_2026.csv` (15 items, screenshots reviewed). Framing insight that
drove prioritization: most "free members" are **failed or abandoned checkouts** — the
freemium experience is the recovery net for users who already tried to pay.

**Deploy state: NOTHING below is deployed yet.** Consumer bundle `public.eab2378a.js` +
admin bundle `admin.02517706.js` are built and ready; owner uploads to the VPS. (These
also carry the 7/1 inmate A/B + funnel theming work.)

---

## ✅ DONE (in code, committed, tests green — 353/353)

| # | Item | Fix | Commit |
|---|---|---|---|
| 3 | Free member → search result → "Create Your Account" (duplicate-account funnel) | SUP teaser is auth-aware: free member → "Unlock with Membership" → `/payment?upgrade=1` with the person carried through; paid member with failed report-create → recovery CTA | `c7c60f8` |
| 4 | Free phone search dead-ends in fake system error | Free members route to phone **teaser results** (`/people-results?phone=…`); upsell happens on result click; paid keep direct-to-report | `c7c60f8` |
| 5 | Payment declined shows raw BC regex spew (name had `#`) | BC name charset enforced client-side (2–50, letters/digits/space/'/-); regex-spew + technical strings never reach the UI | `5ed93d9` |
| 6 | After failed attempts, correct info still fails (bare 406) | 406 mapped to human wait-and-retry message + support number. (Underlying BC block: see ASK F) | `5ed93d9` |
| — | Alerts page conversion copy (tester suggestion) | Benefit bullets: address change / new phone / new infraction / who's-searching | `5ed93d9` |
| 1 | Free member can't add phone — "Forbidden resource" | UX: 403 now shows an actionable sign-out/sign-in message + tracking. Root cause is BC-side (see CAN'T section + ASK G) | `5ed93d9` |
| 8 | Refunded user shows Active/Trial in CSR directory | `refunded` state in the plan ladder + plan cache invalidated after refund/cancel | `f38651f` |
| 9 | "active (canceled)" order badge ambiguous | Badge says what happens: "Active — cancels Jul 6" / "Refunded" / "Inactive — expired" | `f38651f` |
| 10 | "Active + Expired" chips; refund not in Timeline | Account chip only when suspended (no contradictions); Timeline detects refunds by payment TYPE (BC: type=refund + status=fulfilled), blocked attempts read "Payment failed" | `f38651f` |
| 11 | Consumer /account hides refund/expired; Cancel silent | Refund row synthesized when BC omits commercePayments; "why no subscription" copy (refunded/expired); cancel/reactivate confirm with success message | `f38651f` |
| 12 | Request Billing Action email greyed + empty | Editable when the order carries no email; read-only when prefilled | `f38651f` |
| — | New CSR states | "Payment failed" split from "Free" (owner decision) — directory filter picks both up automatically | `f38651f` |

## 🚫 CAN'T BE DONE (client-side) — BC-blocked, asks filed

All registered in `docs/BC_CSR_ASKS_PACKAGE.md` (drafts ready, NOT yet sent to Kwan):

| Item | Why blocked | Ask |
|---|---|---|
| 13 · Voicemail transcription + caller ID | BC's telephony pipeline sends only a stamp + `.aac`; no ANI, no transcript anywhere in the payload | **ASK E** |
| 6 · 406 block semantics | BC velocity/fraud gate is server-side; trigger/duration/reset/CSR-unblock undocumented; error body indistinguishable from the sequenceOption 406 | **ASK F** |
| 1 · Free-member profile save 403 root cause | `user.update` rejects never-paid members (synthetic pre-sale sessions / BC user created by failed sale); owner requirement: free members must be able to edit their profile | **ASK G** |
| 14 · CSR profile city/state | BC user object carries no address fields; we only collect ZIP at payment | **ASK H** |
| 2 (partial) · Real continuous alerts | Alerts monitoring/delivery is BC-blocked (4 asks already in BC_CONSUMER_FEATURE_ASKS.md); page ships as one-time search + benefits copy meanwhile | existing |
| Refund access window | Owner: refund keeps access until period end — but BC marks the order `inactive/expired` at refund time, so BC enforcement may cut access early regardless of our display | flag to BC if guarantee wanted |

## ⏳ REMAINING (ours, not started)

1. **`IwS84bJ` repro** — incognito "payment submitted but couldn't confirm subscription."
   The one ambiguous-charge scenario; wants a careful repro before any code change.
   (Dev captcha outage currently blocks funnel E2E on dev.)
2. **Send the BC asks batch** (E–H drafts ready; batch with the open A/B/C asks) — owner call on timing.
3. **Live UAT after deploy** — the state-model changes are unit-tested against recorded
   BC shapes; the CSR pages should be eyeballed against the refunded user
   (`6a44…f567`/Mark Temple) and the blocked-payments user (`6a45…3c22`/Jim Galloway) on prod.
4. **Free-member phone teaser live check** — confirm BC accepts `sale.phone.teaser` for a
   logged-in-free session (works anonymous; expected fine, unverifiable while dev captcha is down).
5. (Nice-to-have) zip→state fallback display on CSR profile until ASK H lands.
6. (Deferred design question) whether "Payment failed" users deserve a dedicated CSR
   view/queue — they're the highest-intent recovery cohort.
