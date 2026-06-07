---
name: shared-apiwrapper-bundles-csr-into-consumer
description: src/services/apiWrapper.js holds the full CSR/admin surface and is unconditionally bundled into the consumer app
metadata:
  type: project
---

`src/services/apiWrapper.js` is a single shared module containing the entire CSR/admin API surface (`getCsrWrapper`, `_viaCsr`, `csrCreateAdminNote`, `csrUpdateAdminNote`, admin endpoint strings like `/database/search`, `/message/admin/findNotes`). It is imported by the consumer via `src/api.js` → `src/services/apiRouter.js` with NO consumer/admin flag guarding the CSR path, so all the vendor strings (`CsrWrapper`, `ByteCrtrs`) and admin endpoints compile into the consumer `build/`.

**Why:** This is the root cause of vendor-string leakage flagged in the 2026-06-01 launch audit — a regression of the `34f18a0` vendor-strip commit. Verified as of consumer bundle `public.aea02ad1.js`.

**How to apply:** When re-auditing, grep `build/public.*.js` for `CsrWrapper|ByteCrtrs`. If still present, the split hasn't shipped. Recommended fix: extract admin/CSR methods into an admin-only module imported solely by `AdminApp`, or guard behind a build-time admin flag so they tree-shake out of the consumer build. See [[vendor-string-leak-vs-console]].
