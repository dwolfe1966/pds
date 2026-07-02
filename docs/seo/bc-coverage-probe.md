# BC data-coverage probe for programmatic SEO (name + location tree)

**Prepared 2026-07-02.** Goal: determine, with evidence, whether ByteCrtrs (BC/IDI) can supply
the data a Spokeo-style profile-page + directory tree needs. BC is our internal data provider
(same company) — gaps below are framed as internal asks, not vendor complaints.

## Method + a live blocker to know up front

Order was **docs first, live probes second** (per `reference_bc_api_docs_location`). Sources:
`docs/new-api/bc client library - {Api,Api v3,csrApi,csrApi v3,HowTo}.csv`,
`docs/BC_REPORT_FIELD_MAP.md`, `src/services/apiAdapter.js` (`adaptTeaserResponse`/`adaptIdentity`),
`src/utils/reportExtract.js`, and the deployed dev IIFE (`/libs/api-wrapper/index.iife.js`).

**Live probe was BLOCKED by the dev captcha and could not be worked around.** Across 3+ attempts
over several minutes, via three independent paths (in-page `getInstance` + `executePasswordCaptcha`
override; a direct `/captcha/verify` + retry replication; and the **real app search UI** via
`scripts/funnel-dev-full.js`), every name teaser hit the same wall:

```
POST /api/idLookup/teaser/search           → 412 {"type":"password.v0", captchaId, step:"0-0"}
GET  /api/captcha/verify?token=bcEdgeApiPass&type=password.v0&step=0-0&clientId&apiId
                                           → 200 {"success":true}     ← password is correct
POST /api/idLookup/teaser/search (x-captcha-id: <captchaId>)
                                           → 401 {"verifyCaptchaFailed":true}   ← retry rejected
```

The **real consumer app** hits the identical sequence and lands on `/name/search-result?error=true`
("An error occurred during the search."). So dev teaser search is currently non-functional for
*everyone*, not just this probe. Memory forbids hand-rolling the captcha retry
(`feedback_never_block_bc_captcha_modal`), so per task rules I stopped and fell back to the docs.

**Verdict legend:** ✅ supported · ⚠️ partial (BC half-supports it) · ❌ not supported ·
**❓ blocked-unverified** (could not test live; no raw teaser/report payload was captured this session).
The ❓ marker is deliberately distinct from ⚠️ so the reader can tell a real BC limit from an untested one.

Probe scripts (DEV-only, read-only, no mutations): `scripts/probe-seo-teaser.js`,
`scripts/probe-seo-captcha-check.js`.

---

## Summary table

