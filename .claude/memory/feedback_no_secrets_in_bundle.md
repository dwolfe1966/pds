---
name: Never bake the BC captcha password into the consumer or admin bundle
description: Hard rule — never use .env.production.local or .env.local to embed REACT_APP_NEW_API_CAPTCHA into a build that could be deployed
type: feedback
originSessionId: 99b4513c-d322-4f20-865d-5c6f0d43d17e
---
Never bake `REACT_APP_NEW_API_CAPTCHA` (the BC dev captcha password) into a built bundle that could end up on staging or production. The `.env.production` file ships with this var **empty** intentionally — don't override it via `.env.production.local`, `.env.local`, or inline edits to other env files, even for "local-only" testing.

**Why:** On 2026-05-11 the password was baked into `public.427822b3.js` to unblock a local captcha test, and that bundle was then deployed to `dev.www.idlookup.ai` via FileZilla — exposing the BC dev password in plaintext to anyone who opened DevTools. The owner asked for a hard rule against this pattern going forward.

**How to apply:**
- Don't suggest creating `.env.production.local` / `.env.local` with the captcha password as a "local testing workaround" — that file leaks the moment any build is uploaded.
- If a captcha challenge blocks a flow, escalate to BC (relax the captcha for authed sessions, or migrate to `turnstile.v0`) instead of papering over with an embedded password.
- For diagnosing captcha behavior in dev, use the IIFE's built-in modal (it pops a prompt for `password.v0`) — that keeps the secret in the developer's head, not the bundle.
- Postbuild guardrail at `scripts/postbuild.js` (added 2026-05-11) refuses to ship a `build/` that contains the password — if it triggers, fix the env, don't bypass the check.

Related: `project_production_architecture.md` (manual FileZilla deploy → bundle leaks reach production).
