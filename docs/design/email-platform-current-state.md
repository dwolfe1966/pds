# Email infrastructure — current state (research findings)

**Date:** 2026-07-11
**Purpose:** Ground-truth inventory of what email machinery exists in this repo TODAY, to inform a build-vs-adopt plan for a first-party PDS email platform on our SendGrid account.
**TL;DR:** There is a clean, provider-agnostic email service **in the dev mock server only**. It is **not in the production path** and **SendGrid is not provisioned** (dep not installed, no API key, no env vars, no domain auth). Production transactional email is 100% BC's, sent by BC's `smtp01Mailer` from HTML we author with `${...}` tokens. The `checkout_abandoned` trigger fires a **signal only** (BC tracking + GA4) — no email is sent by anyone today.

---

## 1. `server/emailService.js` — provider-agnostic service (DEV-ONLY)

**File:** `server/emailService.js` (95 lines)

- Thin façade over a pluggable provider (`server/providers/`). `_send()` (lines 11–30) builds a log entry, calls `provider.send({to,subject,html,type})`, pushes to an **in-memory** `emailLog` array (line 9), swallows/records failures.
- Exposes 12 typed senders (lines 32–79): `sendWelcome`, `sendPaymentConfirmation`, `sendAlertDigest`, `sendBroadcast`, `sendCancel`, `sendOptOutRequest`, `sendPasswordReset`, `sendSignup`, `sendUncancel`, `sendRemarketing` (4-step drip), `sendMessageCreated`.

**Provider selection** — `server/providers/index.js` (29 lines): factory keyed on `EMAIL_PROVIDER` env var (case-insensitive), default `console`. Registry: `console | sendgrid | ses | smtp`. Throws on unknown value.

| Provider | File | Status | Requires |
|---|---|---|---|
| console | `providers/console.js` (9 ln) | **Functional** — just `console.log`s to stdout, no real send. Default. | nothing |
| sendgrid | `providers/sendgrid.js` (27 ln) | **Stubbed / not provisioned** — `require('@sendgrid/mail')` at load, throws if missing. **Dep is NOT installed** (see below). | `@sendgrid/mail`, `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` |
| ses | `providers/ses.js` (34 ln) | Stubbed — needs `@aws-sdk/client-ses` (not installed). Supports `AWS_SES_CONFIGURATION_SET` for open/click tracking. | AWS creds + region |
| smtp | `providers/smtp.js` (36 ln) | Stubbed — needs `nodemailer` (not installed). Generic SMTP (Mailgun/Postmark/Mailtrap). | `SMTP_HOST/PORT/USER/PASS/SECURE` |

**Env vars read:** `EMAIL_PROVIDER`, `SENDGRID_API_KEY`, `EMAIL_FROM` (default `noreply@idlookup.com`), `EMAIL_FROM_NAME` (default `IDLookup`), AWS_* / SMTP_* per provider, plus template-side `APP_URL` and `SUPPORT_PHONE` (`server/templates/email.js:82-83`).

**Is it in the production path? NO.**
- `server/package.json` dependencies are only `axios, cookie-parser, cors, express, jsonwebtoken`. **No `@sendgrid/mail`, no `nodemailer`, no `@aws-sdk/client-ses`.** `server/node_modules/@sendgrid` does not exist. So selecting `sendgrid` today throws at startup.
- **No `EMAIL_PROVIDER` / `SENDGRID_*` / `EMAIL_FROM` / `SMTP_*` in any `.env` file** (`.env.admin`, `.env.admin.local`, `.env.development.local`, `.env.production` — grep returned nothing). Provider therefore defaults to `console`.
- `.env.production` sets `REACT_APP_USE_MOCK_API=false` — production is a pure React SPA that does **not** talk to `server/index.js`. Per `CLAUDE.md`, `/server` is a dev mock only.
- Where the mock server *does* call it (dev only): `server/index.js:1085` `sendWelcome` on user create; `:1930` `sendPaymentConfirmation` on subscription; `:2677` `sendBroadcast` from the admin broadcast route. All `.catch(()=>{})` fire-and-forget, all against `console` provider.

**Bottom line:** a well-factored skeleton — the abstraction is real and correct — but **as wired today it sends nothing anywhere except stdout in dev.** SendGrid is a code path, not a running integration.

---

## 2. In-repo templates — `server/templates/email.js` (291 lines)

