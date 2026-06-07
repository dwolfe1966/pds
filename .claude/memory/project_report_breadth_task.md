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

**Hypothesis (most likely):** BC's report API already RETURNS this data; our report-detail
UI/adapter just doesn't render it (we're dropping fields). "Same API + data provider" points
to a display gap, not a data-source gap. Confirm by comparing BC's raw report response vs what
our report component renders.

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
