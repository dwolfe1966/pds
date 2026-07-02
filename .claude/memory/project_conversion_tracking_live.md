---
name: project_conversion_tracking_live
description: Purchase conversion tracking (GA4 + Google Ads) is live + verified; GA4 filters headless test traffic
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

**Confirmed live 2026-06-28.** Purchase conversions flow to BOTH GA4 and Google Ads via GTM `GTM-THCSBJWN` (published, container v15):
- **GA4:** `__gaawe` event tag, eventName `purchase`, measurementId `G-P5GFMP05TS`, triggered by `purchase` Custom Event. Verified end-to-end (real human purchase → GA4 Realtime). Also `sign_up` tag + the `client_*` funnel catch-all.
- **Google Ads:** `__awct` conversion tag, id `18044069648` / label `6CztCM_GgZUcEJDOipxD`, same `purchase` trigger; conversion linker `__gclidw` + gclid carried through the redirect (sets `_gcl_aw`). Fires `googleadservices.com` with the label.
- Client chain: `PaymentPage gtmPurchase()` → `gtm.js push` → `gtmContext.push` → `window.dataLayer.push({event:'purchase', value, currency, ...})`. Confirmed lands `event:'purchase'` top-level.

⚠️ **GOTCHA — GA4 filters headless/automated/datacenter traffic.** Playwright/curl probes send a perfectly-formed GA4 hit (valid cid/sid/value, identical to page_view) but GA4 **drops them as bots**, so they NEVER appear in Realtime. Automated probes prove the hit is correct + sent; they CANNOT prove Realtime visibility. **Verify conversions with a REAL human purchase from a normal browser, not a headless probe.** Don't re-panic when a scripted test doesn't show in Realtime.

Ads reporting lags hours→24h and counts only from publish-time forward. Direct test purchases (no ad click) count but are unattributed (no `_gcl_aw`). See [[project_tracking_architecture]], [[reference_bc_getorder_price]].