JS functions returning inline-styled HTML strings. Shared `base(title, body)` shell (lines 4–28) with IDLookup header, footer, and **hardcoded `{{unsubscribe_url}}` / `{{privacy_url}}` placeholders** (never populated — no substitution layer exists for them here). Templates:

- `welcomeEmail` (30), `paymentConfirmationEmail` (42), `alertDigestEmail` (60, first 10 alerts).
- Lifecycle set (added 2026-06-24): `cancelEmail` (106), `optOutRequestEmail` (123), `passwordResetEmail` (139), `signupEmail`/trial-welcome (154), `uncancelEmail` (174).
- `remarketingEmail` + `remarketingSubject` (189–246): **4-step trial-non-converter drip**, keyed `REMARKETING[1..4]` — subject/heading/lead/CTA per step, framed "finish unlocking / complete membership", CTA → `/payment`. This is the closest thing to a campaign engine in the repo (content only; no scheduler).
- `messageCreatedEmail`/`Subject` (249), `broadcastEmail` (270, newline→`<br>`).

These use JS template-literal interpolation (`${name}`, `${APP_URL}`) — **our own** substitution, resolved when the mock server renders. They are **not** the BC-token variant (see §6).

---

## 3. `docs/email-templates/*.html` — rehabbed transactional set (for BC upload)

Ten hand-authored HTML files (2026-06-24), formatted for **BC's HTML upload tool**, using BC `${code....}` tokens (not our JS):

1. `signup-confirmation.html` — trial welcome; hook `code.billing.sale.hook`.
2. `cancel-order.html`
3. `uncancel-order.html`
4. `reset-password.html`
5. `contact-received-confirmation.html`
6. `csr-reply-notification.html`
7. `remarketing-1.html` … `remarketing-4.html` — the 4-step drip as standalone HTML.

Header comments (see `signup-confirmation.html` top) document the real BC hook (`code.billing.sale.hook`), fixes vs the "horrible" live template (raw ISO dates → "June 30, 2026", `30 Day`→`30 days`, `$1`→`$1.00`), and a **key open assumption**: whether BC renders `${...}` as a full JS template literal (evaluates expressions) or only simple dotted-path substitution — flagged "TEST by uploading + sending one". Confirmed global tokens: `comp.brand.name`, `comp.brand.customer.phone`, `comp.email.default.footer`, `code.baseUrl`, `comp.client.paths.dashboard`.

Also present: `docs/lifecycle-emails.csv` (plain-text Type/Subject/Body/Delay copy for the lifecycle set, `{{token}}` style) and `docs/BC_SIGNUP_WELCOME_EMAIL.md` + `docs/email-previews/`.

---

## 4. Admin UI for sending / managing email

- **`EmailBroadcastPage` — GONE (confirmed).** Removed from nav + route in commit **`2a9f31b`** ("admin: remove Broadcast menu item + /email route"), which *left the component file in place*. A **later** commit **`8c46ac3`** ("chore(admin): remove orphan EmailBroadcastPage + dead API helpers") deleted the file itself. `src/pages/admin/EmailBroadcastPage.js` **does not exist** today; no `/admin/email` route or `AdminNav` link references it. The mock backend route still exists (`server/index.js:2661` `POST /api/v1/admin/email-broadcast`, audience filters paid/unpaid/optin) but is unreachable from any live UI and is mock-only.
- **`UnsubscribePage.js`** — LIVE (`src/AdminApp.js:15`). Calls `api.adminListUnsubscribed` / `adminUnsubscribeContact` → endpoints `admin-unsubscribe` / `admin-unsubscribe-delete`, which are in `FORCE_NEW_API_ENDPOINTS` (`src/services/apiRouter.js:285-293`) → **always BC, never mock.** This manages **BC's** suppression list (`managedContact`/`optOut`, `subStatus:'unsubscribed'`), not a first-party list. So today the unsubscribe/suppression authority is BC.
- **`MailActivityPage.js`** — LIVE. Uses `adminCreateCsrMail`, `adminFindUserContacts`, `adminFindContactMessages` → BC `contactMessage` (CSR ↔ customer mail). BC-backed, not a bulk sender.
- **`EmailTicketsPage.js`** — LIVE; BC contact-ticket inbox + attachment download (unrelated to outbound campaigns).
- **`sendAlertDigest`** — exported from `emailService.js:40` but **never called anywhere** (no route, no scheduler, no cron). Purely aspirational; Alerts themselves are BC-blocked (`docs/BC_CONSUMER_FEATURE_ASKS.md`).

