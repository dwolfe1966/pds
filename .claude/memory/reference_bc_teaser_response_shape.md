---
name: bc-teaser-identities-nested-in-commercecontent-raws
description: "BC teaser/report responses nest identities under commerceContent.raws[0].transient.identities; adaptTeaserResponse missed it → phone SRP showed 'no results'."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7aeba5ca-a8fd-4f98-b2f1-d4e52b390ce2
---

BC's idLookup teaser/report responses put the results under
**`commerceContent.raws[0].transient.identities`** (with `.total` / `.perPage`,
and `commerceContent.data.teaserInput` for the downstream report-create). The
first teaser POST returns a **captcha challenge** (`{type:'password.v0', action:
'NO_DESC_IN_RULE', captchaId, step:'0-0'}`); the IIFE solves it and the SECOND
POST returns the data. Confirmed live 2026-06-05 (phone 9096637878 → 2 identities).

**The phone-search "no results" bug (fixed 6200ae8):** `adaptTeaserResponse`
(src/services/apiAdapter.js) only looked at `raws[0].transient` and a
`getData().raws[0]` path that was gated behind `if (development)` — so in
PRODUCTION it never handled the `commerceContent.raws` nesting → phone SRP empty
even though BC returned matches. NAME teaser surfaced via `getIdentities()` /
top-level raws, so it worked and masked the gap. Fix = additive prod fallback
mirroring `adaptReportDetailResponse` (which already handled `commerceContent.raws`,
line ~216): resolve raw data from the IIFE wrapper, then find the transient by KEY
(`raws.find(r => r.transient?.identities)`), checking `raws` AND
`commerceContent.raws` on response / getData() / commerceContent.

**Member phone search** (MemberGeneralSearchPage → `createReportForPhone` →
`reversePhone` create-report) routes through `adaptReportDetailResponse`, which
already handled the shape — so it was NOT affected by the teaser bug.

Lesson: when a search "returns nothing," capture the RAW BC response first — the
data may be present but nested where the adapter doesn't look. The IIFE contextKey
enum (`window.ApiWrapper.contextKey.sale.phone.{teaser,report}`) is fully populated
— ruled out as a cause. Captcha gates searches but NOT page load, so the enum is
inspectable via Playwright `page.evaluate` with no search.
