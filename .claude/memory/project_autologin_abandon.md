---
name: project_autologin_abandon
description: Password-less auto-login for abandon/recovery emails — WORKING end-to-end via existing BC methods, no BC ask
metadata:
  type: project
---

Recovery/abandon emails can auto-log a user in (no password) using ONLY existing BC methods — **verified working end-to-end 2026-07-27** (landed on /dashboard logged in).

**Chain** (`seo/lib/bcAutoLogin.mjs`, test route `seo/app/api/auth-link-test/route.js`):
1. Headless CSR login: POST `{BC_CSR_API_URL}/auth/login?clientId=<32ch>&apiId=<32ch>` `{username,password}` → session cookie jar (connect.sid). **clientId/apiId query params are REQUIRED on every BC call** — omitting them = `400`. Reuse jar ~15min.
2. Resolve email→userId: POST `/database/search` `{brandId:'idlookup', collectionName:'users', query:{email}}`. **brandId is REQUIRED** (unbranded → 0 docs). Envelope = `{docs,noMoreDocs,displayFields,dateFields}`; email field is literally `email`.
3. Mint: POST `/user/management/getAutoLoginUrl` `{userId, redirect}` → `{url}` = `https://www.idlookup.ai/api/auth/loginLink?loginHash=<token+base64(redirect)>&clientId&apiId`.

**CRITICAL redirect rule:** `redirect` MUST be `/auth/session?next=<clean path>`, NOT a bare protected path. BC's loginLink sets the server COOKIE then redirects; the SPA still needs [[project_bc_consumer_message_model]]-style client hydration — `SessionAdoptPage` (`/auth/session`) calls `adoptSession()` (no-arg BC login off the cookie) then forwards to `?next=`. Landing straight on `/dashboard` bounces to `/login` (ProtectedRoute runs before adoption). Same route the admin "Log in as user" button uses (UserDetailPage.js:741 → redirect `/auth/session`).
- `next` allows ONLY plain paths `/^\/[a-zA-Z0-9/_-]*$/` — **no query strings** (SessionAdoptPage.js:22). So `/name/landing/v3?fn=…` can't ride through `next`.

**Abandon cron wiring (WIRED 2026-07-27):** `renderCheckoutAbandoned(row,stage,enrichment,ctaUrl)` — cron mints at SEND time per row; account exists → `ctaUrl` = auto-login link; NO account (never completed signup, e.g. email-capture-only) → null → falls back to prefilled `/name/landing/v3?fn=…`. logSend meta.autoLogin records the split. `hasBcAutoLogin()` gates minting.
- **Destination = `/payment`** (env `ABANDON_AUTOLOGIN_NEXT`), NOT /dashboard: a State-B abandoner is UNPAID so /dashboard is a paywalled dead-end. PaymentPage stands alone (default `comp.offer.signup.main`, no target needed), requires login, redirects PAID users to /dashboard (PaymentPage.js:210) — so it's a working resume-checkout one step from done.

**Security:** needs CSR ADMIN creds in the SEO/marketing backend (can impersonate anyone). Owner-accepted tradeoff 2026-07-27. Env on SEO Vercel: `BC_CSR_API_URL` (`https://admin.www.bytecrtrs.com/api`), `BC_CSR_USERNAME` (admin email), `BC_CSR_PASSWORD`, optional `BC_BRAND_ID`. Never returns creds to client; only the short-lived link.

**OPEN: link TTL** — must survive the email-open delay (minutes → ~24h). Not yet measured. Test: mint, click now (works), re-click hours later. If short, mint at send-time (delivery is seconds; most opens < 1h) or file a BC ask to extend.

Test URL: `https://idlookup.me/api/auth-link-test?e=<email>&secret=<CRON_SECRET>` (mint), `&probe=1` (diagnose lookup), `&next=/my-identity` (set dest).