**No admin GUI exists today to compose/schedule/send a campaign.** The only one that ever existed (Broadcast) was deleted precisely because it was mock-only with "no production utility."

---

## 5. `checkout_abandoned` / abandoned-checkout trigger — signal only, no email

**`src/pages/sales/PaymentPage.js:278-300`.** On `pagehide`/unmount without `success`, fires once:
- `track('checkout_abandoned', {offer_key, has_target})`
- `gtmEvent('checkout_abandoned', {funnel_step:'payment'})`

Where it goes (`src/services/trackingService.js:189` `track()`): **(a)** `_sendToBC` → BC tracking store (primary), and **(b)** `window.dataLayer` as namespaced `client_checkout_abandoned` → GA4/GTM (attribution/funnel dims only, **no PII** — deliberate, GA4 ToS). `gtmEvent` (`src/services/gtm.js:116`) pushes to the same dataLayer.

The code comment is explicit (lines 282-285): **"this only fires the SIGNAL. The recovery email is sent DOWNSTREAM (a BC abandoned-cart flow or an email platform listening for this event) — email logic does not live in the SPA (architecture decision)."**

**So today: nobody sends an abandoned-checkout email.** The signal lands in BC tracking + GA4; there is no consumer of it that produces a send. This is the single clearest greenfield opportunity for a first-party platform: a listener on this event → SendGrid → recovery series. `remarketing-1..4` templates already exist for exactly this audience.

Grep for `remarketing` elsewhere: only privacy-policy copy (`PrivacyPage.js:583,592`, Google Ads remarketing disclosure) — no client-side remarketing send logic.

---

## 6. How transactional email works with BC TODAY

