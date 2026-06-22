---
name: project_ads_conversion_2026_06_07
description: "Google Ads/GTM conversion-tracking audit + fixes; what's code-done vs owner-side (GTM/Ads UI)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7aeba5ca-a8fd-4f98-b2f1-d4e52b390ce2
---

Google Ads conversion pipeline audit (consumer site), 2026-06-06/07. Full writeup:
`docs/qa/google-ads-audit.md` + test plan `docs/qa/conversion-tracking-test-plan.md`.

**Code side — DONE & shipped:**
- GTM double-load FIXED (`c936086`): `initGtm()` is a no-op; `REACT_APP_GTM_ID` removed
  from `.env.production` (it was the DEV container `GTM-WV7N6WWP`, double-counting). The
  per-brand snippet in `public/index.html` is the sole loader.
- Conversion-gate FIX (`db09727`): `CampaignContext.persistIdentity` now mirrors the
  resolved registry identity into gtmContext via `gtmSetCampaign` → dataLayer carries
  `partnerName`/`partnerChannel`. Before, shN traffic (no UTM) reached the post-payment
  `purchase` event with EMPTY partner fields, so the Ads tag (gated on partnerName=Google)
  never fired. Verified `partnerName=["Google"]` via the probe.
- thinMatch enabled for `6a22ff83` (`f1e18dd`): `search.zeroState:'thinMatch'`.
- Post-payment `purchase` event already fires with `orderId`+real amount+partner
  (`PaymentPage.js:490-500`) — no code change needed for the conversion itself.
- Latest deployable consumer bundle: **`public.ee72ad75.js`** (carries the gate fix + thinMatch).

**Owner side — TODO (GTM-UI / Ads-UI, not code):**
- GTM `GTM-THCSBJWN` "Adwords Pixel Signup Conversion" tag fires on a `/pixelforsignup?type=pixel`
  PAGEVIEW that DOESN'T EXIST → re-point trigger to a Custom Event = `purchase`; set dedup/Order-ID
  var to read `orderId` (not Session ID). Then Submit/Publish.
- Ads: NO `?shn=` on any final URL (partner funnel won't activate) → add `?shn=6a22ff83…` etc.
- Ads: campaigns point to off-funnel domains `inmatessearcher.com` + `privaterecords.net` (not in
  GTM map, not our funnel) + some dev URLs → owner fixing.

**UPDATE 2026-06-15 — live-test attribution gaps (employee DB scan of a real order):**
- ✅ `commerceorders.refer` now non-empty (0→1): `refer_*` rides landing→`data.refer`→
  sale `queryString`→order. Core #10 refer-level ask working.
- **Gap 1 (gclid not on billable record) — FIXED our side, deploying.** `gclid`/utm rode
  `trackings.data.refer` but not the order/payment. `buildReferQueryString()` now also emits
  `gclid`/`fbclid`/`msclkid`/`utm_*` into the sale queryString (commit `35d7396`, bundle
  **`public.ed680352.js`**, deploy pending). **Owner confirmed BC parses the full queryString**
  (not a `refer_*` allowlist), so no BC change needed — gclid lands on `commerceorders.refer`
  at order grain (order→payment joins on orderId; no payment-level field needed).
- **Gap 2 (payment partner contradicts order refer) — BC-side, NOT code.** Payment seq0
  resolved `commercepayments.data.tracking.partner={name:'internal',channel:'default'}` while
  order `refer.partnerId='google'`. We never write payment.partner; BC writes it from the
  shape tree (`comp.tracking.partner`) for the shn. Token `6a22ff83…` (Google Inmates Upper)
  resolves to DEFAULT container — same symptom we spotted 2026-06-09. Fix = Kwan sets
  `comp.tracking.partner.name=google`/`.channel` on that shape + sibling tokens. Then shape
  path + refer_* path converge. Going-forward principle: `commerceorders.refer` is authoritative;
  legacy partner path must agree (no client-side reconciliation).
- BC asks doc: `docs/BC_COMMERCE_ATTRIBUTION_GAPS.md` (gap1 confirm-done + gap2 shape config).

**UPDATE 2026-06-15 (later) — BOTH gaps fixed in code:**
- **shN-default (gap2) RESOLVED:** root cause was `getInstance` singleton ignoring
  `initialShParams`; fix = call `api.shape.setShapeParams({shn,shl,cascade})` after init
  (`apiWrapper.js`). Deployed `e70d1364`; reporting analyst confirms #6 done end-to-end
  (campaign signup → google/search ON THE PAYMENT, queryable). See [[shn-partner-attribution-framework]].
- **gclid on order (gap1) FIXED + DEPLOYED (`public.e9ca7f91.js` live on dev):** key
  learning — **BC ingests ONLY `refer_`-prefixed queryString params into
  `commerceorders.refer`** (strips prefix). Raw `gclid=` was DROPPED (analyst verified:
  refer_* reached commerce, raw gclid did not). Fix = send `refer_gclid`/`refer_fbclid`/
  `refer_msclkid` (commit `1c94667`). **Client side VERIFIED live**: deployed bundle has the
  logic, landing captures gclid→referralParams, emitted sale queryString =
  `…&refer_gclid=<gclid>`. Only unverified link = BC persisting `refer_gclid`→`refer.gclid`
  server-side (needs ONE $1 sale to read `commerceorders.refer.gclid`).
- Reusable verify tool: `scripts/live-uat-shn-sale-verify.js` (headed network recorder —
  human drives funnel/captcha/card, script dumps order shConId/refer/partner from the
  intercepted sale + order responses). Runbook also in `docs/BC_COMMERCE_ATTRIBUTION_GAPS.md`.
- **STATUS: #6 CLOSED (shN→partner, verified). #10 one $1-sale-read from closed (gclid).**
  Both fixes deployed. Only open BC-side item across this work = csrWrapper live-hosting
  (`docs/BC_CSRWRAPPER_HOSTING.md`), not a launch blocker.

**Verify tool:** `node scripts/live-uat-gtm-shn.js` (BASE=… ; default dev). Read-only, no captcha —
asserts shN→landing redirect, gclid/shn capture, dataLayer partner fields, no-shN control. 4/4 PASS.
Conversion-FIRE test stays manual (GTM Preview/Tag Assistant — BC captcha gates the search step).

See [[project_shn_framework]] (registry/resolver), [[project_launch_state_2026_06_06]].
