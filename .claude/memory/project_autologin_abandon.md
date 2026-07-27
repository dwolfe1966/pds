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

**CONFIRMED working** 2026-07-27: fresh direct mint → /dashboard logged in; abandon-preview emails logged `cta:auto-login` for account holders (dwolfe66) and `cta:prefill` for no-account rows (correct split).

**OPEN: emailed-link TTL** — a fresh mint works instantly, but an EMAILED auto-login link clicked later is not yet measured (the /v3 landing the owner saw was a PREFILL email, not an expired auto-login). Must survive the open delay (minutes → ~24h). We mint at send-time (delivery is seconds; most opens <1h). Still worth a click-hours-later test; if short, file a BC ask to extend.

**No-account abandoner experience (owner 2026-07-27 "push deeper"):** prefill link lands them at the TOP of the v3 inmate search FORM (prefilled, but they re-click through). Deeper = land on their person's teaser/results. ⚠️ Two gates before repointing: (1) FCRA consent — v3 requires the agree checkbox (handleConfirm) BEFORE runSearch→/name/loader; a raw deep-link to /name/loader bypasses it. (2) search contextKey landmine [[feedback_search_contextkey]]. Safe design = prefill + auto-advance to the consent step (one click → /name/loader?firstName&lastName&state&flow=inmate → results).

Test URL: `https://idlookup.me/api/auth-link-test?e=<email>&secret=<CRON_SECRET>` (mint), `&probe=1` (diagnose lookup), `&next=/my-identity` (set dest).

**Controlled real send (wired 2026-07-27):** `abandoned-recovery` cron enforces a daily cap across runs. Go-live = `ABANDON_ENABLED=1` (+ redeploy). Knobs: `ABANDON_DAILY_CAP=N` (fixed, default 25), `ABANDON_RAMP=1` (auto-ramp 25→50→100→… by day off first send, schedule in emails-db `ABANDON_RAMP_SCHEDULE`), `ABANDON_MAX_AGE_DAYS` (recency, default off), `ABANDON_INCLUDE_NO_TARGET=1` (default OFF = data-rich only), `EMAIL_FIRST_DELAY_MIN`/`EMAIL_FOLLOWUP_DELAY_HOURS` (default 30/24). Batched suppression filter (CAN-SPAM) before slicing to budget; first-emails get budget priority over follow-ups.

**Ops endpoints** (secret-gated, on idlookup.me):
- `/api/abandon-status` — dashboard (live/paused, today sent/cap/remaining, queue, config, suppression, recentErrors, last 25 sends). `&pause=1` / `&resume=1` = INSTANT DB kill-switch (email_kv flag `abandon_paused`), no redeploy — cron checks it each run.
- `/api/abandon-preview?send=1&to=<inbox>&sample=5&include=<email>` — send N real emails to a test inbox (marks nothing). `&count`, `&includeNoTarget=1`.

**Pre-flight hardening (2026-07-27):** CAN-SPAM postal address is a HARD GATE — cron refuses to send unless `EMAIL_POSTAL_ADDRESS` set (rendered in footer, HTML+text). `maxDuration=60` + `ABANDON_PER_RUN` (default 8) bound each run (enrich+mint+send is sequential/slow) AND spread the daily cap across */15 runs. Send order is FRESHEST-FIRST (getPendingFirstEmail/Followup wrap DISTINCT-ON in a subquery, outer `ORDER BY abandoned_at DESC`) — recent abandoners engage most / bounce least during warm-up. Deliverability feedback loop: `/api/email/resend-webhook` (Svix-verified via `RESEND_WEBHOOK_SECRET`) writes bounces+complaints → suppression; REQUIRED before `ABANDON_RAMP=1` (our send log only sees "accepted", not async bounces). ⚠️ Confirm the SEO Vercel project is **Pro** — */15 crons + maxDuration>10s need it; on Hobby crons run daily and cap at 10s → partial/timed-out sends. Verify by watching `sentToday` move after enabling.

**Resume deep-link (consumer):** no-account CTA → `/name/landing/v3?fn&ln&state&resume=1` → v3 lands on Confirm step (prefilled, personalized, FCRA consent + one "View Results" click → loader → teaser). Kept a real gesture so email scanners can't auto-fire BC searches / skip consent. ⚠️ Needs the consumer bundle uploaded to BC to activate; degrades to prefilled-top-of-form until then. Bundle built 2026-07-27: build/public.d5dc6dbd.js.
