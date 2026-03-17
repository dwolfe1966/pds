# Signup & Auth Transition Manual Walkthrough

This guide covers the four key auth flows in the people-search SPA. Follow each section precisely to exercise the correct code paths and verify the correct network calls.

---

## Prerequisites

- `npm run dev` running — Parcel on `:3000`, Express mock API on `:3001`
- Browser DevTools open: **Network** tab (filter on `XHR` or `Fetch`) and **Console** tab
- Clear `localStorage` and `sessionStorage` before each flow: DevTools > Application > Storage > Clear site data
- ByteCrtrs IIFE library must load: in Console, `window.ApiWrapper` should not be `undefined`

### Test Credentials (from `server/seed.js`)

| Account | Email | Password | Role | Subscription |
|---|---|---|---|---|
| Member (free/paid) | `member@test.com` | `password123` | member | active basic plan ($29.99) |
| Paid member | `paid@test.com` | `password123` | member | active basic plan ($29.99) |
| Admin | `admin@test.com` | `admin123` | admin | none |

> Note: `member@test.com` has an active subscription seeded in the mock store, so logging in as this user will immediately show as paid. Use a freshly-registered email to test the free-member state.

---

## API Call Reference

| Transition step | Call | Destination | Fallback |
|---|---|---|---|
| Create account | `api.signup()` | Mock (`POST localhost:3001/api/v1/signup`) | None (mock only) |
| Register in ByteCrtrs | `api.billingSignup()` | ByteCrtrs via `/api/proxy` | None — errors are swallowed (non-fatal) |
| Login | `api.login()` | Mock (`POST localhost:3001/api/v1/login`) | None (`REACT_APP_USE_NEW_API_AUTH=false`) |
| Subscribe | `api.billingSale()` | ByteCrtrs via `/api/proxy` | None (FORCE_NEW_API, no fallback) |
| Load subscription | `api.getSubscription()` | Mock (`GET localhost:3001/api/v1/subscription`) | None |
| Load report | `api.createReport()` / `api.getReport()` | ByteCrtrs via `/api/proxy` | None (FORCE_NEW_API) |

ByteCrtrs requests are proxied through the local Express server at `POST localhost:3001/api/proxy` to avoid CORS in development. The proxy then forwards to `https://dev1.dev.www.bytecrtrs.com/api`.

---

## T1: Visitor → Free Member (Signup, no purchase)

### Steps

1. Navigate to `http://localhost:3000/signup`
2. Verify the page header reads "Create Your Free Account" and the subtitle shows "No credit card required."
3. Fill in the form:
   - **Full Name**: `Test User One`
   - **ZIP Code**: `10001`
   - **Email**: use a fresh address, e.g. `testuser1@example.com`
   - **Password**: `testpass1` (8+ chars required; shorter will show client-side error)
   - **Marketing opt-in**: leave unchecked (optional)
4. Click **Create My Free Account**.
5. Observe the button label change to "Creating account…" while both API calls run in parallel.
6. After ~1–2 seconds, the form is replaced by a green success message: "Account created successfully! Redirecting to your dashboard…"
7. After 2 seconds, the browser navigates to `/dashboard`.

### Expected Behavior

- The form is hidden and replaced by the success box.
- `successRedirectTo` is set to `/dashboard` (no `?selected=` param present).
- The success message reads "Redirecting to your dashboard…" (not "Redirecting to complete your purchase…").
- `/dashboard` loads the `DashboardHome` component showing a "Free Account" banner and an "Upgrade to Pro" CTA.

### localStorage After Completion

Open DevTools > Application > Local Storage > `http://localhost:3000`:

| Key | Expected value |
|---|---|
| `accessToken` | A JWT string (e.g. `eyJhbGciOi…`) |
| `refreshToken` | A second JWT string |
| `user` | JSON: `{"id":"…","email":"testuser1@example.com","fullName":"Test User One","role":"member",…}` |

