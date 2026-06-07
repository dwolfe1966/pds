---
name: project_report_breadth_task
description: Evaluate report-detail data breadth vs the old people-search site (same BC API/data provider) — more per-address + financial (lien/bankruptcy)
metadata: 
  node_type: memory
  type: project
  originSessionId: 7aeba5ca-a8fd-4f98-b2f1-d4e52b390ce2
---

Task opened 2026-06-07 (owner). A BC staffer noted the PREVIOUS people-search company,
using the **same BC API + same data provider**, surfaced MORE in report detail than
IDLookup.ai does. Two named gaps:
1. **More information per previous address** (per-address detail breadth).
2. **More financial info** — liens, bankruptcies, judgments, etc.

**RESOLVED 2026-06-07 — it's a DISPLAY gap, not a data/BC gap.** Full writeup:
`docs/qa/report-breadth-comparison.md`. Captured our own `/idLookup/report/detail` as paid
member test21 across 7 saved reports. Our `raws[].transient.identities[0]` already carries:
per-address `county`+`ownership`+`zip4`+`dateRange`+lat/long; POPULATED `lienList` (one
subject: 3 liens, deeply detailed — caseDescription/docNumber/recordingDate/taxPeriod/
issuingAgency/debtor) + 40+ categories. Old site uses a different endpoint shape
(`/api/commerce/customer/find/contents` → `tempClient.processed.person`) but equivalent data.
Our UI just renders street/city/state/zip+dates per address and drops county/ownership.
**Fix = client-side:** surface county/ownership/zip4 in the address table; audit
FinancialRecordCard field coverage. NO BC ask needed for the 2 named gaps. (Possible
secondary BC ask: evictions/marriages/divorces/akas categories — confirm if absent.)
Creds used at runtime via env only; never stored.

**FIX SHIPPED 2026-06-07 (`61ff71d`, bundle `public.969b1fb8.js`):** full gap analysis in
`docs/qa/report-data-gap-analysis.md`. Surfaced in report detail (all client-side):
address County+ZIP4; criminal mugshot(url-guarded)+name+commitment/conviction/release dates+
sentence+marks+vehicle (inmate lifecycle); property extract REWRITTEN to BC's nested shape
(assessment/detail/owner/history → assessed/market value, beds/baths, ownership, last sale —
card was ~blank before, flat keys); financial lienType/courtCase#/taxPeriod; phone Business/
Disconnected. +6 extract tests (324 total). Verified extract AND render against 7 real captures
via local prod bundle. NOT yet deployed. Other gaps found beyond owner's 2: criminal mugshot/
incarceration (biggest), property-blank bug, phone flags. Lone possible BC ask: evictions/
marriages/divorces categories (unconfirmed). Address-level `ownership` P/C code left unmapped
(undocumented legend) — surfaced ownership via property records instead.

**(Original hypothesis, confirmed):** BC already RETURNS the data; our UI dropped fields.

**Reference comparison the owner gave:** O.J. ("Orenthal") Simpson report.
- Ours: generate/view on IDLookup.ai (report detail).
- Theirs: a member loginLink (magic-link, pre-auth) to the SAME report on the OLD site
  `inmatessearcher.com/member/loginLink/<token>` — token in the 2026-06-07 conversation
  (NOT stored here; it's a bearer token). inmatessearcher.com is one of the old/competitor
  domains some Ads campaigns still point to — see [[project_ads_conversion_2026_06_07]].

**Approach:** (a) load the competitor loginLink (Playwright, read-only) and capture its report
section/field structure; (b) inspect our report rendering (reportService/apiAdapter + report
detail component) and BC's report response shape; (c) list fields BC returns that we don't show
— esp. per-previous-address + financial; (d) propose surfacing them. Keep in mind
[[feedback_bc_is_source_of_truth]] and [[bytecrtrs_api_reference]].
