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

**RESOLVED 2026-06-15 — fixed our side, no BC change needed.** BC ingests ONLY
`refer_`-prefixed queryString params into `commerceorders.refer` (it strips the prefix:
`refer_partnerId` → `refer.partnerId`). The first attempt sent raw `gclid=`, which BC
dropped (analyst verified live: `refer_*` reached commerce, raw `gclid` did not). Fix =
send the click-join keys under the proven convention — **`refer_gclid` / `refer_fbclid` /
`refer_msclkid`** → `refer.gclid` etc. (`trackingService.buildReferQueryString`, commit
`1c94667`, bundle **`public.e9ca7f91.js`**, deployed). Order grain is sufficient
(order→payment joins on `orderId`).

**Client side VERIFIED (2026-06-15, deployed `e9ca7f91`):** deployed bundle contains the
`refer_gclid` logic; landing the campaign URL captures `gclid` into `referralParams`; the
sale `queryString` the client emits is
`refer_partnerId=…&refer_afid=…&refer_abc=…&refer_gclid=<gclid>`. Everything up to the sale
boundary confirmed.

### ⮑ Final confirmation step (one $1 sale) — how to run it
The only unverified link is BC persisting `refer_gclid` → `refer.gclid` server-side
(structurally identical to the `refer_*` keys that already persist, so high-confidence —
but a fixed `refer` schema is the one residual risk). To close it in one shot:

> **`node scripts/live-uat-shn-sale-verify.js`** — opens a headed browser on the full
> campaign test URL (gclid + refer_* baked in). Drive the funnel by hand (search → solve
> captcha → unlock → enter the BC test card → submit the $1 trial). The script never
> touches the card; it intercepts the `commerceBilling/sale` + order responses and prints
> `order.shConId`, `refer`, and `partner`. Result also written to
> `scripts/out/shn-sale-verify.json`.
>
> **PASS =** the printed `refer` contains `gclid` (i.e. `commerceorders.refer.gclid ===`
> the landing gclid). Override the test value with `GCLID=… node scripts/...` if desired.
> If the sale response doesn't expose `shConId`/`refer` to the browser, read the order via
> CSR instead and check `commerceorders.refer.gclid`.

Once `refer.gclid` is confirmed on a fresh order, #10 is closed.

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

**UPDATE 2026-06-15 — BC CTO root-caused it: "your client loads only default shN; load
the correct shN."** Three signals now converge: (1) CTO statement, (2) our own 06-09
ShapeCompiled probe ("6a22ff83 → DEFAULT container"), (3) the order's partner=internal/default.
**The shN value `6a22ff83ca16ad4ef68b84b5` is not resolving to the Google/Inmates node** —
BC falls back to its default shN, and shColId + partner follow from that default. This
supersedes the earlier "just set comp.tracking.partner on the 6a22ff83 shape" framing:
the shape isn't even being selected. CTO points to the partner sheet
(`…/1R7fE5Jp4TNt14BlwsbTqpxpUwNh1BxihGhfXqn0qNpQ`, row 12 / B12:G12) as the authoritative shN.

**RESOLVED 2026-06-15 — it's a CLIENT bug, now fixed.** Owner confirmed `6a22ff83…` IS
the correct shN for Google Inmates Upper (default = `69a2380b53ecf9b049d01fbb`). CTO
pinpointed it: **we were not calling a BC method to set the shN after seeing it in the URL.**
We passed `initialShParams` at `getInstance`, but `getInstance` is a **singleton** — if the
instance already exists (IIFE auto-init on load, or an earlier call), our config is ignored
and BC stays on its default shN. BC's documented fix (HowTo, added 2026-05-13) is
**`api.shape.setShapeParams({ shn, shl, cascade })`** — sets/refreshes the shape AFTER init.

**Fix shipped (`apiWrapper.js`, bundle `public.e70d1364.js`, deploy pending):** after
`getInstance`, explicitly call `this.wrapper.api.shape.setShapeParams(initialShParams)` with
the first-touch shn/shl (guarded + fire-and-forget so a bad shn can't break init). This sets
the campaign shape on the live instance before any shape/order call, so BC resolves the
inmates node instead of default — restoring the partner/shColId attribution AND letting the
shape's `comp.tracking.partner` flow onto the order.

**Discriminating DB read to request from BC:** pull `shConId` AND `shColId` from BOTH the
06-11 (worked) and 06-15 (broke) orders. If shConId is identical but shColId differs →
resolution regression; if shConId differs → two different tokens (no regression, just the
6a22ff83 config gap). Settles it in one read.

**Recommended primary fix = BC option (b), not (a):** have BC resolve payment
`partner/channel` from `commerceorders.refer` when present (`refer_partnerId=google`,
`afid=g-inmates-upper` → google/search) and persist `gclid` onto the commerce record.
This is robust to ALL root-cause branches because it bypasses the shColId/shN cascade
entirely — consistent with the design principle below. Option (a) (re-send shN/shColId on
the sale queryString) is fragile here: we have no `shColId` for this URL, and re-sending
the same `6a22ff83` that already cascades to default won't help. Hold (a) as a contingency.
Normalize casing in either path (`Google/Search` in refer vs lowercase in the shape).

**Design note:** treat `commerceorders.refer` as the authoritative acquisition record
going forward, and make the legacy `commercepayments…partner` path *agree* with it. We
should not reconcile two attribution sources in the browser bundle.

**Verify:** re-run the test URL → confirm (i) `getShapeCompiled` resolves the inmates shape
(not default), (ii) `commercepayments.data.tracking.partner.name === 'google'` matches
`commerceorders.refer.partnerId`, (iii) `commerceorders.refer.gclid` is set.

---

## Ownership summary

| Gap | David (client) | BC |
|-----|----------------|-----|
| 1 — gclid on order | ✅ FIXED + DEPLOYED (`e9ca7f91`): send `refer_gclid`/`refer_fbclid`/`refer_msclkid`; client side verified. Last step: one $1 sale to confirm `refer.gclid` persists (`scripts/live-uat-shn-sale-verify.js`) | None needed — uses the existing `refer_*` ingestion |
| 2 — shN resolved to default → default partner | ✅ FIXED + DEPLOYED (`e70d1364`): call `api.shape.setShapeParams` after `getInstance`; shape resolution verified live | None needed — analyst confirms #6 done end-to-end (google/search on payment) |

See also `docs/BC_SHN_PARTNER_SHAPE.md` (#77-Q4/Q6 partner modeling),
`docs/BC_CSRWRAPPER_HOSTING.md` (live-wrapper hosting ask), and `docs/qa/google-ads-audit.md`.