### Network Tab Verification

Filter on `localhost:3001`. Look for these two requests firing simultaneously (parallel `Promise.all`):

**Request 1 — Mock signup (always fires first in results pane)**
- Method: `POST`
- URL: `http://localhost:3001/api/v1/signup`
- Request body: `{"fullName":"Test User One","zip":"10001","email":"testuser1@example.com","password":"testpass1","optin":false}`
- Expected response status: `201`
- Response body includes `accessToken`, `refreshToken`, `user`

**Request 2 — ByteCrtrs billingSignup (may appear as `/api/proxy` in Network)**
- Method: `POST`
- URL: `http://localhost:3001/api/proxy`
- Request body (proxied): contains `userInfo: { email, firstName: "Test", lastName: "User One", optin: false }`
- Expected response: `200` with ByteCrtrs acknowledgement

**Console logs to verify:**
```
[API Router] commerce-billing-signup: { useNewAPI: true, … }
Signup response: { accessToken: "…", refreshToken: "…", user: {…} }
```

If ByteCrtrs `billingSignup` fails, you will see a `console.warn` in the Console tab:
```
[Signup] ByteCrtrs billingSignup failed (non-fatal): <error message>
```
The flow still completes — this error does not block account creation.

### Known Gaps / Notes

- There is no way to confirm ByteCrtrs actually registered the user from the UI. Check the Console for the `[API Router] commerce-billing-signup` log and inspect the `/api/proxy` response body in the Network tab. A ByteCrtrs `sessionId` or `userId` in the response body confirms registration.
- If the proxy request to ByteCrtrs returns a non-200 or the error is swallowed, the user will still have a valid mock JWT but will not exist in ByteCrtrs' system. This means `billingSale` on the payment page will likely fail for this user when they attempt to subscribe later.
- No email verification step is currently implemented. `emailVerified: false` is stored in the user object.
- Password minimum length (8 chars) is enforced client-side only; the mock API does not re-validate.

---

## T2: Visitor → Free Member → Paid (Signup then Subscribe)

This flow covers the full funnel: user arrives from a search result teaser, signs up, and completes payment.

### Steps

**Part A — Signup with a selected person**

1. Navigate to a name search that produces results, for example:
   `http://localhost:3000/name/landing` — enter `John Smith` and submit.
2. On the results page (`/name/search-result`), click "View Full Report" or "Unlock" on any result card.
3. You will be redirected to `/signup?selected=<personId>` (or with `personName`/`personLocation` URL params).
4. Verify the teaser block appears above the form: "Unlock Full Report for John Smith" with a checklist of features.
5. Fill in the form:
   - **Full Name**: `Test User Two`
   - **ZIP Code**: `90210`
   - **Email**: `testuser2@example.com`
   - **Password**: `testpass2`
6. Click **Create My Free Account**.
7. Success message: "Account created successfully! Redirecting to complete your purchase…"
8. After 2 seconds, browser navigates to `/payment`.

**Part B — Payment**

9. On `/payment`, verify:
   - "Paying as" shows `testuser2@example.com`
   - Billing first/last name fields are pre-populated from the user's `fullName` ("Test" / "User Two")
   - If a `selectedPerson` was stored in `sessionStorage`, the person preview banner appears at the top of the form with initials avatar and "Ready to unlock" badge
   - The CTA button reads "Unlock Report — $29.99/mo" (not "Subscribe Now — $29.99/mo")
10. Enter card details. In development, use the test links shown at the bottom of the form:
    - Click **"Success"** next to "Test:" to append `?simulate=success` — this bypasses ByteCrtrs `billingSale` and calls the mock `updateSubscription` endpoint instead.
    - Alternatively, enter a valid Luhn-passing test card number (e.g. `4111 1111 1111 1111`, expiry `12/30`, CVV `123`).
