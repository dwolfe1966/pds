# Report-detail breadth: IDLookup.ai vs old site (inmatessearcher.com)

Comparing the O.J. ("Orenthal") Simpson report on both sites, which use the **same
BC API + data provider**. BC staff observed the old site surfaces more (1) per-address
detail and (2) financial info. **Resolved: it's a display/rendering gap on our side, not
a data or BC-product gap** — we already receive equivalent-or-richer data (see RESOLVED).

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

## RESOLVED (2026-06-07) — it's a DISPLAY gap, not a data/BC gap
Captured OUR `/idLookup/report/detail` as a logged-in paid member across **7 saved
reports**. Findings:

- **No `tempClient.processed.person`** in our payload — but it doesn't matter, because
  our `raws[].transient.identities[0]` is just as rich (different field names, equivalent
  data). `hasProcessed=false`, `hasTransient/identities/addressList=true`.
- **Per-address: we ALREADY receive `county`, `ownership` (owner/renter), `zip4`,
  `dateRange`, lat/long, parsed street (predir/streetNumber/street/suffix), aptName.**
  Verified across subjects: every report has per-address `county`; property-linked
  addresses carry `ownership`. Our UI (`SearchResultDetailPage` address table) renders
  only street/city/state/zip + date range → **we DROP county/ownership/zip4 in the UI.**
- **Financial: we ALREADY receive POPULATED `lienList` etc. when the subject has them.**
  One subject (28 addresses) returned `lienList:3` + `criminalList:8`. Each lien is
  deeply detailed: `caseDescription` ("STATE TAX LIEN"), `documentLocation.docNumber`,
  `recordingDate`, `taxPeriodMax/Min`, `issuingAgency`, `debtor`, FIPS/county/state,
  `lienType`, `creditor`. We render these via `FinancialRecordCard`.
- **Category breadth is huge on our side** — the identity exposes 40+ lists incl.
  `lienList, judgmentList, bankruptcyList, foreclosureList, criminalList, arrestsList,
  arrestWatchList, propertyList, professionalList, driverLicenseList, veteranList,
  motorVehicleList, aircraftList, businessList, deathList, sanctionsList, fraudList,
  relationshipList(58)`.

**Conclusion:** the BC staffer's "old site got more from the same API" is, on our side,
a **rendering/presentation gap — NOT a data-acquisition or BC-product gap.** We already
receive equivalent-or-richer data; we just don't surface all of it.

### Recommended fix (client-side, no BC dependency)
1. **Address History table:** add `county`, `ownership` (Owner/Renter/Leased), `zip4`
   (or full ZIP+4), and show the full address-history depth (don't cap). `reportExtract`
   already keeps `county`; add `ownership`.
2. **Financial section:** confirm `FinancialRecordCard` surfaces the rich lien fields we
   receive (case description, doc #, recording date, tax period, issuing agency, debtor) —
   it largely does; audit for any dropped fields.
3. **(Optional) Category parity:** old-site `processed.person` also lists evictions,
   marriages, divorces, akas — confirm whether our identity returns these; if not, that's
   the only candidate genuine BC ask (small, secondary to the owner's two named gaps).

## Captures (local /tmp only, NOT committed — contain PII)
`/tmp/oj-out/` (old site) + `/tmp/our-out/` (ours). Credentials were used at runtime via
env vars only — never written to any file, script, commit, or memory.
