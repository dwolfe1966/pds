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
