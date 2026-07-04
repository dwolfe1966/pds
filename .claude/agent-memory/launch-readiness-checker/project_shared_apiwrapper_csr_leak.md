---
name: shared-apiwrapper-bundles-csr-into-consumer
description: src/services/apiWrapper.js holds the full CSR/admin surface and is unconditionally bundled into the consumer app
metadata:
  type: project
---

`src/services/apiWrapper.js` is a single shared module containing the entire CSR/admin API surface (`getCsrWrapper`, `_viaCsr`, `csrCreateAdminNote`, `csrUpdateAdminNote`, admin endpoint strings like `/database/search`, `/message/admin/findNotes`). It is imported by the consumer via `src/api.js` → `src/services/apiRouter.js` with NO consumer/admin flag guarding the CSR path, so all the vendor strings (`CsrWrapper`, `ByteCrtrs`) and admin endpoints compile into the consumer `build/`.

**Why:** This is the root cause of vendor-string leakage flagged in the 2026-06-01 launch audit — a regression of the `34f18a0` vendor-strip commit.

**UPDATE 2026-06-22 (consumer bundle `public.82f63273.js`):** The *bundle* now shows **0** occurrences of `CsrWrapper`/`csrWrapper`/`ByteCrtrs`/`/database/search`/`/contactMessage/admin` (down from the 17× reported 2026-06-01). BUT this is NOT a durable architectural fix — the architectural root cause is UNCHANGED. The strings are still all over *source* (`grep -rE "CsrWrapper|ByteCrtrs|_viaCsr" src/` → 80+ hits; the `csrWrapper`/`ByteCrtrs` literals in `apiWrapper.js` live in JSDoc/comments at lines 781/785/904). They vanish from the bundle because (a) minification strips comments and (b) the admin IIFE loaders (`getCsrWrapper`/`loadCsrIife`/`window.csrWrapper`/`admin.html`) tree-shake/dead-strip out since no consumer page calls any `csr*`/admin method. What STILL ships into the consumer bundle: the generic `_csrPost` (×10) / `_csrGet` (×2) helper bodies and the `/admin/*` endpoint path-map in `apiRouter.js:850+` (admin-users, admin-purchases, admin-cs-reps, etc.) — dead code, low severity. Because the leak-suppression is incidental (comment-strip + dead-code-elim), a future refactor that references a vendor name in live code, or a consumer page that calls a csr method, would regress it silently. The owner-approved durable fix (split csr methods into an admin-only module) has NOT happened.

**How to apply:** When re-auditing, grep `build/public.*.js` for `CsrWrapper|ByteCrtrs`. Currently 0 but FRAGILE — report as "passing but not durably fixed," not "resolved." Durable fix unchanged: extract admin/CSR methods + the `/admin/*` path-map into an admin-only module imported solely by `AdminApp`/`admin-index.js`, so they can't regress into consumer. See [[vendor-string-leak-vs-console]].
