# BC ask — getAutoLoginUrl (CSR impersonation) — 2026-07-21

BC shipped `csrWrapper.api.user.getAutoLoginUrl({ userId, redirect? })` →
`{ url: "https://…/api/auth/loginLink?loginHash=…&clientId=…&apiId=…" }`. We're wiring it for **CSR
impersonation** ("log in as this customer to troubleshoot"). Generator half is BUILT (admin app); the
consumer **session-adoption** half is held pending the answers below.

## The linchpin question (blocks the consumer half)
When a CSR opens the `loginLink` URL, BC's server logs in and redirects to the SPA `redirect` path. Our
consumer app hydrates auth from a **JWT in `localStorage`** (via `AuthContext`) — it does NOT currently
adopt a server session. So:

1. **Does a no-arg `apiWrapper.api.auth.login({})` return a full `{ accessToken, user }` for a live
   loginLink session, or only a status/boolean?** (The HowTo says calling `login` with no
   username/password "checks if the user's session is already logged in on the server" — that reads like
   a *status check*, not a token issuer.) We need a real `accessToken` to hydrate `AuthContext` /
   `ProtectedRoute`. If it doesn't return one, what's the intended way for an SPA to pick up the loginLink
   session?

## Security questions (needed before the emailed-magic-link variant)
2. **TTL** — how long is a `loginHash` valid?
3. **Single-use** — is it consumed on first visit, or reusable until TTL?
4. **Revocable** — can we invalidate an outstanding link?
5. **Audit** — does BC log impersonation server-side (which CSR `apiId` minted/used it)? (We also write a
   local CSR audit note — WITHOUT the URL.)

## Dev test the owner can run now (generator is live)
On the admin app, open a customer → **"Log in as user"** (admins only). It mints the URL, writes an audit
note, and opens the URL in a new tab (redirect `/dashboard`). Observe:
- **(a)** After the redirect, is the SPA logged in through *any* existing path? (Our API calls use
  `credentials:'include'`, so cookie-auth may carry data calls even while the UI shows logged-out — that
  would make this a **UI-hydration** problem, not a token problem.)
- **(b)** In DevTools console, what does a no-arg login return there? e.g.
  `window.ApiWrapper && (await window.ApiWrapper.getInstance()).api.auth.login({})` — inspect for an
  `accessToken`/`user`.

Findings from (a)/(b) decide the adoption route design (build to reality, not the doc).

## Build state
- ✅ `apiWrapperCsr.csrGetAutoLoginUrl` · `admin-auto-login-url` route · `api.adminGetAutoLoginUrl`
- ✅ `UserDetailPage` "Log in as user" button — **visible to all CSRs**, audit note (no URL), opens new tab
- ⏸️ Consumer `/auth/session` adoption route + `AuthContext.adoptSession` — **held on Q1**
- ⚠️ Guardrail decided: audit note never stores the loginHash URL (bearer credential = account takeover)

Related: HP-2 (this) + HP-3 (no-arg `auth.login` session check) in [[project_backlog]] — they're one build
(adoption needs the no-arg session pickup). Consider routing through the **bc-asks-register** agent to fold
Q1–Q5 into the standing BC asks package.
