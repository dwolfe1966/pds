---
name: project_report_detail_expose_all
description: "Report-detail expose-all status — verified lists, special cases, deploy + blockers"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7cf476e3-95d5-4760-901e-3e85bff7c6de
---

Consumer report detail (`SearchResultDetailPage.js` + `reportExtract.js`) — applying
[[feedback_expose_all_report_data]] ("EXPOSE ALL DATA WE GET"). Field map + shapes:
[[bc_report_field_map]] / `docs/BC_REPORT_FIELD_MAP.md`.

**Done & VERIFIED against real packets (2026-06-14), all owner-confirmed working:**
- Criminal: charge name fixed (was blank — offense.description empty on COURT rows; charge is
  in parallel crime[].offense.description). offense[]/crime[] are parallel SETS, NOT index-
  aligned (swapped) → each charge row built wholly from one source, deduped. Bare court-docket
  rows backfill the charge from any same-case row (normalized case OR shared ≥6-digit core),
  within+across records. Exposes court/county/plea/fines/caseType/code/all dates.
- Property: history exposes salesPrice/loan(value,type,rate÷100)/transferType/docNumber/flags/
  current-owner; card adds land+improvement value, subdivision, legal desc, owner mailing.
- Financial special cases: foreclosure has its OWN shape (detail[] auction/trustee/beneficiary/
  amounts + trustor[]) → `extractForeclosures`. judgment shares lien record[]/info[] but parties
  are defendant[]/plaintiff[]/attorney (string OR array), not debtor[] → fixed. professional was
  a TOTALLY different shape (info.license{} + person/business/address/phone) → was 100% blank,
  rewritten.

**DEPLOY STATE:** owner deployed `10494bd9` (criminal+property+financial+backfill). The
judgment+professional commit **`d57752b7` is NOT deployed yet** — deploy it next session.

**Capture tooling** (need a headed login; `.smoke.env` MEMBER_PWD is STALE — only owner's manual
login works): `scripts/capture-ojreport.js` (direct IIFE `getReport({commerceContentId})`),
`capture-all-reports.js` (coverage matrix over all of test21's reports),
`capture-new-subjects.js` (real search→create, bails on teaser-only). Packet path:
`commerceContent.raws[0].transient.identities[0]`. O.J. report id `6a25df363ee3447608a236a7`.

**UNVERIFIED lists — BLOCKED on data:** bankruptcyList, motorVehicleList, aircraftList,
businessList, employmentList, driverLicenseList, veteranList, sanctionsList, deathList. None of
test21's 10 pre-seeded reports populate them, and **test21 can't CREATE new reports** — clicking
a result routes to /payment (create needs `subscription.status==='active'`), so fresh searches
yield only teasers. To verify: (a) make test21 sub-active/credit-capable + re-run, (b) a
different credit-capable account in `.smoke.env`, or (c) ask BC for sample packets exercising
each shape (recommended — zero captcha/credits). Lesson: assuming a shared list shape silently
breaks special cases (foreclosure/judgment/professional all proved it) — verify per-list.
