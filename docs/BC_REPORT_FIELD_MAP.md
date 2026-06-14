# BC report packet — field map & extractor gaps (verified 2026-06-14)

Captured a real `getReport` packet (O.J. Simpson demo report, test21) via
`scripts/capture-ojreport.js`. Raw saved to `/tmp/report-packet.json`.

**Packet root for `extractAll`:** `commerceContent.raws[0].transient` → `{ identities, ... }`
(the app's proxy/IIFE unwraps to this; `extractAll` reads `result.identities[0]`).

`identities[0]` carries far more lists than we surface: nameList, addressList,
propertyList, criminalList, bankruptcyList, lienList, judgmentList, foreclosureList,
arrestsList, motorVehicleList, aircraftList, businessList, professionalList,
driverLicenseList, veteranList, sanctionsList, deathList, employmentList, … plus
`*Count` fields. (This doc covers the two flagged areas only: criminal + property.)

---

## 1. Legal records — the charge NAME (the reported bug)

**Field:** `criminalList[i].offense[j].description` (string) — e.g. "ARMED ROBBERY",
"FIRST ORDER MURDER", "KIDNAPPING I". We already read it.

**Why it goes blank → "Court record":** for `category:"COURT"` rows, `offense[j].description`
is often **empty**, while the charge text lives in the PARALLEL `crime[]` array at
`crime[j].offense.description` (an **array**, e.g. `["BURGLARY/OCC CONVEY"]`). Our extractor
does `source = offense.length ? offense : crime` — it prefers `offense[]` and **never falls
back to `crime[]` per-row**, so empty-description COURT rows render blank.
NOTE: `offense[]` and `crime[]` are parallel SETS but not strictly index-aligned (same case,
order can differ) — fallback is "a charge from this case", acceptable vs. blank.

**Full `offense[]` keys (24):** chargesFiledDate, date, description, conviction, disposition,
amendedDisposition, comments, category, caseNumber, **code, counts, court, caseType,
countyOrJurisdiction, plea, warrant, arrest, supervision, fines, commitment, sentence,
releaseDate**, sourceState, sourceName.
We currently emit: caseNumber, offenseDate, chargesFiledDate, offenseCode(code), description,
counts, disposition, dispositionDate, commitmentDate, convictionDate, sentence, releaseDate,
comments, category, sourceState, sourceName.
**Unused & worth adding:** `court`, `countyOrJurisdiction`, `caseType`, `plea`, `warrant`,
`arrest`, `fines`, `supervision`.

**Fix:** charge label = `offense.description` || join(`crime[j].offense.description`) ||
`offenseCode` || `category`/`caseType` || "Court record". Surface court/county/plea/caseType.

---

## 2. Property history (PDS employee flag: "not using all attributes")

**`propertyList[i].history[j].detail` keys:** receiptDate, transferDate, **salesPrice**,
**transferType**, deedType, **quitclaimFlag**, **armsLengthFlag**, **docNumber**.
**`history[j]` also has:** buyer, seller, **loan**, **isCurrentOwner**.
**`history[j].loan`:** loanValue, loanType, estimatedInterestRate.

We currently emit only: `date` (transfer/receipt), `deedType`, `buyer`, `seller`.
**Missing (high value):** `salesPrice` (the "$" the code comment said to add once a real
report confirmed the key — CONFIRMED: `detail.salesPrice`, e.g. 1387500), `transferType`,
`docNumber`, `quitclaimFlag`/`armsLengthFlag`, `loan` (loanValue/loanType/rate), `isCurrentOwner`.

**`propertyList[i].detail` keys:** county, parcelNumber, **propertyDescription**, useCode,
ownershipStatus, lotSqft, buildingSqft, yearBuilt, bedrooms, bathrooms, **subdivision**.
**`assessment` keys:** taxYear, assessedValue, marketValue, **landValue**, **improvementValue**,
totalTax, date, assessorYear. Also property-level `mailingAddress` (owner mailing vs situs).
**Missing:** propertyDescription, subdivision, landValue, improvementValue, mailingAddress.

**Fix:** add salesPrice/transferType/docNumber/loan to each history row; add
landValue/improvementValue/propertyDescription/subdivision to the property card.
**STATUS: DONE** (commit c8f78c4f) — criminal + property now expose all fields above.

---

## 3. Financial records (lien/judgment/foreclosure/bankruptcy) — DONE (commit pending)

**STATUS: DONE.** Liens/judgments/bankruptcies now expose all record[]/top fields (damarType,
taxCertificationNumber, all dates, lien property/hoaAddress). **Foreclosure is a SPECIAL CASE**
with a distinct shape (`detail[]` auction/trustee/beneficiary/amounts + `trustor[]`) — given
its own extractor (`extractForeclosures`); the old record[]/info[]/debtor[] extractor rendered
foreclosures nearly blank. Criminal charge-name backfill: bare court-docket rows inherit the
charge from any same-case row (matched on normalized case OR shared digit-core), within/across
records — blank charges 6→1 on the O.J. packet (the last is a genuinely charge-less court entry).
NOTE: judgmentList/bankruptcyList had no data in this packet — they SHARE the lien shape per the
existing grouping but are UNVERIFIED; confirm against a packet that populates them.
Other lists (motorVehicleList, aircraftList, businessList, employmentList…) may have their own
special shapes when populated — verify per-list as packets surface them (the foreclosure case
shows assuming a shared shape is wrong).

### (original notes)

`extractFinancialRecords` is still curated. From a real `lienList[0]`:
- **TOP keys:** info, record, courtCaseNumber, taxCertificationNumber, lienType, creditor,
  issuingAgency, property, business, debtor, hoaAddress, meta, eid.
  We emit: caseDescription, county, state, recordingDate, documentNumber, issuingAgency,
  creditor, debtor(name+address), lienType, courtCaseNumber, taxPeriod.
  **Dropped:** taxCertificationNumber, lien `property`, lien `business`, `hoaAddress`.
- **`record[]` keys:** caseDescription, documentLocation, originalDocumentLocation,
  recordingDate, date, damarType, origRecordingDate, taxPeriodMax, taxPeriodMin,
  refileExtendLastDate, abstractIssueDate, stayOrderedDate, documentFilingDate, origDocumentDate.
  **Dropped:** damarType, origRecordingDate, refileExtendLastDate, abstractIssueDate,
  stayOrderedDate, documentFilingDate, origDocumentDate.

Audit (this packet): all 10 POPULATED lists are extracted (no whole section dropped) —
nameList, dobList, addressList(18), relationshipList(57), phoneList, emailList, propertyList,
criminalList, lienList, foreclosureList. Remaining expose-all work is field-level within
financial (above) and verifying field completeness on address/relationship/employment when a
packet populates their richer fields.

---

## 4. Special-cases sweep (2026-06-14) — coverage across ALL of test21's reports

Captured all 10 reports (`scripts/capture-all-reports.js`). Coverage matrix (list → total):
addressList 135, relationshipList 398, criminalList 59, nameList 34, phoneList 34, emailList
28, dobList 13, lienList 11, propertyList 9, **judgmentList 4**, foreclosureList 2,
**professionalList 2**.

Two more SPECIAL CASES found + fixed (real shapes differ from our assumptions):
- **judgmentList** — shares lien record[]/info[] BUT parties differ: `defendant[]`/`plaintiff[]`/
  `attorney` (strings or arrays), NOT `debtor[]`. Old extractor read `rec.debtor` → no party
  shown. Fixed: defendant→debtor fallback; creditor/plaintiff/attorney via partyOrStr (handles
  string OR array); added `stayOrdered`. Verified: "SUPPORT JUDGMENT", debtor JEFFREY TINSLEY,
  creditor TINSLEY KIMBERLY, attorney ALEXANDRA BAUER.
- **professionalList** — totally different shape `{ info{ license{number,state,board,desc},
  status, dates }, person[], business[], address[], phone[], email[], url[] }`. Old extractor
  read flat profession/licenseNumber/issuedDate → **rendered 100% blank**. Rewritten + verified:
  "ALLOPATHIC & OSTEOPATHIC PHYSICIANS - FAMILY MEDICINE", lic 20A7048, board, ACTIVE, person,
  business, address, phone.

**Still UNVERIFIED** (no data in any of test21's reports): bankruptcyList, motorVehicleList,
aircraftList, businessList, employmentList, driverLicenseList, veteranList, sanctionsList,
deathList, socialList, ipList. These extractors are unconfirmed against real shapes — verify
when a packet populates them (the judgment/professional/foreclosure cases prove assumptions break).
