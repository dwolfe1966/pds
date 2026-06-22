---
name: security-deps-open-redirect-2026-06-16
description: "RESOLVED 2026-06-22: react-router open-redirect + shell-quote/form-data Dependabot alerts all patched (bump + AdminLoginPage code guard). Bundles rebuilt + pushed."
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

Surfaced by Dependabot 2026-06-16. **FULLY RESOLVED 2026-06-22 (commit `6651702`, pushed)** — owner
OK'd "all of them."

- **react-router (medium ×2) — FIXED.** Bumped `react-router-dom` 6.30.3 → **6.30.4** in root
  (builds both shipped bundles) AND `admin/`. Patch release whose changelog is exactly the
  same-origin open-redirect fix (`//`-prefixed path reinterpreted as protocol-relative → off-site).
  PLUS defense-in-depth code guard in `src/pages/admin/AdminLoginPage.js`: only honor a same-origin
  RELATIVE redirect — `/^\/[^/\\]/.test(raw)` (one leading slash, next char not `/` or `\`) — else
  fall back to `/users`. Rejects `//evil.com`, `/\evil.com`, `scheme://…`.
- **shell-quote (critical) — FIXED.** Root `overrides: {"shell-quote":"^1.8.4"}` (transitive via
  `concurrently`, dev/build-only — never bundled; the "critical" was label, not exposure).
- **form-data (high) — FIXED.** `server/` `overrides: {"form-data":"^4.0.6"}` (transitive via
  `axios`; server = dev mock API, not deployed). server + admin `npm audit` → 0 vulns.

Verification: all 4 packages confirmed at patched versions; full jest suite 335/335 green; bundles
rebuilt → **consumer `public.82f63273.js`, admin `admin.736a8551.js`** (BOTH carry the react-router
patch — redeploy both to apply it at the library level, not just the admin guard).

NOTE (separate, NOT these alerts): local `npm audit` still reports ~22 findings — all **dev-tooling**
transitives (jsdom/jest chain), not shipped, not Dependabot-flagged. Don't `npm audit fix --force`
(can break the build). Triage post-launch if desired.
