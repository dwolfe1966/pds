---
name: bc_report_field_map
description: Real BC report packet path + criminal/property field inventory; full map in docs
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7cf476e3-95d5-4760-901e-3e85bff7c6de
---

Full report packet (from `getReport({ commerceContentId })` → GET
`/api/idLookup/report/detail/:id`) nests the data at
**`commerceContent.raws[0].transient`** → `{ identities[], fullContact, familyWatchdog }`.
`reportExtract.extractAll(transient)` reads `identities[0]`.

Capture tooling: `scripts/capture-ojreport.js` (headed login as test21, calls the IIFE
`api.idLookup.getReport({ commerceContentId })` directly — bypasses flaky React nav).
test21's reports are FICTIONAL demo data but use BC's real field shapes. O.J. report id
`6a25df363ee3447608a236a7` is record-rich (12 criminal records, 4 properties w/ history).

Charge name = `offense.description`; blanks on COURT-category rows where the charge lives in
`crime[].offense.description` (array). offense[]/crime[] are parallel SETS but NOT
index-aligned (swapped) — never mix charge↔disposition across them. Property `history[].detail`
carries salesPrice/transferType/docNumber/quitclaimFlag/armsLengthFlag; `history[].loan` has
loanValue/loanType/estimatedInterestRate (÷100 for %).

**Full field inventory + extractor gaps: `docs/BC_REPORT_FIELD_MAP.md`.** Applies
[[feedback_expose_all_report_data]].