11. Click **Unlock Report — $29.99/mo**.
12. Success state: green checkmark, "Payment Successful! Your membership is now active. Preparing your report for John Smith…"
13. After 2 seconds, browser navigates to `/people/<commerceContentId>` (if a report was created for `selectedPerson.extId`) or `/people/<selectedPersonId>` (fallback using the sessionStorage ID).

### Expected Behavior

- `sessionStorage.selectedPersonId` is written during signup and read by PaymentPage on mount.
- After successful payment, `refreshSubscription()` is called — `AuthContext.subscription` is updated and `isPaid` becomes `true`.
- If `selectedPerson.extId` is present, `createReportForIdentity()` is called (ByteCrtrs `create-report`) and the user is navigated to the resulting `commerceContentId` URL.

### Network Tab Verification

**During signup (same as T1):** `POST /api/v1/signup` + `POST /api/proxy` (billingSignup)

**During payment:**

**Request 3 — ByteCrtrs billingSale**
- Method: `POST`
- URL: `http://localhost:3001/api/proxy`
- Request body includes `userInfo`, `billings[0].creditCard`, `commerceOfferKeys: [{key: "comp.offer.signup.main"}]`
- Expected status: `200`
- Response `data.success` must NOT be `false` — any other shape is treated as success

Console log to look for:
```
[API Router] commerce-billing-sale: { useNewAPI: true, … }
```

**If `?simulate=success` was used instead:**
- The `billingSale` call is skipped (catches error, falls through to simulate path)
- `POST /api/v1/subscription` fires to the mock server with `{ plan: "basic", paymentToken: "tok_demo", simulate: "success" }`

**Request 4 — Subscription refresh (after payment success)**
- Method: `GET`
- URL: `http://localhost:3001/api/v1/subscription`
- Expected: `{ plan: "basic", status: "active", … }`

### Known Gaps / Notes

- The `selectedPerson.extId` field must be set on the result card object stored in `sessionStorage` under the key `result_<personId>`. If the sales search results page does not write `extId`, the post-payment report creation falls through to `navigate('/people/<selectedPersonId>')`, which uses the raw person ID rather than a ByteCrtrs `commerceContentId`. The `SearchResultDetailPage` will then fail to load a report.
- `billingSale` has no mock fallback (FORCE_NEW_API). If ByteCrtrs is unreachable, the only workaround in development is `?simulate=success`.
- If `billingSale` returns `data.success === false`, the error is surfaced in the UI error box ("Payment declined").
- Billing address fields are collapsed by default ("Optional — uses address on file"). The form submits fallback values (`street1: "123 main"`, `zip: "10001"`) if not filled in.

---

## T3: Visitor → Free Member (Login)

### Steps

1. Ensure you are logged out: navigate to `http://localhost:3000/logout` or clear `localStorage` manually.
2. Navigate to `http://localhost:3000/login`.
3. If you are already authenticated, `AuthContext` redirects you to `/dashboard` immediately (via `useEffect` watching `token`).
4. Fill in the form:
   - **Email**: `member@test.com`
   - **Password**: `password123`
5. Click **Login**.
6. Button label changes to "Logging in…"
7. On success, the browser navigates to `/dashboard` (or to the `?redirect=` URL if present in the query string).

### Testing the Redirect Param

To test redirect preservation:

1. Navigate to `http://localhost:3000/login?redirect=%2Faccount`
2. Log in with `member@test.com` / `password123`
3. After login, the browser should navigate to `/account` (decoded from the `redirect` param)

### Expected Behavior

- `AuthContext.login()` calls `api.login({ email, password })` → mock server → `POST localhost:3001/api/v1/login`
- On success, `accessToken`, `refreshToken`, and `user` are written to `localStorage` and to `AuthContext` state.
- `AuthContext` then triggers `refreshSubscription()` — since `member@test.com` has an active seeded subscription, `isPaid` becomes `true`.
- The `DashboardHome` shows "Pro Member / Active" banner.

### localStorage After Completion

