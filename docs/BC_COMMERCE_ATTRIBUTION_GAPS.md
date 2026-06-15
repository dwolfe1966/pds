# BC ask — Close the two commerce-attribution gaps (gclid on order, partner shape for 6a22ff83)

**Raised:** 2026-06-15
**For:** Kwan Park (BC) — coordinate with David (idlookup.ai client)
**Bug refs:** extends #10 (refer-level attribution) — the order-grain `refer` now persists; these are the two remaining gaps a live test exposed.
**Live test that exposed it:**
`https://dev.www.idlookup.ai/?shn=6a22ff83ca16ad4ef68b84b5&gclid=CjwK…&utm_source=google&utm_medium=cpc&utm_campaign=inmates-upper&utm_term=find+an+inmate&refer_partnerId=google&refer_afid=g-inmates-upper&refer_abc=ag6813043751`

## What's already working (the win)
`refer_*` now rides landing URL → `trackings.data.refer` → the `billing.sale`
`queryString` → **`commerceorders.refer`**: first non-empty `refer` on a billable
order (`{partnerId:'google', afid:'g-inmates-upper', abc:'ag6813043751'}`). Core
#10 refer-level ask is working. Built client-side via
`trackingService.buildReferQueryString()` → `PaymentPage.js` sale params.

---

## Gap 1 — gclid is not on the billable record (need BC to confirm/extend queryString parsing)

**Symptom (from DB scan):** `gclid` is captured on every clickstream tracking
(`signup_complete`, `payment_start`, `payment_complete`, payer-linked) but is on
**neither the order nor the payment**. So the Google click-join key (§M6 eCPA at
click grain) isn't on the billable record — only on the tracking store.

**Client side — DONE (ready to deploy):** `buildReferQueryString()` now also emits
`gclid`, `fbclid`, `msclkid`, and `utm_source/medium/campaign/term` into the
`billing.sale` `queryString` (alongside the `refer_*` keys that already round-trip).
Bundle `public.ed680352.js` (build clean; deploy pending).

**What we need from BC — pick one and confirm:**
1. **Does order-creation parse arbitrary `queryString` keys into `commerceorders.refer`,
   or only an internal `refer_*` allowlist?**
   - If arbitrary keys are parsed → our deploy alone lands `gclid` on the order. Confirm and we're done.
   - If allowlisted → **extend the allowlist** to include `gclid` (and ideally `fbclid`,
     `msclkid`, `utm_*`), then our client values will populate.
2. **Order grain is sufficient** — gclid does NOT need to be copied onto the payment
   row; order→payment joins on `orderId`, so the click-join works as long as gclid is on
   the order. (Don't over-build a payment-level field unless it's free.)

**Verify after both sides ship:** land the test URL above → $1 trial → confirm
`commerceorders.refer.gclid === '<the gclid>'`.

---

## Gap 2 — payment partner contradicts the order's refer (BC shape-config fix)

**Symptom (from DB scan):** for the same order, the payment (seq 0) resolved to
`commercepayments.data.tracking.partner = {name:'internal', channel:'default'}` —
even though `commerceorders.refer.partnerId='google'` / `afid='g-inmates-upper'`
clearly say Google / inmates / upper. The two disagree.

**Root cause (confirmed our side):** there are two attribution paths and they don't fuse —
- `shn → shColId → shape tree → comp.tracking.partner → commercepayments.data.tracking.partner`
  (BC writes this during the sale) — **resolved to internal/default here.**
- `refer_* → commerceorders.refer` (the new client path) — **said google.**

This is **not client logic** — we never write `commercepayments.data.tracking.partner`;
BC populates it from the shape tree for the `shn`. We independently spotted this on
2026-06-09: a ShapeCompiled probe showed `6a22ff83ca16ad4ef68b84b5` (Google Inmates
Upper) resolving to the **default container**. The DB scan now confirms it's a real
config gap, not a probe cache artifact.

**What we need from BC:**
- On the shape for `shn=6a22ff83ca16ad4ef68b84b5` (and its sibling Lower/Death/Divorce
  tokens), set **`comp.tracking.partner.name = "google"`** and
  **`comp.tracking.partner.channel`** to the correct channel (e.g. `search` / `inmates`)
  so the payment's partner resolves to Google instead of internal/default.
- Once set, the shape path and the `refer_*` path **converge on their own** — no client
  change required.

**Design note:** treat `commerceorders.refer` as the authoritative acquisition record
going forward, and make the legacy `commercepayments…partner` path *agree* with it (by
fixing the shape). We should not reconcile two attribution sources in the browser bundle.

**Verify:** re-run the test URL → confirm `commercepayments.data.tracking.partner.name`
resolves to `google` and matches `commerceorders.refer.partnerId`.

---

## Ownership summary

| Gap | David (client) | Kwan (BC) |
|-----|----------------|-----------|
| 1 — gclid on order | ✅ `buildReferQueryString` emits gclid/utm (bundle `ed680352`, deploy pending) | Confirm queryString-key parsing (or extend the `refer_*` allowlist) |
| 2 — partner contradiction | (none — we don't write payment.partner) | Set `comp.tracking.partner.name/.channel` on the `6a22ff83…` shape (+ sibling tokens) |

See also `docs/BC_SHN_PARTNER_SHAPE.md` (#77-Q4/Q6 partner modeling) and
`docs/qa/google-ads-audit.md`.
