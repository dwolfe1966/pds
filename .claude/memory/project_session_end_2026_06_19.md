---
name: session-end-2026-06-19
description: "End-of-session 2026-06-19: CSR fixes shipped (_viaCsr safety+shape-guard, product-quality A/B/C+🟡+polish, CS-reps, tickets user-mode); deploy candidate admin.5613cbd9.js; BC asks unchanged (A offer/B billing.sale/C commerceOrder + userContact confirm); deferred items + cautions."
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

Pick-up state as of 2026-06-19 (see also [[csr-lib-live-evidence-2026-06-17]], [[bc-consumer-feature-asks]]).

**DEPLOY STATE:** owner deployed `admin.37df5409.js` mid-session. The current built candidate is
**`build-admin/admin.5613cbd9.js`** (+ `admin.1aa63320.css`) — carries everything since: `_viaCsr`
mutation-safety + wrong-shape guard, product-quality A/B/C + 🟡 batch + polish (19.a), CS-reps fix,
tickets user-mode fix. All HARDENING/POLISH, no launch-blockers → deploy when convenient. Rebuild
before upload (hash will match if no further edits).

**SHIPPED THIS SESSION (committed to main, NOT pushed):**
- `_viaCsr`: fall back only on absent-method/load-fail; on post-send THROW fall back only for idempotent
  reads (retryOnError default true); 14 mutating callers `{retryOnError:false}` (no double sale/refund);
  + `opts.validate`/`_isUsableList` on 8 list reads so a wrong-shape lib success falls back instead of
  silently emptying the UI.
- Product-quality: XSS killed (no dangerouslySetInnerHTML in src/pages/admin), refund confirm dialog,
  error-vs-empty + retry across EmailTickets/MyDashboard/UserDetail/DataRemoval, NOORDERID-leak fixed,
  dead Zip/CC columns + skeleton, CsRep error/empty gating, dead password-reset button removed,
  friendlyError() hides raw mongo/cast errors, Orders/Purchases amount parity (getOrderCollected),
  Unsubscribe per-row errors, plain-language copy, admin login/landing → IDLookup green (19.a).

**BC ASKS — unchanged 2026-06-19 (ran demo live, BC dev back up, NO flips):**
A offer (403 "No offer." CSR / resolves consumer / no csr offer ns), B CSR billing.sale (absent;
consumer sale no payerId), C commerceOrder global (403 all brands), + CONFIRM userContact data model.
Full listing w/ use-case·pages·not-working·lib-calls: `docs/BC_CSR_ASKS_PACKAGE.md` +
`docs/BC_CSR_DEMO_HOWTO.md` (owner pasted the listing there). Consumer roadmap asks (WISFY 1-cap,
Alerts 4-cap): `docs/BC_CONSUMER_FEATURE_ASKS.md`. Demo: `scripts/demo-bc-csr-asks.js` (default dev
account; VERBOSE=1). `bc-asks-register` agent owns the register — run it next session to re-check flips.

**DEFERRED / OPEN:**
- #22 hex→design-tokens refactor (MyDashboard/EmailTickets/Analytics inline hex) — large, no
  user-visible change; deferred.
- Live refund + CSR billing.sale end-to-end test — needs REAL money; do only with owner present.
- WISFY/Alerts — fully BC-blocked roadmap.

**CAUTIONS (learned this session):**
- Do NOT execute mutation probes "with fake ids" — cancel/updateSchedule returned 200 on nonexistent
  ids (no real record hit, but it's still executing a write). Verify mutation param-shapes statically
  vs BC's required fields, not by calling.
- brandId trap: consumer brand = `idlookup`; staff/admin records = `bytecrtrs`. A wrong brand filter
  silently returns 0 / wrong set (this was the findAdmin false-alarm).
- Demo-gate: an ask only goes to BC if the live demo verdict matches the claim.
- Agents `bc-asks-register` + `product-quality-reviewer` are native next session (.claude/agents/).
