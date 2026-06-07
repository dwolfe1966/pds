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

**Verify tool:** `node scripts/live-uat-gtm-shn.js` (BASE=… ; default dev). Read-only, no captcha —
asserts shN→landing redirect, gclid/shn capture, dataLayer partner fields, no-shN control. 4/4 PASS.
Conversion-FIRE test stays manual (GTM Preview/Tag Assistant — BC captcha gates the search step).

See [[project_shn_framework]] (registry/resolver), [[project_launch_state_2026_06_06]].
