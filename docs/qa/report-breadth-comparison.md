# Report-detail breadth: IDLookup.ai vs old site (inmatessearcher.com)

Comparing the O.J. ("Orenthal") Simpson report on both sites, which use the **same
BC API + data provider**. BC staff observed the old site surfaces more (1) per-address
detail and (2) financial info. This documents what's **verified on the wire** so far —
the final display-gap-vs-product-gap conclusion is **deliberately deferred** pending one
artifact (see "Open fork").

## What the OLD site actually serves (captured on the wire)
Endpoint: `GET /api/commerce/customer/find/contents` →
`docs[].obj.raws[].tempClient.processed.person[]`. For O.J. that person object carries:

**Per-address (28 addresses), each with:**
`city, state, zip, zip4, latitude, longitude, fullAddress, streetNumber, predir,
street, streetSuffix, postdir, aptName, dateRange ("01/01/1996-05/18/2026"), county
("BROWARD"), ownershipStatus ("C")`.

**Full category schema on that person object** (O.J. counts in parens):
`addresses(28), phones(11), emailAddresses(9), relatives(33), associates(40),
properties(4), criminalRecords(2), courts(1), akas(5)` + financial-capable fields
`finance{}, foreclosures[], evictions[], marriages[], divorces[], licenses[], feins[],
businesses[], reversePhoneAddresses[], ipAddresses[], sexOffenderFlag`. (O.J.'s own
finance/foreclosures/evictions came back empty — but a different saved report in the same
capture, `net-10.json`, is full of liens/bankruptcies/judgments/foreclosures/evictions,
confirming the schema is populated when the data exists.)

## What OUR site serves
Endpoints (from the IIFE): `POST /idLookup/report/create`,
`GET /idLookup/report/detail/<commerceContentId>`. Our adapter
(`apiAdapter.adaptReportDetailResponse`) + `reportExtract.extractAll` read
**`raws[].transient.identities[].<xxx>List`** (nameList/addressList/phoneList/lienList/…)
+ `transient.fullContact`. Our report UI (`SearchResultDetailPage`) renders 17 sections
incl. Address History and Financial (liens/judgments/foreclosures/bankruptcies).

**Per-address we render:** street, city, state, zip, date range (firstSeen–lastSeen).
We do NOT render `county` (extracted but dropped) or `ownershipStatus` (not extracted).

## The structural difference (verified)
- Old site shape uses **`tempClient.processed.person`** — our adapter's keys
  (`transient`, `identities`, `addressList`, `lienList`) appear **0 times** in the old-site
  payload. Different endpoint, different shape.
- ⚠️ The Explore agent's first pass said "no fields dropped" — but it compared our adapter
  to our *own* `BC_REPORT_RESPONSE_STRUCTURE.md`, NOT to reality. The old-site capture
  disproves any "we already surface everything" reassurance. Treat that doc as incomplete.

## Open fork — needs ONE artifact to close
**Does OUR `/idLookup/report/detail` response ALSO contain `tempClient.processed.person`?**
- **YES** → pure **display/adapter gap**: we already receive the rich data and only read
  `transient.identities`. Fixable entirely client-side, NO BC dependency. (Big, good outcome.)
- **NO** → BC hands us a structurally thinner shape (different product/provider/endpoint) →
  that's the **BC ask**.

Everything else (28 addresses, county, ownership, finance/foreclosures/evictions) is
downstream of this. **Cannot be answered from the competitor capture alone** — we have
zero captures of our own report payload, and the repo has none saved.

**Cheapest way to get it (do NOT mint a fresh report through captcha+payment):**
1. A dev member session on idlookup.ai with ≥1 existing paid report → run the same capture
   technique against `/idLookup/report/detail/<id>` and grep raws for `tempClient.processed`
   vs `transient.identities`. (Viewing an existing report should not be captcha-gated.)
2. Or an existing `commerceContentId` queried via CSR.

## Captures (local, not committed — contain PII)
`/tmp/oj-out/` — old-site payloads (`net-36.json` = saved-reports contents incl. O.J.
processed.person; `net-10.json` = a report with full financials), screenshots, text.
