---
name: bc-billing-sale-406-non-false-sequenceoption
description: commerceBilling/sale returns HTTP 406 when sequenceOption (thin-match flags) is non-false; the canonical sale sends all flags false. Only send readThinMatch() for a real teaser report-unlock.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7cf476e3-95d5-4760-901e-3e85bff7c6de
---

`commerceBilling/sale` (BC `billing.sale`) returns **HTTP 406** when the `sequenceOption`
(the thin-match flags from `src/services/thinMatch.js`) is **non-false**. BC's canonical sale
example sends all five flags `false` (`EMPTY_FLAGS`: thinMatch, thinMatchDataProviderDown,
thinMatchTooManyResults, thinMatchNoResults, thinMatchGeographic). A sale that asserts
`thinMatch:true` (e.g. from a zero/sparse search) is rejected — and the downstream
`user/changePassword` then 403s because no BC user got created.

**Rule:** in `PaymentPage.js`, only pass `readThinMatch()` when the purchase unlocks a
specific teaser report (`selectedPersonId` present); otherwise send `{ ...EMPTY_FLAGS }`
(all-false). A general/promo signup (the thin-match → `/payment` path) has no target report,
so it must send all-false. This also prevents a stale `sessionStorage` thin flag from leaking
into a normal purchase and 406'ing it. Fixed 2026-06-11 (`sequenceOption: selectedPersonId ?
readThinMatch() : { ...EMPTY_FLAGS }`).

**Caveat:** 406's exact server meaning is INFERRED (elimination + correlation across the
deployed IIFE + docs), NOT confirmed in BC docs — the string "406" appears in neither the IIFE
nor the CSVs. Verify with BC and a prod-rig thin-match sale. Not captcha (IIFE only auto-retries
412) and not member-state (`useSignup`→`api.signup` issues only a synthetic token; no
`billing.signup`, so no member exists pre-sale). See also [[feedback_search_contextkey]]
(billing/teaser changes = one change at a time, verify).
