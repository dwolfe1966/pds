# BC ask — Serve csrWrapper (and api-wrapper) live so fixes propagate without our redeploy

**Raised:** 2026-06-15
**From:** BC (Kwan) — "use the live version only; your packed version goes stale when we fix a csrWrapper bug."

## First, one factual correction
The CSR IIFE is **not** "packed into your main.js." Our admin bundle does **not** import
or inline it — verified: `grep -c CsrWrapper build/public.*.js` = **0** across every
consumer bundle. It is loaded at runtime via a `<script>` tag, exactly as BC intends
(`apiWrapperCsr.js:loadCsrIife` is a no-op when `window.CsrWrapper` already exists).

What *is* true and what Kwan is really seeing: the script tag points at a **self-hosted
snapshot** we serve from our own origin —
`/libs/csr-wrapper/index.iife.js` (and `/libs/api-wrapper/index.iife.js` for the consumer).
So it's not bundled, but it IS a frozen copy: when BC fixes a csrWrapper bug, our copy
stays stale until we re-download and redeploy. Kwan's underlying concern is correct.

## Why we self-host today (not a preference — a constraint)
We originally pointed at BC's upstream URLs and they were broken:
- **cert mismatch** on `dev.www.bytecrtrs.com` (cert only covers
  `dev.admin.www.bytecrtrs.com` / `dev.gwhubadmin.www.bytecrtrs.com`)
- **502** on `dev1.dev.www.bytecrtrs.com`

So we copied the IIFE into `/libs/...` and load it same-origin (valid cert, no CORS).
The trade-off is exactly the staleness Kwan flagged.

## What we need from BC to "use live only"
Give us a **stable, same-origin, valid-cert URL** that always serves BC's latest
csrWrapper, and we'll point the admin `<script>` tag there and delete our snapshot.
Since the admin app is served from BC's hosting, the clean answer is for BC to serve the
wrapper from that same origin, e.g. `https://dev.admin.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js`,
kept current on BC's side. Confirm:
1. The exact URL (must be on a cert we're served under — no `dev.www.bytecrtrs.com`).
2. That it's the always-latest build (so a csrWrapper fix is live without our redeploy).
3. Cache headers (so a fix isn't held by a long-lived CDN/browser cache).

Same applies to the consumer `api-wrapper` if BC wants that live too.

## Our side once BC confirms the URL
- Point `admin/public/index.html` + `build-admin/index.html` `<script src>` at BC's URL.
- Update `CSR_IIFE_CANDIDATES` in `apiWrapperCsr.js` (currently `['/libs/csr-wrapper/index.iife.js']`)
  to try BC's live URL first, keep the self-hosted snapshot as an offline fallback.
- (Optional, no BC dependency) a deploy-time fetch of the latest IIFE into `/libs` would
  make our snapshot current-as-of-deploy — a stopgap, but it's snapshot-at-deploy, not
  truly live, so BC's same-origin URL is the real fix.

## Status
Investigated, not edited — admin/CSR change, and we must not drop the self-hosted copy
before BC confirms a working live URL (doing so would break the admin app exactly when
BC's direct URL is unreachable — which is why we self-host in the first place).
