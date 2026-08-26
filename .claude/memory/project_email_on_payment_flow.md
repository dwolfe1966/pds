---
name: project_email_on_payment_flow
description: Phone reveal → one-screen email+card checkout (/payment?capture=email); account-creation ordering landmine + Activity replay dependency
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Phone v1 reveal "Unlock" → `/payment?capture=email` (no account yet). PaymentPage renders a single
email field at the TOP of the checkout `<form id="payForm">` (gated `captureMode && !user`), so email +
card are ONE screen with one Pay button (owner rejected a two-step capture). Owner name stays masked on
the payment vCard in captureMode; "Back to Results" → `/phone/search-result`.

**Account is created at submit time**, as the FIRST statement in `handleSubmit`'s flow (`ensureAccount`),
BEFORE the sale — not on a prior screen. Two landmines, both real-money:
- **Ordering:** `ensureAccount` must set `_pendingPw` + `_signupOptin` in sessionStorage BEFORE the sale
  block reads them (~line 434 `_pendingPw`). If it runs after, every account is created password-less →
  **401 on every future login**. Keep `ensureAccount` first; leave the existing `_pendingPw`/`submitUserInfo`
  reads unchanged and the wiring falls out for free.
- **Stale `user` closure:** after `setUser`, React state lags within the same handler tick. Use the
  `createdUser` local (returned by `ensureAccount`) for the sale email AND the post-sale `setUser(rawData.user
  || createdUser || user)` — else a BC response with no user object clobbers `user` to null. `billing.sale`
  itself works because the API token getter falls back to `localStorage.accessToken` (apiRouter ~L129).

`ensureAccount` mirrors `useSignup.submit` (same `api.signup` call) MINUS the standalone-page navigation.
It's a deliberate duplicate — keep in sync. Returning visitor → `USER_ALREADY_EXISTS` → inline "Sign in to
continue" before any charge. KNOWN GAP: an abandoner who already has an auto-gen-password account they never
saw can't sign in (no reset/SendGrid yet) — flagged to owner, not a surprise.

**Activity fix (why phone searches were invisible):** `PhoneLoaderPage` logs via
`visitorSearchLog.appendSearch({type:'phone'})`, but the replay to `/searches/import` lives in
`useSignup.submit`. The email-on-payment path bypasses useSignup, so `ensureAccount` must replay the log
itself or the search never reaches server → `/searches/me` → ActivityPage. ActivityPage + SearchHistoryPage
+ the server import handler all already render `query.phone`; the ONLY gap was the replay. See
[[project_adunit_funnel_review]], [[project_funnel_redesign_2026_07_03]].