| Key | Expected value |
|---|---|
| `accessToken` | JWT from mock server |
| `refreshToken` | JWT refresh token |
| `user` | JSON: `{"id":"user-member","email":"member@test.com","fullName":"Member User","role":"member",…}` |

### Network Tab Verification

**Single request:**
- Method: `POST`
- URL: `http://localhost:3001/api/v1/login`
- Request body: `{"email":"member@test.com","password":"password123"}`
- Expected status: `200`
- Response: `{ accessToken: "…", refreshToken: "…", user: { id: "user-member", … } }`

**No ByteCrtrs requests should appear.** `REACT_APP_USE_NEW_API_AUTH=false` means `FEATURE_FLAGS['login'] = false`, so `callNewAPI('login')` is never invoked. Verify: the Network tab should show zero requests to `localhost:3001/api/proxy` during this flow.

**Console log to look for:**
```
[API Router] login: { useNewAPI: false, useMockAPI: true, … }
```

**Immediately after login,** a second request fires:
- Method: `GET`
- URL: `http://localhost:3001/api/v1/subscription`
- This is `refreshSubscription()` auto-triggered when the token changes in `AuthContext`

### Known Gaps / Notes

- `ProtectedRoute` redirects unauthenticated users to `/login` but does not append a `?redirect=` parameter. If a user tries to access `/dashboard` while logged out, they land on `/login` with no redirect preserved, so after login they always go to `/dashboard`.
- No silent token refresh on 401 is implemented. If the JWT expires mid-session, the next protected API call will trigger a logout via `doLogout()`. The user loses their current page.
- `apiWrapper.login()` IS implemented in `callNewAPI` (case `'login'`) but is gated by `REACT_APP_USE_NEW_API_AUTH=false`. Enabling the flag without validating the ByteCrtrs response shape will break the auth flow (see ByteCrtrs Auth Gap Analysis below).

---

## T4: Free Member → Paid (Subscribe from Dashboard)

This flow covers a member who already has an account and token but no active subscription.

### Setup

Register a fresh account via T1 first (`testuser3@example.com`), or use an account that does not yet have a subscription in the mock store. The default seeded accounts (`member@test.com`, `paid@test.com`) already have active subscriptions.

To create a no-subscription state:
- Register a new user through `/signup` (T1 flow)
- Their account will have no subscription row in the in-memory mock store

### Steps

1. Log in as the freshly registered user (or navigate directly to `/dashboard` if the session is still active from T1).
2. On `/dashboard`, verify:
   - "Free Account" banner is visible at the top
   - "Upgrade to Pro — $29.99/mo" button appears in the banner
   - "Upgrade to Pro" quick action also appears in the Quick Actions panel
3. Click either **Upgrade to Pro** button → navigates to `/payment`.
4. On `/payment`, verify:
   - "Paying as" shows your registered email
   - No person preview banner (no `selectedPerson` in `sessionStorage`)
   - The CTA button reads "Subscribe Now — $29.99/mo"
5. Enter card details or use the `?simulate=success` test link.
6. Click **Subscribe Now — $29.99/mo**.
7. Success message: "Payment Successful! Your membership is now active. Redirecting to your dashboard…"
8. After 2 seconds, browser navigates to `/dashboard` (since no `selectedPersonId` in `sessionStorage`).
9. On `/dashboard`, verify the "Pro Member / Active" banner now appears (subscription refreshed after payment).

### Expected Behavior

- `PaymentPage` auth guard: `useEffect` watches `token`; if absent, redirects to `/signup?redirect=%2Fpayment`. Since you are already logged in, this guard does not fire.
- After payment success, `refreshSubscription()` updates `AuthContext.subscription`, making `isPaid = true`.
- `DashboardHome` re-renders with the paid state banner.

### Network Tab Verification

