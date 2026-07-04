---
name: reference-sale-billingid-dedup
description: BC sale "2nd-submit" 406 — BC field is billingId = full billingSeriesId string (type|clientId|apiId|ts|rand8); dedup keys on the STABLE clientId segment; prod uses IIFE path so only lever is wrapper.clientId
metadata:
  type: reference
---

**The `billingId` = our `billingSeriesId`.** BC's payment record field is literally `billingId`, valued as the full string `type|clientId|apiId|timestamp|random8` — confirmed in `docs/new-api/bc client library - csrApi v3.csv:1574,1804` (`"billingId":"sale|51snnjg9...|Mn20NFBg...|1772754761668|iZ7pSQWH"`). That's the same string the consumer IIFE generates: `function q(s){return \`${s.type}|${s.clientId}|${s.apiId}|${Date.now()}|${H.generateRandom(8)}\`}` (deployed `dev.www.idlookup.ai/libs/api-wrapper/index.iife.js`, forced onto `n.data.billingSeriesId` in the sale `__requestCallback`; query `clientId`/`apiId` are `excludeKeys`-stripped so you can't inject via queryString).

**Why the 2nd submit 406s (Kwan 2026-07-03 "we are NOT changing the billingId"):** the full billingId string rotates every request (apiId+ts+rand8 all fresh), so a collision can only be on a SUBSTRING. The only stable segment is `clientId` — set ONCE in the IIFE constructor (`this.clientId=this.getRandomId()`) and re-read unrotated by the interceptor (`handleRequest: params={...params,clientId:this.clientId,apiId:getRandomId()}`). Same page session → same clientId segment → BC `declineDupSignup` velocity block → bare 406. NOTE: `billingId` field name is verified from a *fulfilled* payment record, not a captured 406 body (inferred to match).

**Prod uses the IIFE path**, not `_saleViaProxy`: `.env.production` has `REACT_APP_USE_API_PROXY=false` + empty `REACT_APP_PROXY_URL`, so `useProxy=false` → `apiWrapper.js sale()` (~1367) IIFE branch `wrapper.api.billing.sale(params)` (~1383). Fix must target the IIFE path; only lever is `this.wrapper.clientId`.

**Fix = HYPOTHESIS, not confirmed:** rotate `this.wrapper.clientId` scoped to a post-406 retry (save/restore around the retry — NOT blanket per-submit). RISK: clientId is also read by report-create (`apiWrapper.js:618`), post-sale getOrders poll (`:757`), and plausibly conversion attribution — rotating could misattribute the purchase or break the poll. Ask Kwan: does BC dedup on the clientId segment, and does attribution need clientId continuity? **Discriminator for a live 406:** capture two consecutive 406 bodies, diff the returned billingId — identical clientId segment + differing apiId = confirms clientId-substring dedup; identical full strings = IIFE isn't rotating (different bug). Related: [[reference_bc_sale_sequenceoption_406]] (a DIFFERENT sale 406), [[project-asks-e-h-2026-07-02]] (ASK F velocity/fraud 406).
