---
name: project_email_recovery_pipeline
description: "Abandoned-checkout recovery email pipeline (SendGrid on the SEO Vercel app) — code done, pending owner SendGrid/DNS"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Abandoned-checkout recovery email, built 2026-07-13 on the idlookup.me **SEO Vercel+Neon app**
(the growth backend, independent of BC). Part of using that app to host email marketing too.

**Flow:** consumer `PaymentPage.fireAbandon` POSTs `/api/email/checkout-abandoned` on payment exit,
now carrying `meta.target={name,age,location}` (from `result_<personId>` sessionStorage) +
`meta.recipientName` (signed-in user's first name) → Neon `abandoned_checkouts` (+ `followup_at`).
Vercel Cron `app/api/cron/abandoned-recovery` (every 15 min, `CRON_SECRET`-guarded) sends via
`lib/email/send.mjs` (SendGrid): **1st email 30 min after abandon, 1 follow-up 24h later**; skips
rows with no email or `recovered_at` set; de-duped by email. Template `lib/email/checkout-abandoned.html`
(brand-green, Name/Age/Location card, personalized subject, CTA → `login?redirect=/people/:id`).

**Safe no-op** until `SENDGRID_API_KEY` set (send.mjs `hasSendgrid`) — deploying early does nothing.

**Copy branches on target presence:** with a target → "unlock your report on <name>" + Name/Age/Location
card + CTA→/people/:id; **no target** (general/promo signup abandon, no report exists) → honest
account-activation copy "finish setting up your account" + CTA→/dashboard, no card. Unsubscribe = SendGrid
**ASM** (owner choice): `EMAIL_ASM_GROUP_ID` set → send.mjs emits `<%asm_group_unsubscribe_raw_url%>`.

**Sending domain (2026-07-13):** idlookup.ai DNS is on Cloudflare **managed by BC** → can't auth
`e.idlookup.ai` yet. **Launch on `e.idlookup.me`** (owner controls that DNS); cut over to `e.idlookup.ai`
later = one-env swap (`EMAIL_FROM`) + re-auth, no code. Downside of `.me` = brand mismatch (.me vs .ai
reads phishing-ish → opens/complaints); mitigate with friendly From name "IDLookup". Verify idlookup.me
DNS is actually owner-controlled, not also BC-Cloudflare.

**Owner action items (see docs/design/sendgrid-abandoned-recovery-runbook.md + docs/design/growth-email.md):**
1. SendGrid domain-auth on **e.idlookup.me** (3 CNAME + SPF + DMARC) + unsubscribe group → `EMAIL_ASM_GROUP_ID`.
2. Vercel SEO-project envs: `SENDGRID_API_KEY`, `EMAIL_FROM="IDLookup <alerts@e.idlookup.me>"`, `CRON_SECRET`, `EMAIL_ASM_GROUP_ID`.
3. Upload consumer bundle `public.581b02fe.js` to BC (activates the richer target/recipient payload).

**PAUSED 2026-07-13** pending owner steps. Next focus = WSFY self-implementation ([[project_bc_consumer_feature_asks]]).

Reuses the [[project_seo_live_idlookup_me]] app + the `/api/leads` lead-capture pattern. Bundle-independent
of BC per [[feedback_bc_is_source_of_truth]]. Apply schema: `node --env-file=.env.local scripts/apply-sql.mjs <file>`.
