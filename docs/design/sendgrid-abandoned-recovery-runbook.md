# Abandoned-checkout recovery email — setup runbook

Built 2026-07-13. Everything in code is done and deployed (Vercel auto-deploys `seo/` from
`main`). The pipeline **no-ops safely** until the owner activation steps are complete, so
nothing sends prematurely.

> **Provider update (2026-07-26):** SendGrid account access was blocked ("not authorized to
> access this account"), so the send layer is now **provider-agnostic** (`emailProvider` in
> `send.mjs`). **Resend is the chosen alternate** — see "Alternate ESP: Resend" at the bottom.
> The SendGrid instructions below still work if that account is recovered; pick one provider.

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
- **Content branches on whether we know a target person:**
  - **With a target** (came from a teaser/SUP): subject *"Jane, unlock your report on John Q. Smith"*,
    a **Name / Age / Location** card, CTA "Unlock My Report" → `login?redirect=/people/:id` (resumes unlock).
  - **No target** (general/promo signup abandon — no report exists yet): honest account-activation
    copy instead of a phantom report — subject *"Jane, finish setting up your account"*, CTA
    "Finish Setting Up" → `login?redirect=/dashboard`. No person card.
  - Follow-up (24h) reuses the same branch with softer "still waiting / almost ready" wording.
  - Both: secure/cancel-anytime trust line, FCRA footer, one-click unsubscribe (SendGrid ASM).

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
| `EMAIL_ASM_GROUP_ID` | SendGrid unsubscribe-group id (one-click unsubscribe) | ✅ (chosen path) |
| `EMAIL_BASE_URL` | `https://www.idlookup.ai` | optional (default) |
| `EMAIL_BRAND_NAME` | `IDLookup` | optional (default) |
| `EMAIL_UNSUBSCRIBE_URL` | if not using ASM | optional |

Redeploy the SEO app after setting envs (or it picks them up on the next deploy).

## Verify after setup
1. Abandon a real checkout (reach `/payment`, leave) → row appears in `abandoned_checkouts`.
2. Wait 30 min → cron sends the 1st email (or hit the cron route manually with the Bearer secret).
3. Check `emailed_at` gets stamped; the email renders name/age/location + personalized subject.

## Unsubscribe — using SendGrid ASM (chosen)
`EMAIL_ASM_GROUP_ID` is the compliant path (owner decision 2026-07-13). When it's set, `send.mjs`
emits SendGrid's `<%asm_group_unsubscribe_raw_url%>` tag in the footer, which SendGrid replaces at
send time with a working per-recipient one-click unsubscribe, and enforces suppression server-side —
so no `/unsubscribe` handler is needed on our side. Just create the Unsubscribe Group in SendGrid
(Marketing → Suppressions → Unsubscribe Groups) and put its numeric ID in `EMAIL_ASM_GROUP_ID`.
(Leaving it unset falls back to a `/unsubscribe?e=…` URL that would need a handler — avoid.)

---

## Alternate ESP: Resend (chosen 2026-07-26)

The send layer (`seo/lib/email/send.mjs`) dispatches on `EMAIL_PROVIDER`. Setting it to `resend`
routes every send (abandoned-recovery, welcome, lead-drip) through Resend's API instead of SendGrid —
no template or cron changes. Unsubscribe is handled first-party (we already own the suppression list):
Resend sends carry an RFC 8058 `List-Unsubscribe` one-click header pointing at
`/api/email/unsubscribe`, which adds the address to `email_suppression`; `isSuppressed()` blocks it
before every future send.

### Owner step 1 — Resend account + domain auth
Sending domain FOR NOW = **`idlookup.me`** (owner 2026-07-27) — we already control its DNS (the SEO Vercel
app), the unsubscribe endpoint already lives there, so it's the fastest path. (Can move to a dedicated
`e.idlookup.ai` subdomain later to isolate marketing reputation.)
1. Create an account at **resend.com** (free tier: 3,000 emails/mo, 100/day — enough to start).
2. **Domains → Add Domain** → `idlookup.me`. Resend outputs DNS records (SPF + DKIM + return-path). Add them
   to **idlookup.me** DNS, then **Verify** (goes green). *(Domain auth is still required — a deliverability
   precondition for any ESP.)* Default from-address is `IDLookup <alerts@idlookup.me>`.
3. **API Keys → Create** → a key with send permission.

### Owner step 2 — Vercel env vars (SEO project → Settings → Environment Variables)
| Var | Value | Required |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | ✅ (selects Resend over SendGrid) |
| `RESEND_API_KEY` | the Resend API key | ✅ (sends no-op without it) |
| `EMAIL_FROM` | `IDLookup <alerts@idlookup.me>` (must be on the verified domain) | ✅ |
| `CRON_SECRET` | any random string (secures the crons) | ✅ |
| `EMAIL_UNSUBSCRIBE_URL` | `https://idlookup.me/api/email/unsubscribe` | optional (this is the default) |
| `EMAIL_BASE_URL` / `EMAIL_BRAND_NAME` | `https://www.idlookup.ai` / `IDLookup` | optional (defaults) |

Do **not** set `EMAIL_ASM_GROUP_ID` for Resend (that's SendGrid's server-side unsub; Resend uses our
first-party endpoint instead). Redeploy the SEO app after setting envs.

### Verify
1. Confirm `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` are set; redeploy.
2. Trigger a send (abandon a checkout, or hit the cron route with the Bearer secret) → check Resend's
   dashboard for the delivered event and `email_sends` for a logged row.
3. Click the footer **Unsubscribe** → confirmation page; verify the address lands in `email_suppression`
   and a subsequent send to it returns `status: 'suppressed'`.

---

## Lead-list re-engagement drip (built 2026-07-27)

Separate from abandoned-recovery: a 4-step remarketing series to the **internal lead list** (`leads` table —
un-converted emails who never subscribed), nudging them back into the name funnel (`/name/landing/v3`).

- **Templates:** `renderRemarketing(step)` in `send.mjs` (steps 1-4: results-ready → still-waiting →
  membership-value → last-chance). Registered as campaigns `lead_remarketing_1..4`.
- **Sequencing:** `getReengagementCandidates()` (leads-db) reads each unique, non-suppressed lead's progress
  from the shared `email_sends` log — no new state table. `cron/lead-reengagement` computes each lead's due
  step: step 1 after `LEAD_RM_FLOOR_HOURS` (default 12h, so we don't email a just-captured lead), then gaps of
  `LEAD_RM_GAP_DAYS` (default 2,3,4 days) → a ~9-day drip. `sendCampaign` de-dupes + logs, so a lead never
  gets a step twice and advances one step per eligible run.
- **Schedule/cap:** `0 */6 * * *` × `LEAD_RM_BATCH` (default 20) = **~80 sends/day** — under Resend's free
  100/day cap (shared with abandoned/welcome). Raise `LEAD_RM_BATCH` (and/or cadence) once on a paid plan.
- **Suppression/unsubscribe:** every send honors `isSuppressed` + carries the one-click List-Unsubscribe.
- **Known gap:** no clean "already converted" flag on `leads`, so the drip may reach a lead who since
  subscribed — copy is "come back/finish" (harmless), and they can unsubscribe. Add a BC/customer exclusion
  join later to tighten.
- **Activation:** rides the same Resend setup — nothing extra. No-ops until `RESEND_API_KEY` is set.
