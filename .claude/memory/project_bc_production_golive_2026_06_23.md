---
name: bc-production-golive-2026-06-23
description: "2026-06-23: BC integration is now LIVE in PRODUCTION — all bugs/feedback are against prod, not dev. Operating guardrails change: probes/demo are dev-only, never persist prod creds, NO mutation probes on prod (real money/customers/PII), live money ops only with owner present."
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

As of **2026-06-23** the IDLookup ↔ ByteCrtrs integration is going **LIVE in production**. From here on,
bug reports and feedback are against **PRODUCTION**, not `dev.admin.www.bytecrtrs.com`. This supersedes
the dev-host assumptions baked into earlier memories and tooling.

**How we work now (guardrails):**
- **All probes + the demo are DEV-ONLY.** Every `scripts/probe-csr-*.js` and `scripts/demo-bc-csr-asks.js`
  hardcodes the dev host + the shared dev account (`frontend@csrManager.pds`, committed); the demo refuses
  non-dev hosts. They do NOT verify prod. To check anything on prod, the **owner supplies prod creds
  per-session via `!`** — NEVER persisted (no `.env.local`, no `.env.production.local`, no
  `settings.local.json` entry, no committed string). The committed dev cred is dev-only; don't confuse it
  with prod.
- **NO mutation probes on production.** cancel / refund / `billing.sale` / `updateSchedule` / setTags /
  user.update etc. against prod = REAL money + REAL customer records. Verify mutation param-shapes
  STATICALLY vs BC docs, never by calling. Live money/mutation operations only with the **owner present
  and explicitly authorizing** (extends the prior "live refund/sale needs owner present" rule to all prod
  writes).
- **Real PII.** Prod responses are real customer data — do NOT dump into `scripts/out/`, logs, or commits
  (unlike the dev test records used this session).
- **Reproduction is read-only by default.** Reproduce prod bugs by reading; write only on explicit owner OK.
- **Deploy candidates now ship to prod:** consumer `public.82f63273.js`, admin `admin.564512bd.js`
  (rebuild before upload; hashes change with any further edit).

Related (now dev-scoped, read with this caveat): [[reference_live_uat_playwright]],
[[bc-getorder-definitive-price]], [[csr-lib-live-evidence-2026-06-17]], the BC asks package + demo how-to.
