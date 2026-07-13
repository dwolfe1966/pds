# Abandoned-checkout recovery email — setup runbook

Built 2026-07-13. Everything in code is done and deployed (Vercel auto-deploys `seo/` from
`main`). The pipeline **no-ops safely** until the two owner steps below are complete, so
nothing sends prematurely.

## What's built (code — done)
- **Signal (consumer):** `PaymentPage.fireAbandon` already POSTs to `/api/email/checkout-abandoned`
  on payment-page exit. Now also carries the **target person** `{name, age, location}` and the
  **recipient's first name** (in `meta`). Ships in `build/public.581b02fe.js` — **upload to BC**
  to activate the richer payload. (Recovery still works on older bundles, just less personalized.)
- **Store:** Neon table `abandoned_checkouts` (+ `followup_at`, partial indexes) — live.
- **Send:** `seo/lib/email/send.mjs` (SendGrid) + `checkout-abandoned.html` template.
- **Schedule:** `seo/app/api/cron/abandoned-recovery/route.js` + `seo/vercel.json` cron (every 15 min).

## Business logic (send timing)
- **Fires when:** user reached `/payment` (already signed up → we have their email) and left
  without completing. One row per abandonment.
- **1st email:** 30 min after abandonment (`EMAIL_FIRST_DELAY_MIN`, default 30).
- **1 follow-up:** 24h after the 1st email (`EMAIL_FOLLOWUP_DELAY_HOURS`, default 24).
- **Never sends if:** no email on the row, or `recovered_at` is set (converted). De-duped by email.
- **Content:** personalized subject with recipient name + target name; body shows a **Name / Age /
  Location** card when we know the target; CTA "Unlock My Report" → `login?redirect=/people/:id`
  (resumes the unlock flow) with UTMs; secure/cancel-anytime trust line; FCRA + unsubscribe footer.

## Owner step 1 — SendGrid domain authentication (subdomain)
Use a **dedicated sending subdomain** `e.idlookup.ai` (keeps marketing reputation off both the
SEO domain and BC's transactional domain).
1. SendGrid → **Settings → Sender Authentication → Authenticate Your Domain** → domain `idlookup.ai`,
   advanced/branded subdomain `e` (i.e. `e.idlookup.ai`).
2. SendGrid outputs **3 CNAME records** (DKIM + link branding). Add them to **idlookup.ai** DNS.
3. Add on the DNS side too:
   - **SPF** (TXT on `e.idlookup.ai`): `v=spf1 include:sendgrid.net ~all`
   - **DMARC** (TXT on `_dmarc.e.idlookup.ai`): `v=DMARC1; p=none; rua=mailto:dmarc@idlookup.ai`
4. Back in SendGrid, **Verify** → status goes green.
5. (Recommended) Create an **Unsubscribe Group** (Marketing → Suppressions → Unsubscribe Groups);
   note its numeric ID for `EMAIL_ASM_GROUP_ID` so SendGrid enforces unsubscribe + CAN-SPAM.

## Owner step 2 — Vercel env vars (SEO project → Settings → Environment Variables)
| Var | Value | Required |
|---|---|---|
| `SENDGRID_API_KEY` | SendGrid API key (Mail Send scope) | ✅ (sends no-op without it) |
| `EMAIL_FROM` | `IDLookup <alerts@e.idlookup.ai>` | ✅ |
| `CRON_SECRET` | any random string (Vercel auto-sends it as the cron Bearer) | ✅ (secures the cron) |
| `EMAIL_ASM_GROUP_ID` | SendGrid unsubscribe-group id | recommended |
| `EMAIL_BASE_URL` | `https://www.idlookup.ai` | optional (default) |
| `EMAIL_BRAND_NAME` | `IDLookup` | optional (default) |
| `EMAIL_UNSUBSCRIBE_URL` | if not using ASM | optional |

Redeploy the SEO app after setting envs (or it picks them up on the next deploy).

## Verify after setup
1. Abandon a real checkout (reach `/payment`, leave) → row appears in `abandoned_checkouts`.
2. Wait 30 min → cron sends the 1st email (or hit the cron route manually with the Bearer secret).
3. Check `emailed_at` gets stamped; the email renders name/age/location + personalized subject.

## Open compliance note
If you skip the SendGrid **ASM group**, the template's `{{unsubscribeUrl}}` points at
`/unsubscribe?e=…`, which needs a real handler. The ASM group is the low-effort compliant path —
prefer it.
