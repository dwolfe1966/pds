---
name: security-deps-open-redirect-2026-06-16
description: "Pre-launch security: react-router open-redirect (reachable via AdminLoginPage redirect param) + shell-quote critical (transitive build dep). Awaiting owner ack to bump."
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

Surfaced by Dependabot on push 2026-06-16 (3 open alerts). NOT yet fixed — owner ack needed
before bumping deps (repo rule).

- **react-router (medium ×2) — SHIPPED + reachable, fix this.** Open-redirect: a same-origin
  redirect to a `//`-prefixed path is reinterpreted as a protocol-relative URL → off-site.
  Concretely reachable: `src/pages/admin/AdminLoginPage.js` does
  `navigate(searchParams.get('redirect') || '/users')`, so `?redirect=//evil.com` could redirect
  off-site after login. Check member `ProtectedRoute`/login redirects too. Fix = bump react-router
  to the patched version (+ optionally sanitize redirect params to same-origin/relative only).
- **shell-quote (critical) — low real risk.** Transitive **build-tool** dep (Parcel toolchain),
  not in the shipped browser bundle. quote() newline-escaping bug. Easy bump, but not a runtime
  exposure for the SPA. Launch-state memory previously noted "2 moderate Dependabot (post-launch)";
  the critical is this build-only dep.

Recommended next action: bump react-router (shipped, reachable) + shell-quote, rebuild, verify
admin login still redirects correctly. See [[project_csr_auth_state_2026_06_16]] for the bundles
in flight.
