# First-Party Email Platform — Build Plan

_Draft 2026-07-11. Forward plan; current-state ground truth in `docs/design/email-platform-current-state.md`._

## 0. Where we actually are

There's a clean, provider-agnostic email **skeleton** in the repo (`server/emailService.js`, 12 typed
senders incl. a 4-step remarketing drip, plus JS + BC-token HTML templates) — but it is **dev-mock
only and sends nothing in production.** SendGrid is a **code stub, not a live integration**: no
`@sendgrid/mail` dependency, no API key, no `EMAIL_FROM`, and **zero SPF/DKIM/DMARC** anywhere. All
production transactional email is **BC's** (their `smtp01Mailer` + an admin HTML-upload tool; we
author `${...}`-token HTML, BC injects values at billing/contact hooks the SPA can't reach).

**The one constraint that dictates everything:** production is a **pure React SPA**. Nothing in it can
hold a secret, run on a schedule, or listen for events. So the first and biggest missing piece is not
a GUI — it's a **real server-side runtime.** Until that exists, no lifecycle email can send.

## 1. Scope — what moves to us vs stays BC

Clean division (don't fight BC over transactional):

| Class | Owner | Examples |
|---|---|---|
| **Transactional** (bound to billing/contact hooks) | **BC** | signup/trial confirmation, cancel/uncancel, password reset, CSR reply, receipts |
| **Marketing / lifecycle / campaigns** | **US (SendGrid)** | abandoned-checkout, remarketing drip, welcome/activation, saved-person nudges, monitoring alerts, win-back, broadcasts, digests |

BC keeps the billing-hook-bound sends (they have the data + the hooks). We own everything driven by
**our** funnel/engagement signals. The abandoned-checkout signal and the `remarketing-1..4` templates
**already exist** — that's the cleanest greenfield win and the reason to build.

## 2. The keystone decision — where the backend lives

We need a server-side runtime for: holding the SendGrid key, receiving events (abandoned-checkout,
signup), scheduling drips/digests, and (later) the monitoring loop for Alerts. Options:

- **★ Reuse the Vercel app that already runs idlookup.me** (recommended). It is **already** a Next.js
  app on Vercel with **Neon Postgres** and access to **Vercel Cron + serverless functions**. That is
  *exactly* a place to hold a key, run scheduled jobs, and expose event endpoints — and it's already
  provisioned and deployed. Co-locating the email/monitoring backend there means **one server-side
  foothold serves areas (i) SEO, (iii) monitoring, (iv) email, and (v) freemium retention.** Strong
  architectural unifier; avoids standing up new infra.
- **BC VPS Node process** — where the consumer/admin bundles are hosted; viable but adds a process to
  manage and couples us to BC's box.
- **Standalone worker (Render/Fly/Railway)** — clean but new infra + cost.

Recommendation: **Vercel functions + Vercel Cron on Vercel/Neon** — but decide deliberately between
**co-locating in the existing `seo/` app** vs. a **separate service** (still on Vercel/Neon, just
isolated). The trade-off is real: co-location is the least new infra, but it puts **consumer PII
(member emails, watchlists, monitoring state) into the _public_ directory app's Neon DB**, coupling
consumer retention data to public-facing SEO infra and its deploy cadence. **Lean toward a separate
service / separate Neon database** for the PII isolation, reusing the Vercel+Neon+Cron *pattern* rather
than the *same app*. Don't default to co-location just because it's convenient.

## 3. Build vs adopt — lean on SendGrid's own features

"Build an app on top of SendGrid" should mean **thin orchestration over SendGrid's native
capabilities**, not reimplementing an ESP:
- **Delivery + templates:** SendGrid **Dynamic Templates** (handlebars) — port our HTML there; don't
  hand-roll a template engine.
- **Open/click tracking:** SendGrid **Event Webhook** → store in Neon. Don't build tracking pixels.
- **Suppression / unsubscribe:** SendGrid **Suppression Groups + unsubscribe** — but see §5 (must sync
  with BC).
- **Broadcasts / lists:** SendGrid **Marketing Campaigns** for one-off broadcasts (replaces the
  deleted `EmailBroadcastPage` without rebuilding a full composer initially).
- **We build:** the **event→email orchestration** (abandoned-checkout, drips, monitoring alerts), the
  **scheduler** (Vercel Cron), a **thin internal admin UI** for template/campaign management, and the
  **suppression sync** with BC.

## 4. Phased build

**Phase 0 — provision (half-day).** Create a dedicated **sending subdomain** (e.g.
`mail.idlookup.ai` or `e.idlookup.ai`) with SPF/DKIM/DMARC — **do NOT send from BC's transactional
domain** (protects BC's transactional deliverability, §5). Add `@sendgrid/mail`, key in the Vercel
env, verify sender identity. Port 2–3 templates to SendGrid Dynamic Templates.

**Phase 1 — abandoned-checkout (highest ROI, greenfield).** A Vercel function receives the
`checkout_abandoned` signal (already fired in `PaymentPage.js:278-300`, currently consumed by
no one), enqueues a delayed send via Vercel Cron, sends the existing `remarketing-1` template. This
one flow likely pays for the whole build.

**Phase 2 — lifecycle drips.** Welcome/activation (ties to freemium Lever A — "see your own exposure
report free"), the full remarketing-1..4 drip, saved-person nudges. Store subscriber state + send log
in Neon.

**Phase 3 — monitoring alerts + digests.** The scheduled re-search/diff loop for Alerts (see
`identity-management-wsfy-plan.md` §3c) delivers via this pipeline. `sendAlertDigest` (exported, never
scheduled today) gets a Cron trigger. **This is where email becomes the delivery layer for the whole
retention cluster (areas iii + v).**

**Phase 4 — team compose/campaign GUI.** Rebuild a lightweight broadcast/campaign surface (the
deleted `EmailBroadcastPage` role) — but backed by SendGrid Marketing Campaigns, not a from-scratch
composer. Do this last; it's the least time-sensitive.

## 5. The #1 integration risk — suppression + deliverability

- **Suppression sync with BC (CAN-SPAM / legal).** BC and we would both send to the same users. An
  unsubscribe on **either** side must suppress on **both**, or we violate CAN-SPAM. Before Phase 1:
  agree a suppression-sync mechanism with BC (shared list, webhook, or periodic reconcile). This is a
  **BC coordination item**, not just our build.
- **Protect BC's transactional deliverability.** Send marketing from a **separate subdomain** with its
  own DKIM so our promotional volume/complaints can't degrade BC's transactional inbox placement.
- **PII boundary.** Minimize PII in email payloads and in Neon (names/first-name ok; no report
  contents). Align with the existing `client_*` no-PII tracking discipline.

## 6. BC coordination items
- Suppression-list sync (which system is source of truth for opt-out? propose bidirectional).
- Confirm BC keeps the transactional sends (we're not duplicating signup/receipt).
- Optional later: BC exposing billing-event webhooks so *we* could own receipts too (not needed now).

## 7. Why this is the keystone for the retention cluster
Areas (iii) Alerts/monitoring and (v) freemium both **require an owned delivery + scheduling layer to
function**. This platform is that layer. Sequencing-wise it should land **right after** the
ship-now Identity Exposure snapshot, because everything durable about free-user retention (nudges,
monitoring alerts, win-back) rides on it. Start with Phase 0 + Phase 1 (abandoned-checkout) — smallest
surface, clearest ROI, proves the Vercel-backend approach before we build more on it.
