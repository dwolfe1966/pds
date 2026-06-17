---
name: csr-auth-state-2026-06-16
description: "CSR login state 2026-06-16: csrManager role-gate fixed in apiRouter; both available BC accounts blocked (csrManager 403 on data, admin@admin.admin login 401); lib method does NOT bypass the 403."
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

CSR/admin app auth investigation 2026-06-16. The deployed admin app is `src/AdminApp.js`
(build-admin) — it reuses the CONSUMER `AuthContext` → `apiRouter` login (NOT
admin/src/csrApiService.js), and gates on `role === 'admin'` in 3 places (AdminLoginPage,
AdminRoute, isAdmin). The mapped `role` comes from `apiRouter.js` login case.

**FIXED (commit 236ebeb):** BC returns CSR staff with `roles:['csrManager']` (verified live:
`frontend@csrManager.pds`). apiRouter only promoted exact `'csr'`/`'admin'` → csrManager
mapped to `'member'` → "Access denied. Admin credentials required." Now matches any
`admin*`/`csr*` role (+ optional `REACT_APP_ADMIN_ROLES` env list). Lands in next build-admin
upload (admin.8261333d.js built, NOT deployed). NOTE: flattens all csr*/admin* roles to full
`'admin'` UI access; rawUser.roles preserved for future per-tier gating — revisit if BC wants
csr vs csrManager vs admin to differ.

**STILL BLOCKED — BC-side, not our code (doc: BC_CSR_ACCOUNT_PROVISIONING.md):**
- `frontend@csrManager.pds`: login 201, but `/api/database/search` → 403 "Forbidden resource".
  Its BC permission set is "Frontend dev's" (only `/api/shape/management/*`; blocks shape
  collection search). NOT a CSR profile.
- **`admin@admin.admin` login now 401** — old known-good CSR account is dead/rotated at BC.
  So currently NO account both logs in AND reads CSR data — CSR is down for everyone.

**Lib-method hypothesis REFUTED:** tested `csrWrapper.api.user.find` vs direct `_csrPost`
on the same authenticated csrManager session — BOTH 403 identically. Permission guards reject
on the principal, not the transport. Migrating csrFindUsers to the lib method would NOT fix it.
See [[csr-direct-endpoint-csrwrapper-library-migration-map]].

**No positive control:** every available account fails, so we have NOT confirmed any valid
account can read /database/search. Need ONE known-good CSR account from BC to verify the
role-gate fix end-to-end and give BC a working-vs-broken contrast.

Probes (read-only, creds via env): `scripts/probe-csr-login-response.js`,
`scripts/probe-csr-libmethod-vs-direct.js`. Supersedes nothing in [[launch-state-2026-06-06]]
but adds the CSR-auth blocker.

**UPDATE 2026-06-16 (later) — BC PARTIALLY relaxed; login now 200.** Re-tested
(`scripts/probe-csr-collections.js`, `scripts/probe-csr-dedicated-endpoints.js`). csrManager
login = 200. /database/search error changed from "Forbidden resource" to per-collection
"Invalid Database Search Role".
- **WORKS now (201+data):** `users` (customer search), `users` isAdmin (CSR reps),
  `trackings` (Searches/Reports/Logins tabs). Plus dedicated endpoints all OK:
  `/user/management/detail` (open customer 201), `/commerceMgmt/userOrders` (Orders tab 201),
  `/contactMessage/admin/find` (Tickets inbox 200/20), `/message/admin/findNotes` (reachable;
  400 = bad params not 403).
- **STILL 403 "Invalid Database Search Role" (5 collections):** `commerceOrder` (global order
  search — but per-customer orders work via the dedicated endpoint), `optOutRequest` (Data
  Removal list), `managedContact` (Unsubscribe list), `userContact` (all-user-contacts
  enumeration), `contact` (Visitor contacts list).
- Core customer workflow (search → open → orders → tickets → tracking) is UNBLOCKED. Remaining
  gaps = standalone list views (data-removal, unsubscribe, visitor-contacts) + global order search.
- **STILL TO DEPLOY:** role-gate fix — now bundled with the lib migration as
  `admin.4273569c.js` (supersedes 8261333d). Until uploaded, the LIVE app blocks csrManager
  at the login screen even though BC now permits the data.

**LIB MIGRATION (BC wants NO direct endpoint calls) — doc: BC_CSR_LIB_METHOD_GAPS.md.**
Gate = result-EQUIVALENCE (lib vs direct, same query incl. filtered → same _id set+count),
NOT shape-match (findAdmin shape-matched but returned 0 docs). Probes:
`probe-csr-iife-surface.js` (live IIFE method tree), `probe-csr-shape-compare.js`,
`probe-csr-equivalence.js`, `verify-csr-migration-ui.js` (E2E via serve-admin-prod).
- **DONE (commit 03983be, lib-first via _viaCsr + direct fallback; equivalence GREEN + E2E UI
  verified):** csrFindUsers→`user.find`, csrFindUserOrders→`user.findOrders`,
  csrFindOrderPayments→`user.findOrderPayments`, csrFindOrderHistories→`user.findOrderHistories`.
- **DONE round 2 (commit 7dcf942; equivalence GREEN incl. inbox field-set + lastId paging;
  UI-verified):** csrGetUserOrder→`user.getOrder`, csrFindContactMessages→`message.contact.find`,
  csrFindContactHistories→`message.contact.histories`, csrGetContactReplyLinkUrl→`message.contact.replyLinkUrl`.
  → All 8 verifiable List-A reads now lib-first (direct fallback retained). Admin bundle rebuilt
  (supersedes 4273569c; rebuild before deploy). Probe: `probe-csr-equivalence-2.js`.
- **List C — lib EXISTS but BROKEN, BC must FIX (kept direct):** `user.findAdmin` (0 vs 10),
  `tracking.findUser` (0 vs 100; scopes to caller not target user).
- **List B — NO lib method, BC must ADD:** global commerceOrder finder; all-user + per-user
  `userContact` finder; `contact` finder; `billing.sale`; `offer.findByShmName`;
  `contact.changeContactToUserContact`.
- Still can't verify (collections 403): `optOut.find`, `managedContact.find` — kept direct,
  migrate in the same step that verifies post-grant.
