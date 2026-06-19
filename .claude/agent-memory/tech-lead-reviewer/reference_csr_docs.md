---
name: reference-csr-docs
description: Which CSR docs are authoritative, and the brandId data model for CSR collections
metadata:
  type: reference
---

**Source of truth for CSR BC asks:** `docs/BC_CSR_ASKS_PACKAGE.md` (consolidated 6-ask
package). It SUPERSEDES `docs/BC_CSR_LIB_RESPONSE_MESSAGE.md`, which carries a "SUPERSEDED
2026-06-18 — do NOT send to BC" banner at the top. When the two conflict, trust the asks
package. Example: RESPONSE_MESSAGE 3.1 said "findAdmin returns 0, BC must fix"; the asks
package corrected it to "our brandId bug, fixed in csrFindCsReps, no BC action."

**brandId data model (CSR collections):**
- Customer/order/optOut collections (users, commerceOrder, optOutRequest) → `brandId:'idlookup'`
- CSR/admin staff live in the `admins` collection with `roles:['csr']` and
  `brandId:'bytecrtrs'` (NOT idlookup). So csrFindCsReps must NOT pass an idlookup filter.

This brand split is correct per BC but lives only in scattered code comments — it's caused
regressions (commit 181513e fixed one). Treat any brand-filter change in the CSR layer as
high-caution. See [[patterns-viacsr]].