**Payment request (ByteCrtrs `billingSale`):**
- Method: `POST`
- URL: `http://localhost:3001/api/proxy`
- Body: `{ userInfo: { email, firstName, lastName, optin }, billings: [{ billingType: "creditCard", creditCard: {…}, billingAddress: {…} }], commerceOfferKeys: [{key: "comp.offer.signup.main"}], sequenceOption: {…} }`
- Expected status: `200`

Console log:
```
[API Router] commerce-billing-sale: { useNewAPI: true, … }
```

**Subscription refresh after payment:**
- Method: `GET`
- URL: `http://localhost:3001/api/v1/subscription`

**If using `?simulate=success`:**
- Method: `PUT`
- URL: `http://localhost:3001/api/v1/subscription`
- Body: `{ plan: "basic", paymentToken: "tok_demo", simulate: "success" }`

### "I'll Upgrade Later" Path

On the payment page, there is a text button at the bottom: **"I'll upgrade later — go to my dashboard"**. Clicking it:
- Calls `navigate('/dashboard')` directly with no API calls
- Does not set a subscription
- The dashboard will continue to show the "Free Account" banner

Verify: no Network requests fire when clicking this button.

### Known Gaps / Notes

- There is currently no unpaid member guard. Free members can navigate to all member routes (including `/people/:id` report detail). The `PaidRoute` wrapper in `App.js` wraps `/people/:id` but must be verified to redirect unpaid users correctly.
- `billingSale` errors surface in the UI error box with the message from `err?.data?.error?.message || err?.message`. A `401` from the proxy specifically shows "Please sign in or create an account first."

---

## ByteCrtrs Auth Gap Analysis

### Current State

Authentication in this app is entirely handled by the **mock Express server** (`server/index.js`). The auth flow produces JWTs that are issued and validated locally:

- **Signup**: `POST localhost:3001/api/v1/signup` → issues `accessToken` + `refreshToken` (mock JWTs signed with a local secret)
- **Login**: `POST localhost:3001/api/v1/login` → same
- `REACT_APP_USE_NEW_API_AUTH=false` (`.env` line 34) — this ensures `FEATURE_FLAGS['login']` and `FEATURE_FLAGS['logout']` are both `false`, so `routeApiRequest` never calls `callNewAPI('login')`.

ByteCrtrs auth is **not wired** for login/signup in the current configuration.

### What ByteCrtrs Has (Implemented but Disabled)

`callNewAPI` in `src/services/apiRouter.js` (line 294–295) has a fully implemented `case 'login'`:

```js
case 'login':
  return await apiWrapper.login(params.body || params);
```

`apiWrapper.login()` calls `window.ApiWrapper`'s login method (the IIFE library). The method exists and is callable — it is only unreachable because the feature flag routes `login` to the mock server.

### What Must Change to Enable ByteCrtrs Auth

**Step 1 — Flip the feature flag:**

In `.env`:
```
REACT_APP_USE_NEW_API_AUTH=true
```

This makes `FEATURE_FLAGS['login'] = true` and `FEATURE_FLAGS['logout'] = true`, routing both through `callNewAPI`.

**Step 2 — Validate the ByteCrtrs response shape.**

`AuthContext.login()` (line 66 of `src/context/AuthContext.js`) expects:
```js
{
  accessToken: "...",    // required — stored in localStorage and AuthContext.token
  refreshToken: "...",   // optional — stored in localStorage
  user: {                // required — stored in localStorage and AuthContext.user
    id: "...",
    email: "...",
    role: "member" | "admin",
    fullName: "...",
    ...
  }
}
```

`apiWrapper.login()` must return an object matching this shape exactly. If ByteCrtrs returns a different shape (e.g. `session_token` instead of `accessToken`, or user data nested under `profile`), the login will silently appear to succeed but `token` will be `null` and the user will be redirected back to login on next page load.

Before enabling the flag, test `apiWrapper.login()` directly in the browser console:
```js
await window.ApiWrapper.login({ email: "member@test.com", password: "password123" })
```
Inspect the returned object and confirm the keys match what `AuthContext` expects.

