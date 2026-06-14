---
name: feedback_expose_all_report_data
description: Report detail must expose EVERY field BC returns — no attribute is too minor
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7cf476e3-95d5-4760-901e-3e85bff7c6de
---

RULE (owner, 2026-06-14): In consumer report detail, **EXPOSE ALL DATA WE GET**. No
attribute is too unimportant to show. The only acceptable omissions are irrelevant
proprietary IDs (obfuscated extIds, internal _ids) — and even those lean toward showing.

**Why:** the report is the paid product; completeness is the value. Cherry-picking a curated
subset of BC's packet (the old `reportExtract.js` pattern) silently drops data the customer
paid for and makes our report look thinner than the underlying BC data actually is.

**How to apply:**
- `reportExtract.js` must surface every field on every list BC returns under
  `commerceContent.raws[0].transient.identities[0]` (criminalList, propertyList,
  bankruptcyList, lienList, judgmentList, foreclosureList, arrestsList, motorVehicleList,
  aircraftList, businessList, professionalList, driverLicenseList, veteranList, etc.).
- Render must actually display extracted fields — extracting without wiring JSX shows nothing.
- When adding a section/field, default to INCLUDE; don't pre-filter on "is this useful."
- Field shapes/paths verified against a real packet: see [[bc_report_field_map]] /
  docs/BC_REPORT_FIELD_MAP.md. Charge name = offense.description (+ crime[] fallback, kept
  whole-row to avoid charge↔disposition mismatch); property history carries salesPrice/loan/
  transferType/docNumber we weren't showing.
- Numeric scaling gotcha: BC `estimatedInterestRate: 370` = 3.70% (÷100). salesPrice/loanValue
  are whole dollars (1387500 = $1,387,500).
