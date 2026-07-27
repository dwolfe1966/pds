# Config checklist — activating the recent builds (email, phone/email exposure, monitoring)

**Date:** 2026-07-27
All server-side keys live on the **idlookup.me (SEO) Vercel project → Settings → Environment Variables**.
`REACT_APP_*` are **build-time** consumer vars (in `.env.production`, baked into the bundle) — a different place.
Everything degrades to a safe no-op when its key is unset, so partial config never breaks anything.

---

## A. SEO Vercel env vars

### Core (shared) — verify set
| Var | Value | Status |
|---|---|---|
| `LEADS_DATABASE_URL` | Neon connection string (or `DATABASE_URL`/`POSTGRES_URL`) | ✅ already live (leads/enrichment work) |
| `CRON_SECRET` | any random string — secures all 3 crons (Vercel auto-sends it as the Bearer) | ⬜ **verify set** |

### Email / Resend — **the active to-do**
| Var | Value | Required |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | ✅ required (selects Resend) |
| `RESEND_API_KEY` | Resend API key (send scope) | ✅ required |
| `EMAIL_FROM` | `IDLookup <alerts@idlookup.me>` (on the verified domain) | ✅ required |
| `EMAIL_UNSUBSCRIBE_URL` | `https://idlookup.me/api/email/unsubscribe` | optional (this is the default) |
| `EMAIL_BASE_URL` / `EMAIL_BRAND_NAME` | `https://www.idlookup.ai` / `IDLookup` | optional (defaults) |
| _do NOT set_ `EMAIL_ASM_GROUP_ID` | (SendGrid-only; ignored under Resend) | — |

Optional drip tuning (defaults are fine): `EMAIL_FIRST_DELAY_MIN`=30, `EMAIL_FOLLOWUP_DELAY_HOURS`=24,
`LEAD_RM_FLOOR_HOURS`=12, `LEAD_RM_GAP_DAYS`=`2,3,4`, `LEAD_RM_BATCH`=20, `LEAD_RM_DELAY_MS`=600.
(`LEAD_RM_BATCH` × runs/day must stay under Resend's free 100/day cap — raise on a paid plan.)

### Twilio phone-intel (P2 `/phone/safe`) — already done
| Var | Value | Status |
|---|---|---|
| `TWILIO_API_KEY` / `TWILIO_API_SECRET` | the API-Key pair (SK… + secret) | ✅ set by owner |
| `TWILIO_SMS_PUMPING_RISK` | `1` to add the pricier fraud score | optional (default off) |

### HIBP breach (E3 `/email/exposure` + monitoring) — already done
| Var | Value | Status |
|---|---|---|
| `HIBP_API_KEY` | Core-1 key | ✅ set by owner |
| `BREACH_MONITOR_BATCH` / `BREACH_MONITOR_DELAY_MS` | scan pacing | optional (defaults 8 / 6500) |

_Not part of this work (other features, owner-managed): `ENFORMION_*`, `PDL_*`, `BROWSER_*`, `CAPTCHA_SOLVER_KEY`, `STATE_PROXY_URL`, `WSFY_APP_KEY`._

---

## B. DNS (Resend domain auth — required for email to deliver)
Verify **`idlookup.me`** in Resend (**Domains → Add Domain**). Add the SPF + DKIM + return-path records Resend
outputs to **idlookup.me** DNS → **Verify** (green). No email sends until this is green — it's a hard
deliverability gate, not optional.

---

## C. Consumer bundle deploy (BC VPS)
The consumer-side features ride the React bundle, **not** Vercel. The latest build (`public.d30d37e6.js`)
must be uploaded to BC to make these live: phone flows (P1 `/phone/landing/v1`, P2 `/phone/safe`, P3
`/phone/exposure`), email exposure (E3 `/email/exposure`), the My-Identity monitoring/breach UI, email-on-
payment capture, and the lead-search-capture (drip resume). *(The email drip + abandoned-recovery + breach
API all run server-side and do NOT need this deploy — but the landings/UI that feed them do.)*

---

## D. Order of operations
1. Set `CRON_SECRET` (if not already).
2. Create Resend account → verify `idlookup.me` domain (DNS) → create API key.
3. Set the **Email/Resend** env vars above on the SEO Vercel project.
4. **Redeploy** the SEO app (envs take effect on the next deploy).
5. Deploy the consumer bundle to BC (for the landings/UI).

## E. Verify
- **Email:** hit a cron route with the Bearer secret, or wait for the schedule → check Resend's dashboard +
  the `email_sends` table for `status:'sent'`. Click the footer Unsubscribe → row appears in
  `email_suppression`; a re-send returns `status:'suppressed'`.
- **Phone P2:** `/phone/safe` on a real number → line-safety panel shows type/carrier/risk.
- **Email E3:** `/email/exposure` on a breached email → breach summary.
- **Monitoring:** open `/my-identity` → breach section + monitoring hero; a new-breach event lands in My Activity.
