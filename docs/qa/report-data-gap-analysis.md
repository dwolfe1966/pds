# Report data gap analysis — what BC returns vs. what we render

**Method:** captured OUR real `/idLookup/report/detail` payloads as a logged-in paid
member across 7 saved reports (2026-06-07), built a field inventory of what BC actually
returns per category, then diffed it against the extract layer (`src/utils/reportExtract.js`)
and the render layer (`src/pages/member/SearchResultDetailPage.js`). Companion:
`report-breadth-comparison.md` (the old-site comparison that kicked this off).

**Verdict:** BC returns a very rich payload (`transient.identities[0]`, 40+ categories).
Every gap below is **ours** — a field we receive but drop in extract and/or render.
None require a BC change. Two layers drop data: `reportExtract` (doesn't keep a field) and
the card/table render (keeps it but doesn't show it).

Legend: **BC** = present in our captured response · **Extract** = kept by reportExtract ·
**Render** = shown in the UI.

---

## P1 — high value, do now

### 1. Address History  *(owner-flagged #1)* — `SearchResultDetailPage.js:346`
| Field | BC | Extract | Render |
|---|---|---|---|
| street/city/state/zip | ✓ | ✓ | ✓ |
| dates (firstSeen/lastSeen/dateRange) | ✓ | ✓ | ✓ |
| **county** | ✓ | ✓ | ✗ ← dropped in UI |
| **ownership** (Owner/Renter) | ✓ | ✗ | ✗ |
| **zip4** | ✓ | ✗ | ✗ |
| predir/postdir/aptName/aptNum (parsed street) | ✓ | ✗ | ✗ |
**Fix (shipped):** render County + ZIP+4; richer rows with residence **duration**
(~6.3 yrs), apartment/unit, and a **map** link. Verified OldCo's per-address data is the
**same scalar field set we already carry** (`county, zip4, dateRange, ownershipStatus,
lat/long, parsed street, apt`) — we actually hold a **superset** (we also have
firstSeen/lastSeen, CASS, frequency). So address depth is a presentation matter, now closed.
**Lone open item:** `ownership`/`ownershipStatus` is a single-char code (`P`/`C`) on BOTH
sites — undocumented. Need BC's **code legend** to safely label Owner/Renter per address
(not guessing in a published report). Small, legitimate BC ask.

### 2. Criminal Records — `reportExtract.js:273`, `CriminalCard:809`  *(BIGGEST un-flagged gap)*
We keep only charge/court fields (offense date, charges-filed, code, description, counts,
disposition, source). BC's `criminalList[i]` ALSO carries, all **dropped at extract**:
| Field BC returns | Value for an inmate-search product |
|---|---|
| **photo** (mugshot) | the single most compelling element |
| **sexOffender** (flag) | high-intent signal; we have a separate registry check but not per-record |
| **bodyMark** (scars / marks / tattoos) | physical identification |
| **vehicle** | associated vehicle(s) |
| **name / age / dob / address** (on the record) | identity confirmation |
**Fix (shipped):** criminal extract now keeps the offender **name** and a full **physical
description** — sex, race, **height, weight, hair, eyes, skin tone, birth state** — rendered
as a "Description" line per record. Verified on the live O.J. Simpson report (populated on
all 44 entries).
**Findings from real data (BC questions, not client fixes):**
- **Mugshots:** BC returns a `photo` field but it is **empty on every record** (O.J.
  included) — no images in our feed. *(BC ask: are criminal booking photos available?)*
- **Sentence / release dates:** present in schema but **sparsely populated** in our feed.
  *(BC ask: completeness of incarceration lifecycle data.)*
- **Sex-offender flag:** the per-record `c.sexOffender` object is **present-but-empty on
  non-offenders** — we deliberately do NOT render a per-record badge (false-positive /
  defamation risk); the dedicated Sex Offender Registry section is authoritative.

### 3. Property Records — `reportExtract.js:336`, `PropertyCard:769`  *(extract reads WRONG keys)*
BC's `propertyList[i]` is **nested**: `{ owner[], history[] (buyer/seller sale history),
foreclosure, assessment{}, detail{}, address{}, mailingAddress }`. Our extract reads **flat**
keys (`p.apn`, `p.purchasePrice`, `p.assessedValue`, `p.bedCount`…) that don't exist in the
real shape → PropertyCard renders little/nothing despite rich data.
**Fix:** rewrite property extract against the real nested shape — assessed value, last sale
(price+date+buyer/seller), owner name, foreclosure flag, beds/baths from `detail`.

---

## P2 — medium value

### 4. Financial / Liens  *(owner-flagged #2 — already partly shown)* — `reportExtract.js:299`, `FinancialRecordCard:834`
We DO render liens/judgments/foreclosures/bankruptcies (description, recording date, doc #,
county/state, creditor, issuing agency, debtor). Dropped at extract: **lienType**,
**courtCaseNumber**, **taxCertificationNumber**, **taxPeriodMin/Max**, associated
**property**/**business**, **hoaAddress**, FIPS.
**Fix:** add lienType, court case #, tax period to FinancialRecordCard.

### 5. Phones — `reportExtract.js:150`, render `:377`
BC returns `disconnected`, `business`, `fake`, `highFrequency`. We extract disconnected/business
but the render doesn't surface them; `fake`/`highFrequency` dropped.
**Fix:** show "Disconnected" / "Business line" tags on phone rows.

---

## P3 — low / secondary

### 6. Relatives — `reportExtract.js:200`
We capture per-relative `phones` from `relationshipList` but the render shows name/relationship/
age/location only. **Fix:** optionally show relative phone(s).

### 7. Category parity (possible — and only — genuine BC ask)
Old-site `processed.person` lists `evictions, marriages, divorces, akas, feins`. Our identity
exposes 40+ lists but these specific ones weren't observed (akas ≈ our `nameList` aliases).
If product wants evictions/marriages/divorces and BC doesn't return them under any key, that's
the lone candidate BC request — secondary to everything above.

---

## Fix scope (this round)
P1 (#1 address, #2 criminal, #3 property) + P2 (#4 financial fields, #5 phone tags). All
client-side in `reportExtract.js` + `SearchResultDetailPage.js`. No BC dependency, no new
endpoints. Update `reportExtract.test.js` for the new extracted fields.