- BC owns and sends all production transactional mail via its **`smtp01Mailer`** (confirmed working end-to-end — `mailResult.success:true` on every `contactMessage.create`; see `docs/BC_SIGNUP_WELCOME_EMAIL.md`).
- Authoring model: **we write HTML with BC `${...}` tokens; BC's admin HTML-upload tool stores it per template; BC injects live values at send** from hooks like `code.billing.sale.hook`. The rehabbed set in `docs/email-templates/` is built for exactly this handoff.
- Triggers are BC-side, bound to BC billing/contact hooks (sale, cancel, contactMessage). We cannot fire them from the SPA — production is a pure SPA with no backend to hold SMTP creds (`BC_SIGNUP_WELCOME_EMAIL.md` "Why we can't do this client-side").
- Open BC gaps/asks: welcome-on-signup email was missing (BC ask #21); the `${...}` expression-vs-substitution behavior is unverified; suppression/unsubscribe lives in BC (`managedContact`).

---

## 7. SendGrid specifics — what we'd have vs need

**What exists in-repo:** a correct `sendgrid` provider (`server/providers/sendgrid.js`) and the swap-by-env-var factory. That's it.

**What is NOT provisioned (all missing):**
- `@sendgrid/mail` npm dep — **not installed** in `server/node_modules`.
- `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` — **not set in any env file.**
- No sender identity / verified sender, no domain authentication, **no SPF/DKIM/DMARC references anywhere in the repo** (grep clean).
- No production backend to run it — the mock server isn't deployed; the SendGrid provider only lives inside a service that production doesn't invoke.

So "on top of our existing SendGrid account" = we presumably have the **account** externally, but the **repo has zero live SendGrid wiring, keys, or domain auth.** Everything past the provider stub is greenfield.

---

## BUILD assessment — first-party PDS email platform on SendGrid

### What already exists (reusable)
- Clean provider abstraction (`emailService` + `providers/`) — swap to real SendGrid = install dep + set 3 env vars, on a real (non-mock) backend.
- A full transactional/lifecycle template library in **two forms**: our JS templates (`server/templates/email.js`) and BC-token HTML (`docs/email-templates/`). The marketing/lifecycle ones (remarketing 1-4, digest, broadcast) are ours to take.
- The highest-value trigger already emitted: `checkout_abandoned` (PaymentPage → BC tracking + GA4). A 4-step remarketing drip authored for that audience.
- A broadcast audience-segmentation pattern (paid/unpaid/optin) already sketched in the dead mock route.

### What is missing (must build)
1. **A real backend / worker.** Production is a pure SPA; there is no service to hold the SendGrid key, run schedulers, or listen for events. This is the foundational gap — a small first-party service (or serverless functions + a queue) is prerequisite to everything else.
2. **GUI** — compose/manage templates + campaigns. The only admin sender ever built (Broadcast) was deleted. Need template CRUD, campaign builder, audience selector, send/schedule.
3. **Scheduling / drip orchestration** — `sendAlertDigest` and `sendRemarketing` exist as functions but nothing schedules them. Need cron/queue + per-recipient step state (which remarketing step, delays from `lifecycle-emails.csv`).
4. **List / audience management** — real recipient store + segments. Today "audience" is a live query over the mock datastore; production users live in BC.
5. **Open/click tracking** — none today (SES provider references a config set; SendGrid provider sends bare). Need event webhooks + storage + reporting.
6. **Unsubscribe / suppression** — the `{{unsubscribe_url}}` placeholder is never populated; suppression currently lives in **BC** (`managedContact`, UnsubscribePage). A first-party platform needs its own suppression list **reconciled with BC's** (CAN-SPAM: one unsubscribe must suppress across both).
7. **SPF / DKIM / DMARC / domain authentication** — absent from repo; must be set up on the sending domain in SendGrid + DNS. Deliverability precondition.
8. **PII boundary** — the codebase is disciplined: no PII to GA4, BC holds emails. A first-party platform would be the **first place we hold subscriber email + behavior together** → new PII surface needing the same rigor (encryption, access control, the GA4-style whitelist discipline).

### Division of ownership (recommended framing for the plan)
- **Stays BC (transactional, bound to billing/contact hooks):** signup/welcome, payment confirmation, cancel, uncancel, opt-out confirmation, password reset, contact-received, CSR-reply, message-created. These fire from BC billing/contact hooks the SPA can't reach; BC's `smtp01Mailer` + upload tool already own them. Moving them to us would mean duplicating BC's hook triggers — high effort, low value, and race/duplicate-send risk.
- **Moves to us (marketing / lifecycle / campaigns, event-driven):** **abandoned-checkout recovery** (we already emit the signal + have templates; BC has no such flow), **remarketing / trial-non-converter drip** (steps 1-4), **broadcast / newsletters**, **alert digests** (once BC Alerts data exists), win-back/promo. These are behavior- and marketing-driven, don't need BC billing hooks, and are where a first-party platform + SendGrid adds net-new capability.

### Overlap / conflict to resolve
- **Suppression is the real conflict.** BC owns the unsubscribe list; a first-party sender must honor and sync it (import BC unsubscribes, push ours back), or we risk mailing opted-out users. This is the #1 integration item, not a nice-to-have.
- **Domain / sender identity:** if BC sends transactional `@idlookup.ai` and we send marketing from the same domain, DKIM/DMARC alignment and (ideally) a dedicated subdomain (e.g. `mail.idlookup.ai` or `go.idlookup.ai`) prevent our marketing volume from harming BC's transactional deliverability.
- **Attribution continuity:** the `checkout_abandoned` signal is already keyed to BC `trackingSessionId` + funnel/partner dims — a first-party consumer can join on that without new plumbing.

---

## What's real vs aspirational (one-glance)

| Thing | Real today | Aspirational / missing |
|---|---|---|
| Provider abstraction (`emailService`/`providers`) | ✅ code exists, correct | ⚠️ dev-mock only, not deployed |
| SendGrid integration | ⚠️ provider stub | ❌ dep not installed, no key, no domain auth |
| Templates (transactional + lifecycle + remarketing) | ✅ authored, two forms | — |
| BC transactional sending (`smtp01Mailer` + upload tool) | ✅ production, BC-owned | ⚠️ `${...}` eval behavior unverified |
| `checkout_abandoned` trigger | ✅ signal to BC + GA4 | ❌ no email consumer of it |
| Admin broadcast/compose GUI | ❌ deleted (`2a9f31b`, `8c46ac3`) | ❌ needs rebuild |
| Scheduling / drip engine | ❌ | ❌ needs build |
| Open/click tracking | ❌ | ❌ needs build |
| Unsubscribe/suppression | ✅ BC-owned (UnsubscribePage→BC) | ❌ no first-party list / no sync |
| SPF/DKIM/DMARC | ❌ nothing in repo | ❌ needs setup |
| Backend to run any of this | ❌ pure SPA in prod | ❌ needs a service/worker |
