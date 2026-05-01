---
name: ByteCrtrs integration boundary — what's wireable vs forced-mock
description: The consumer ApiWrapper IIFE only exposes auth/idLookup/optOut/billing. profile, subscription, alerts, notifications, and password-change cannot be wired until BC expands the IIFE — they remain mock-only.
type: project
---

Consumer-side `window.ApiWrapper` IIFE surface is **bounded**. Only these areas are exposed: `auth`, `idLookup`, `optOut`, `billing`. A grep of the IIFE confirmed there are no methods for profile, subscription, alerts, notifications, or password-change.

**Consequence:**
- Wired against real BC: login, logout, signup, search (name/phone/email), report create/get/list, payment via `commerceBilling/sale`, opt-out search.
- Forced mock until BC expands the IIFE: profile, subscription, alerts, notifications, password-change. Also `REACT_APP_USE_NEW_API_AUTH=false` in `.env`.

**How to apply:** Before proposing "wire X against BC," check whether X is in the wireable list. If not, the only paths forward are (a) wait for BC to expand the IIFE, (b) ship that area against the mock server in production, or (c) bypass the IIFE and call BC HTTP endpoints directly (not how the rest of the app works).

Admin-side is a separate story: it uses the `csrWrapper` IIFE (not `ApiWrapper`). See `bc_admin_api_reference.md`. CSR endpoints currently 403 in production — instrumentation is staged in `src/services/apiWrapper.js` (commit `cddbcec`) to diagnose.