| # | Question | Verdict | One-line basis |
|---|----------|---------|----------------|
| 1 | Name aggregation (all "First Last", nat'l + state), pagination, max | ✅ with a ceiling | `searchTeaser` + `getMore()`/`hasMore()`; `raws.0.transient.{total,perPage}`; search-history shows resultCount 16. **But `getFailedCode()==="TooManyMatches"`** caps common names |
| 2 | Per-record location history in the teaser (current + prior) | ❓ blocked-unverified | Teaser identity carries an `addressList[]` (adapter joins many) → *plausibly* multi-address, but no raw payload captured to confirm current-vs-prior depth |
| 3 | Relatives/associates pre-purchase, with linkable record IDs | ❌ as-built + ❓ unverified | Relatives live in the **paid report** (`relationList`/`relationshipList`, 57–398 rows) and carry **no per-relative extId**. Teaser adapter reads no relatives; previews fake the count. Raw teaser payload not inspected live |
| 4 | Per-record counts of gated data (Address(3)/Phone(10)/Email(16)) | ❌ as-built + ❓ unverified | App **fabricates** `_phoneCount`/`_addressCount`/`_relativeCount` (never assigned from BC data). Only documented pre-purchase count is `transient.total` (# of people matched), not per-record field counts |
| 5 | School / employer history | ⚠️ + ❓ coverage | `employmentList`/`educationList` exist in the report schema/extractor, but were **empty in all 10 of test21's captured reports**; extractor comment says "BC schema unconfirmed." Not in teaser. Real-record coverage unknown |
| 6 | Per-name aggregates / demographics (counts, age distribution) | ❌ | Only server-side aggregate is `transient.total` (match count). `statistic/*` endpoints are per-**user activity** counters, not per-name demographics. Age distribution must be computed client-side from result sets |
| 7 | Bulk enumeration by surname/location (sitemap/taxonomy seeding) | ❌ | No bulk/enumerate endpoint anywhere in Api or **Api v3**. `searchTeaser` requires a specific first+last; `csr .../database/search` is BC's own **customer** collection (brandId/email/phone/zip), not the IDI people index |
| 8 | Record ID (extId) stability over time | ❓ blocked-unverified | No stability documentation; could not test live. `extId` is the report-create key + pagination cursor. Team already decided to mint our own IDs mapped to extId (mitigation), but churn rate is unknown |

v3 diff note: `Api v3.csv` adds only `contactMessage/getUserContacts` (consumer-support enumeration,
already known) and drops `tracking/create`. `csrApi v3.csv` adds **no** new paths. Neither adds any
search/aggregate/enumeration surface — Q6/Q7 ❌ hold against the newest documented API.

---

## Per-question evidence

### Q1 — Name aggregation + pagination + max — ✅ (with a TooManyMatches ceiling)
`apiWrapper.api.idLookup.searchTeaser({ fName, lName, state?, type:'name', contextKey: …sale.name.teaser })`
→ `POST /api/idLookup/teaser/search`. Documented return (`Api.csv` L112-116):
`raws.0.transient.identities` (array), `raws.0.transient.total` (**total match count**),
`raws.0.transient.perPage`. Pagination is first-class: `response.getIdentities()` then
`await response.getMore()` / `response.hasMore()` (`Api.csv` L41-56).

- **>5 results pre-purchase is real** (kills the historical member-search ≤5 caveat for the teaser
  path): `getUserSearchHistory` (`Api.csv` L233) shows a `tim chin FL` name search with
  `"resultCount": 16`. So the teaser returns and *counts* well beyond 5.
- **`state` is optional** → national name search is supported (phone/email teasers omit state; name
  examples always pass it, but it is not marked required). National vs per-state depth unverified live.
- **The ceiling:** `response.getFailedCode()` returns `"TooManyMatches"` or `null` (`Api.csv` L58-59).
  The highest-value SEO targets are common names ("John Smith") — exactly the ones most likely to be
  refused with `TooManyMatches`. **This cap is live-unverified** (captcha blocked triggering it) and is
  a material risk to "retrieve *all* people named X" at the head of the distribution.

### Q2 — Location history in the teaser — ❓ blocked-unverified
`adaptIdentity` (apiAdapter.js) builds a display `location` by **joining every entry** of
`identity.addressList` (`{city,state,zip}`) with `'; '` — i.e. the teaser identity does carry an
address *array*, not a single city. Whether that array is full current+prior history or a trimmed
display set could not be confirmed (no raw teaser payload captured; dev search blocked). "App joins
many addresses" proves as-built behavior, not the raw teaser's depth.

### Q3 — Relatives pre-purchase with linkable IDs — ❌ as-built + ❓ unverified
Relatives are a **paid-report** structure: `reportExtract.js` reads `relationList` (primary shape) /
`relationshipList` / `relativesList` / `associatesList`, populated only after `createReport`
(`BC_REPORT_FIELD_MAP.md`: relationshipList 57 on the O.J. packet, 398 across test21's reports). Each
relative row has `{name, relationship, age, city, state}` — **no per-relative `extId`**, so BC does not
hand us a record ID to deep-link a relative to their own profile page; we would re-search by name. The
teaser adapter surfaces **no** relatives, and the SRP preview variants render **fabricated** relative
counts (`_relativeCount` is never assigned from BC data). Whether the *raw* teaser payload contains a
relatives field at all is unverified live.

### Q4 — Per-record gated-data counts pre-purchase — ❌ as-built + ❓ unverified
The preview UI shows "Phone Numbers (n)", "Address Records (n)", "Relatives (n)". Grep confirms
`_phoneCount` / `_addressCount` / `_relativeCount` are **never assigned anywhere in `src/`** — the
variants fall back to seeded/fake ranges ("2–4 found", "3–8 found"). The only documented pre-purchase
quantity is `transient.total` (number of *people* matching the name), not per-record counts of a
person's addresses/phones/emails. Those counts exist only after a full report is created. Raw teaser
payload not inspected live to rule out a hidden count field.

### Q5 — School / employer — ⚠️ schema exists, coverage ❓
`reportExtract.js` extracts `primary.employmentList` (employer/title/city/state/start/end) and
`primary.educationList` (school/degree/start/end), plus `fullContact.employments`/`.educations`
fallbacks. **But** `BC_REPORT_FIELD_MAP.md` records that `employmentList`/`educationList` were **empty
in all 10 of test21's captured reports**, and the education extractor is annotated "BC schema
unconfirmed — try common shapes." So the fields exist in the report schema but **real coverage is
unproven** on the demo data, and neither appears in the teaser. This is the owner's flagged
"data exists, coverage unknown" item — still unknown; needs sample packets or a credit-capable account.

### Q6 — Per-name aggregates / demographics — ❌
Server-side, the only aggregate is `transient.total` (match count for a name). The `statistic/*`
endpoints (`countUserTeaserSearches`, `countUserReportCreations`, `countUserPdfDownloads`) count the
*logged-in user's own activity*, not the people index. No age-distribution / demographic aggregate
endpoint exists in Api or Api v3. A FAQ engine ("how many people named X", "average age") must compute
from result sets — which is itself capped by `TooManyMatches` (Q1) and no bulk pull (Q7).

### Q7 — Bulk enumeration by surname/location — ❌
No endpoint enumerates the IDI people graph by surname or location. `searchTeaser` needs a specific
first + last name. The only `/api/database/search` methods are CSR/admin
(`csrWrapper.api.user.find`/`findAdmin`, `optOut.find`, `contact.find`, `managedContact.find`,
`tracking.findUser`) and they query **BC's own customer/user collections** (params: `brandId`,
`userId`, `orderId`, `email`, `phone`, `zip`, `panLast4`) — not the people index. **This is the single
most important gap for pSEO** and validates locked decision #8 (source the directory *skeleton* outside
BC; query BC/IDI on-demand only for actual profile pages).

### Q8 — extId stability — ❓ blocked-unverified
No documentation on whether `extId` is stable across time/reingest. It is the `createReport` key and
the teaser pagination cursor. Could not run the repeat-search overlap test live. Locked decision #1
(mint our own public IDs mapped to extId) is the right hedge, but the **churn rate** — how often an
extId changes for the same person — is unknown and directly sizes our remap/redirect burden across
millions of URLs.

---

## Draft BC asks (evidence-linked; style per `docs/BC_CSR_ASKS_PACKAGE.md`)

### ASK 0 — Unblock dev teaser search, or hand us sample payloads (LAUNCH-BLOCKING — do first)
This single ask resolves ~5 of the 8 questions above; everything else is doc-only until it lands.

**Evidence (live):** dev `POST /idLookup/teaser/search` → 412 password.v0; `GET /captcha/verify`
with `bcEdgeApiPass` → **200 `{"success":true}`**; the retry `POST` with `x-captcha-id: <captchaId>`
→ **401 `{"verifyCaptchaFailed":true}`**. The real consumer app reproduces this and shows
`/name/search-result?error=true`. So the captcha *verify* passes but the *retry* is rejected — dev
search is down for all users.
**Ask:** (a) fix the dev password.v0 verify→retry handshake so teaser search returns on dev; **or**
(b) send raw sample payloads for ~5 named records (1 common, 1 medium, 1 rare) — both the **teaser**
response (`raws.0.transient`: identities + total + perPage) and a **full report** packet — so we can
verify Q2/Q3/Q4/Q5/Q8 from real data without live access.

### ASK 1 — Confirm the name-teaser ceiling: TooManyMatches threshold + national behavior (LAUNCH-BLOCKING)
**Evidence:** `response.getFailedCode() // TooManyMatches or null` (`Api.csv` L58-59). Common names are
our top SEO targets and the most likely to trip this.
**Ask:** (a) what result count triggers `TooManyMatches`? (b) is there a paged/streamed way to walk a
large name set past that cap? (c) does `state` (and any city param) reliably narrow a `TooManyMatches`
name down to a returnable set, and is national (no-state) search supported at scale?

### ASK 2 — Expose relatives (and their record IDs) at teaser tier, for cross-linking (nice-to-have → blocking if relatives are a ranking dimension)
**Evidence:** relatives appear only in the paid report (`relationList`/`relationshipList`), each row
`{name, relationship, age, city, state}` with **no extId**. Preview relative counts are fabricated.
**Ask:** (a) include a small relatives array (name + city/state + **extId**) in the teaser response so
we can render "possible relatives" honestly *and* deep-link each to their own profile page; (b) if
relatives can't move to the teaser, at minimum add a **per-relative extId** to the report so we can
build the relationship graph after purchase.

### ASK 3 — Per-record field counts in the teaser (nice-to-have; kills fabricated counts)
**Evidence:** `_phoneCount`/`_addressCount`/`_relativeCount` are never populated from BC; the SRP fakes
them. Only `transient.total` (people count) is real pre-purchase.
**Ask:** add per-identity `addressCount`/`phoneCount`/`emailCount`/`relativeCount` to the teaser so the
"Address(3) Phone(10) Email(16)" tease is truthful (and legally defensible) rather than seeded.

### ASK 4 — Confirm school/employer coverage + schema (nice-to-have; owner-flagged)
**Evidence:** `employmentList`/`educationList` exist in the extractor but were **empty in all 10**
test21 reports; education schema annotated "unconfirmed."
**Ask:** (a) confirm the exact field shapes for `employmentList` and `educationList`; (b) share a sample
packet that **populates** them; (c) ballpark population rate across the US person index (so we can size
"{name} + {employer}" as a real SEO dimension vs. a thin one).

### ASK 5 — Bulk / enumeration feed for directory-skeleton seeding (nice-to-have; we route around it)
**Evidence:** no surname/location enumeration endpoint in Api or Api v3; `/database/search` is
CSR-scoped over BC customers, not the IDI index.
**Ask:** is there (or can there be) a bulk/exportable index of person stubs (name + city/state + extId)
for sitemap/taxonomy seeding? If not, confirm so we finalize the external-skeleton architecture
(decision #8) rather than wait on BC.

### ASK 6 — extId stability guarantee (LAUNCH-relevant for URL durability)
**Evidence:** no stability docs; couldn't test live.
**Ask:** is `extId` stable for the same person across time / data refreshes? If it churns, what's the
rate and is there a durable canonical person key we should map to instead? (Sizes our
own-ID-remapping and redirect strategy for millions of URLs.)

---

## Feasibility bottom line

**The name + location pSEO tree is feasible — but only via the already-decided external-skeleton
architecture (locked decision #8), not by driving the URL universe off BC.** Bulk enumeration is ❌
and common-name aggregation is capped by `TooManyMatches`, so BC/IDI is a **per-profile, on-demand
data source**, not a directory generator. Build the name/location skeleton from a third-party index or
incumbent crawl; call BC/IDI to populate individual profile pages.

The **open risk is per-profile data depth** — location-history depth (Q2), relatives-with-linkable-IDs
(Q3), truthful gated counts (Q4), and school/employer coverage (Q5) are all **unconfirmed** pending
either a fixed dev captcha or sample payloads (ASK 0). Nothing found so far *contradicts* the owner's
"the data exists" premise for the report tier; we simply have not seen it live this session. Resolve
ASK 0 first — it unblocks the empirical answers to five of the eight questions.