**Step 3 — Verify protected routes.**

With ByteCrtrs tokens, the `Authorization: Bearer <token>` header sent to `localhost:3001/api/v1/…` (mock server) will be a ByteCrtrs JWT. The mock server validates JWTs using its own local secret. ByteCrtrs tokens signed with a different secret will be rejected with `401` on every protected mock endpoint (profile, alerts, subscription, etc.).

This means enabling ByteCrtrs auth also requires either:
- Switching all endpoints to ByteCrtrs (not yet implemented), or
- A token bridge: after ByteCrtrs login, also call the mock `login` to get a mock JWT, and store both

**Step 4 — Signup consistency.**

Currently, `api.billingSignup()` (ByteCrtrs) runs in parallel with `api.signup()` (mock) during registration. Switching auth to ByteCrtrs means the `accessToken` issued by `api.signup()` (mock) would be a mock JWT, which conflicts with ByteCrtrs auth. The signup flow would also need reworking to use ByteCrtrs' login response as the source of truth for the token.

### Risk Summary

| Risk | Severity | Notes |
|---|---|---|
| ByteCrtrs `login` response shape mismatch | High | `AuthContext` silently stores `undefined` if keys don't match; user appears logged out |
| Mock server rejects ByteCrtrs JWTs | High | All protected mock endpoints (`/api/v1/me`, `/api/v1/subscription`, etc.) will 401 |
| Signup creates mock JWT, `billingSale` expects BC session | Medium | Payment may fail if ByteCrtrs cannot correlate the billing session |
| No silent token refresh on 401 | Medium | Expired ByteCrtrs tokens trigger logout; no refresh logic exists |
| `admin@test.com` role enforcement | Low | `role: 'admin'` must be in the ByteCrtrs token payload for `ProtectedRoute` to allow admin routes |

### Production Path

Two viable approaches:

**Option A — Full ByteCrtrs Auth (preferred long-term)**

ByteCrtrs becomes the single source of auth truth. The API wrapper's `login()` response is adapted to the `{ accessToken, refreshToken, user }` shape `AuthContext` expects. All data endpoints (alerts, profile, subscription, reports) migrate to ByteCrtrs. The mock Express server is retired.

Required work:
1. Confirm `apiWrapper.login()` response shape with ByteCrtrs team
2. Write an adapter in `apiRouter.js` `case 'login'` that maps the BC response to `AuthContext`'s expected format
3. Migrate member endpoints to ByteCrtrs or a new backend, removing mock-only dependency
4. Set `REACT_APP_USE_NEW_API_AUTH=true` and test the full session lifecycle

**Option B — Lightweight Auth Wrapper**

A separate lightweight auth service (Node/Express or serverless function) wraps ByteCrtrs identity. It accepts email/password, calls ByteCrtrs login internally, and returns a standard JWT in the shape `AuthContext` already expects. The mock API's role is reduced to a staging backend for non-BC endpoints.

This approach minimizes frontend changes — only the auth service URL needs to change, and `REACT_APP_USE_NEW_API_AUTH` can remain `false` while pointed at the new service via `REACT_APP_API_URL`.

---

## Quick Reference: Dev Test Links

| Goal | URL |
|---|---|
| Signup (no purchase) | `http://localhost:3000/signup` |
| Signup (with selected person) | `http://localhost:3000/signup?selected=abc123&personName=John+Smith&personLocation=New+York,+NY` |
| Stepped signup variant | `http://localhost:3000/signup/v2` |
| Login | `http://localhost:3000/login` |
| Login with redirect | `http://localhost:3000/login?redirect=%2Faccount` |
| Payment (must be logged in) | `http://localhost:3000/payment` |
| Payment with simulate success | `http://localhost:3000/payment?simulate=success` |
| Payment with simulate failure | `http://localhost:3000/payment?simulate=failure` |
| Dashboard (paid state check) | `http://localhost:3000/dashboard` |
