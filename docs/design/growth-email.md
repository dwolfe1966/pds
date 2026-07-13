# Growth · Email platform — current state (2026-07-13)

Our own email-marketing infrastructure, hosted on the **idlookup.me Vercel + Neon app**
(the "growth backend"), fully **independent of BC**. BC serves only the static consumer
bundle, which makes fire-and-forget POSTs to our API. See also the setup runbook:
`docs/design/sendgrid-abandoned-recovery-runbook.md`.

## Architecture (one backend, three jobs)
The idlookup.me Vercel app now does three things: (1) SEO directory, (2) lead capture,
(3) email marketing. All three share the same Neon Postgres. Independence from BC is a hard
requirement — the consumer only ever POSTs to us; nothing about email touches BC.

```
Consumer (idlookup.ai, on BC VPS)                idlookup.me (Vercel + Neon) — growth backend
  captureEmail() ───────────────────────────────▶ POST /api/leads            → leads
  captureAbandonedCheckout() (PaymentPage) ──────▶ POST /api/email/checkout-abandoned → abandoned_checkouts
                                                   Vercel Cron */15 ─▶ /api/cron/abandoned-recovery
                                                                        → SendGrid (recovery emails)
```

## What's built & shipped (code done, deployed to Vercel via main)
- **Lead capture everywhere**: `src/services/emailCapture.js` `captureEmail()` is called from
  every capture surface (signup `useSignup`, BV loader gate, Contact form). POST `/api/leads`.
- **Abandoned-checkout recovery** (the first real campaign):
  - Signal: `PaymentPage.fireAbandon` POSTs `/api/email/checkout-abandoned` on payment-page exit,
    carrying `meta.target={name,age,location}` (from `result_<personId>` sessionStorage) and
    `meta.recipientName` (signed-in user's first name).
  - Store: Neon `abandoned_checkouts` (+ `followup_at`, partial indexes). Live.
  - Send: `seo/lib/email/send.mjs` (SendGrid) + `seo/lib/email/checkout-abandoned.html`.
  - Cadence: **1st email 30 min after abandon, 1 follow-up 24h later.** De-duped by email; never
    sends without an email or after `recovered_at` is set.
  - Cron: `seo/app/api/cron/abandoned-recovery/route.js` + `seo/vercel.json` (every 15 min),
    `CRON_SECRET`-guarded. **No-ops safely until `SENDGRID_API_KEY` is set** — safe to deploy early.
  - **Copy branches on target presence** (important):
    - With target: subject "Jane, unlock your report on John Q. Smith", Name/Age/Location card,
      CTA "Unlock My Report" → `login?redirect=/people/:id`.
    - No target (general/promo signup abandon — no report exists): honest account-activation copy,
      subject "Jane, finish setting up your account", CTA "Finish Setting Up" → `/dashboard`, no card.
  - **Unsubscribe = SendGrid ASM** (owner choice): `EMAIL_ASM_GROUP_ID` set → send.mjs emits
    `<%asm_group_unsubscribe_raw_url%>` → working one-click unsubscribe + server-side suppression;
    no `/unsubscribe` handler needed.

## Sending-domain decision (2026-07-13) — ⚠️ open
DNS for **idlookup.ai** is on Cloudflare **managed by BC** → we can't add SendGrid records to
`e.idlookup.ai` yet. Decision:
- **Launch on `e.idlookup.me`** (owner controls that DNS → SendGrid domain-auth unblocked NOW).
- **Cut over to `e.idlookup.ai` later** once BC/Cloudflare control is regained — it's a one-env-var
  swap (`EMAIL_FROM`) + re-run SendGrid domain auth. Zero code change.
- Downside of `.me` sending: **brand mismatch** — recipients know idlookup.ai, and `.me` vs `.ai`
  looks like a phishing lookalike → slightly lower opens + more spam complaints (which hurt sender
  reputation over time). Mitigate with a friendly From **name** ("IDLookup"). DMARC/DKIM/SPF align
  fine on `.me` since we control it; SEO risk to the directory is negligible (email vs search
  reputation are separate systems). Use a subdomain `e.idlookup.me`, keep the root clean.
- **Verify first**: confirm idlookup.me DNS is actually owner-controlled (registrar/Vercel), not
  also on the same BC Cloudflare.

## Owner action items (nothing else blocks send)
1. SendGrid domain-auth on **`e.idlookup.me`** (3 CNAME + SPF + DMARC on idlookup.me DNS).
2. Create SendGrid **Unsubscribe Group** → put its id in `EMAIL_ASM_GROUP_ID`.
3. Vercel (SEO project) envs: `SENDGRID_API_KEY`, `EMAIL_FROM="IDLookup <alerts@e.idlookup.me>"`,
   `CRON_SECRET`, `EMAIL_ASM_GROUP_ID`.
4. Upload consumer bundle `public.581b02fe.js` to BC (activates the richer target/recipient payload).

## Status: PAUSED here (2026-07-13)
Email work is paused pending the owner steps above. Next focus = **WSFY self-implementation**
(see the WSFY plan / memory). Files: `seo/lib/email/*`, `seo/app/api/email/*`,
`seo/app/api/cron/abandoned-recovery/*`, `seo/db/abandoned-checkouts-schema.sql`, `src/services/emailCapture.js`.
