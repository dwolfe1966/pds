---
name: project_conversion_tracking_live
description: Purchase conversion tracking (GA4 + Google Ads) is live + verified; GA4 filters headless test traffic
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

**Confirmed live 2026-06-28; label fixed 2026-07-02 (container v16).** Purchase conversions flow to BOTH GA4 and Google Ads via GTM `GTM-THCSBJWN`:
- **GA4:** `__gaawe` event tag, eventName `purchase`, measurementId `G-P5GFMP05TS`, triggered by `purchase` Custom Event. Verified end-to-end (real human purchase → GA4 Realtime). Also `sign_up` tag + the `client_*` funnel catch-all.
- **Google Ads:** `__awct` conversion tag, id `18044069648` / **label `D3A_CJy47LwcEJDOipxD` = "Purchase (2)", the PRIMARY action (v16, 2026-07-02)**; same `purchase` trigger; conversion linker `__gclidw` + gclid carried through the redirect (sets `_gcl_aw`).
- **2026-07-02 snafu root cause:** GTM v15 fired label `6CztCM_…` (old action) while the PRIMARY action "Purchase (2)" (`D3A_…`, created 6/10 as "Manual event") never received events → campaigns reported 0 conversions despite the tag firing. Fix = label swap in GTM (owner published v16; verified live via public gtm.js — that's the check: `curl gtm.js | grep <label>`). **Ads-UI TODO:** after Purchase (2) records its first conversion, demote/remove the old `6CztCM` action (avoid double-count); add `shn=` final-URL suffixes (all 354 RSA ads have none — affects BC partner attribution only, not Ads counting).
- Client chain: `PaymentPage gtmPurchase()` → `gtm.js push` → `gtmContext.push` → `window.dataLayer.push({event:'purchase', value, currency, ...})`. Confirmed lands `event:'purchase'` top-level.

⚠️ **GOTCHA — GA4 filters headless/automated/datacenter traffic.** Playwright/curl probes send a perfectly-formed GA4 hit (valid cid/sid/value, identical to page_view) but GA4 **drops them as bots**, so they NEVER appear in Realtime. Automated probes prove the hit is correct + sent; they CANNOT prove Realtime visibility. **Verify conversions with a REAL human purchase from a normal browser, not a headless probe.** Don't re-panic when a scripted test doesn't show in Realtime.

Ads reporting lags hours→24h and counts only from publish-time forward. Direct test purchases (no ad click) count but are unattributed (no `_gcl_aw`). See [[project_tracking_architecture]], [[reference_bc_getorder_price]].
