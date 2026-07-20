# "TooManyMatches" on common names — BC or IDI?

**Date:** 2026-07-20 · trigger: John/James Smith, FL → thin-match (zero results) in the funnel

## TL;DR — it's an **IDI behavior, surfaced by BC, mishandled by our client**

Three layers, three different roles:

1. **IDI (root, by design):** the IDI provider caps over-broad name searches. "John Smith, FL" matches thousands
   of distinct people; rather than enumerate them, idiCORE returns a **"too many matches — narrow it"** signal
   and **zero records**. This is standard, intended data-broker behavior (Spokeo/BeenVerified/TruthFinder all do
   it — it's why they force a state, and often a city/age). **Not an outage, not a bug.**
2. **BC (pass-through, working as documented):** BC relays IDI's signal. The teaser response carries it as
   `raws[0].meta.provider: "IDI"` + `raws[0].subType: "TooManyMatches"`, `transient: {identities:[], total:0}`,
   and the BC library exposes it as `response.getFailedCode() // "TooManyMatches" or null` (BC API docs, Api v3,
   line 59). BC paginates bounded results via `hasMore()/getMore()` — but there's nothing to paginate when IDI
   returns zero.
3. **Our client (the actual defect we own):** `deriveThinMatchFlags` (src/services/thinMatch.js) looks for the
   signal at `rawResponse.failedCode` / `rawResponse.getFailedCode()`. In the funnel it receives the **raw JSON**
   (where the signal is at `raws[0].subType`, not `failedCode`), so it **never detects TooManyMatches** → falls
   into `thinMatchNoResults` (because `count===0`) → the user hits the **zero/thin-match dead-end** instead of a
   "narrow your search" prompt.

## Evidence
- Live BC response (John Smith, FL): `status:"failed"`, `raws[0].subType:"TooManyMatches"`, `provider:"IDI"`,
  `transient:{identities:[], total:0, perPage:5}`.
- BC API docs (`docs/new-api/bc client library - Api v3.csv`): `searchTeaser` returns 5/page + `getMore()`
  pagination; `getFailedCode()` → `"TooManyMatches" or null`.
- `docs/research/idi-data-access.md`: idiCORE is a credentialed non-FCRA person-search API; **schemas/limits are
  NDA-gated / not public** — so the exact match-count threshold isn't in our docs (must ask IDI).

## So: BC problem or IDI problem?
- **The cap is IDI's** (and it's by design — you cannot get a bounded person list for "John Smith" without
  narrowing; no vendor returns it).
- **BC is behaving as documented** (surfaces the code, offers pagination for the bounded case).
- **The dead-end is OURS** — we don't read `raws[0].subType`, so we mislabel "too many" as "none."

## What to confirm with each party
- **IDI:** (1) the exact match-count threshold that triggers TooManyMatches; (2) whether the response includes a
  **total count** or a **"narrow by" hint** we could surface ("~5,000 John Smiths — add a city"); (3) whether
  adding city/age/middle reliably drops under the threshold. *(These are the NDA-gated limits — ask under the
  agreement.)*
- **BC:** (1) confirm `getFailedCode()`/`subType` is the canonical field to key on; (2) can BC return a **count**
  on TooManyMatches so we can show "N matches — narrow"; (3) is `perPage`/threshold tunable per brand.

## Likely resolution (testable prediction — NOT yet done, code unchanged per owner)
Adding a **city** (e.g., "John Smith, Tampa, FL") almost certainly drops under IDI's cap and returns matches.
Empirical confirmation would require a live captcha-gated funnel search — offered, not run.

## Our-side fix (deferred — owner chose "diagnose only")
- (A) Detect `raws[0].subType === 'TooManyMatches'` → route to a "narrow your search (add city/age/middle) →
  re-search" step instead of the zero dead-end.
- (B) First-party fallback: when IDI can't disambiguate, show our incarceration roster + SEO people directory
  (name×state) as a "which one?" list.
- (C) BC ask: return a bounded subset or a count for TooManyMatches.
