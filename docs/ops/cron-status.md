# Cron & async job status — idlookup.me (SEO/growth app)

Status of every scheduled and background job on the `seo/` app (idlookup.me + /homefacts) and the DB tables
they write. Source of truth: `seo/vercel.json` + `seo/app/api/cron/*` + the libs they call. Runtime "on/off"
depends on Vercel env vars (not visible in code) — check the Vercel dashboard + cron logs to confirm.

Last reviewed: 2026-08-09.

---

## Cron jobs (Vercel Cron, defined in `seo/vercel.json`)

All auth'd by `CRON_SECRET`; all hit one Neon DB (`LEADS_DATABASE_URL` || `DATABASE_URL` || `POSTGRES_URL`).
Schedules are **UTC**.

| # | Cron | Schedule | Runs real work when… | Default | Tables written |
|---|---|---|---|---|---|
| 1 | `breach-monitor` | `*/30 * * * *` (30 min) | `HIBP_API_KEY` set | **LIVE** (no feature flag) | `breach_monitor`, `identity_events` |
| 2 | `optout-recheck` | `0 9 * * *` (daily 09:00) | DB set | **LIVE** (no feature flag) | `identity_events` |
| 3 | `abandoned-recovery` | `*/15 * * * *` (15 min) | `ABANDON_ENABLED=1` **or** `ABANDON_TEST_EMAIL`, **and** email provider, **and** `EMAIL_POSTAL_ADDRESS` | **OFF (gated)** | `abandoned_checkouts`, `email_sends` |
| 4 | `lead-reengagement` | `0 */6 * * *` (6h) | `LEAD_RM_ENABLED=1` **and** email provider | **OFF (gated)** | `email_sends` |
| 5 | `wsfy-alerts` | `0 */8 * * *` (8h) | `WSFY_ALERTS_ENABLED=1` **or** test email, **and** email provider, **and** `EMAIL_POSTAL_ADDRESS` | **OFF (gated)** | `email_sends` |

**By default only #1 and #2 mutate data.** #3–5 are safety-gated OFF *and* depend on the email provider
(Resend), which is paused pending domain-auth — so they're double-blocked from sending.

### Per-cron detail
- **breach-monitor** — re-scans enabled monitored emails vs HIBP (oldest-checked batch of ~8/run, paced under
  the rate limit), diffs vs last-known, logs new-breach `identity_events`. Writes `breach_monitor` (last state).
- **optout-recheck** — the digital-footprint monitoring loop. Finds exposure-graph removals whose
  `relist_days` window lapsed and logs a "time to re-check" `identity_events` (recheck-only, never asserts
  reappearance). Dedup per re-list window. Reaches members via the bell + My Activity (no email needed).
- **abandoned-recovery** — abandoned-checkout drip (1st at 30 min, follow-up at 24h). Atomic claim on
  `abandoned_checkouts` prevents dupes; enriches (Enformion) + mints BC auto-login + sends (Resend); logs
  `email_sends`. Daily cap + per-run batch + CAN-SPAM postal gate + DB kill-switch (`email_kv` flag
  `abandon_paused`, toggled via `/api/abandon-status?pause=1|resume=1`).
- **lead-reengagement** — 4-step remarketing drip to un-converted leads; step progress tracked via
  `email_sends`. ⚠️ see risk #1 below.
- **wsfy-alerts** — "who's searching for you" hook email. Pass 1 = self-identified leads (real count, from
  WSFY tables). Pass 2 = broad lead list, held behind `WSFY_ALERTS_INCLUDE_ALL_LEADS=1` (the `leads` table
  has no payment marker, so the broad list includes paying members). Logs `email_sends`.

### Tables written by crons (consolidated)
`breach_monitor` · `identity_events` · `abandoned_checkouts` · `email_sends`
Read-only in crons: `leads`, `email_suppression`, `email_kv`, `source_registry`, `exposure_node`, WSFY tables.

---

## idlookup.me/homefacts — no crons
Zero cron/async DB jobs. HomeFacts modules (air quality, flood risk, earthquakes, crime, landmarks, address
map) fetch external APIs **on demand and cache via Next.js ISR** (page-level `revalidate`); they don't write
DB tables and aren't scheduled.

---

## Other async writers (request-triggered, not scheduled)
Background DB writes driven by user actions, for completeness:
- **breach-sync** (My Identity load, auto-enroll) → `breach_monitor`, `identity_events` (same writers as cron #1)
- **protection-history** (footprint load) → `protection_snapshot`
- **exposure** / **exposure-detection** (controls + extension) → `exposure_node`, `exposure_event`, `identity_events`
- **history** (extension, consented) → `browsing_history` (+ consent)
- **partner-referral** → `partner_referral`
- funnel events → `leads`, `abandoned_checkouts`, plus `search_activity` / `profile_view` logging

---

## Risks / watch-items
1. **lead-reengagement floor** — `LEAD_RM_FLOOR_HOURS` default is now **12** (fixed 2026-08-09; was 0, a test
   value). Harmless while the cron is gated off, but confirm it's 12 (or set `LEAD_RM_FLOOR_HOURS` on Vercel)
   before flipping `LEAD_RM_ENABLED=1`, or a just-captured lead is emailed immediately.
2. **Email provider** — the 3 email crons can't send until Resend is configured (key) + `EMAIL_POSTAL_ADDRESS`
   is set (CAN-SPAM). Verify in Vercel before enabling any of them.
3. **Runtime confirmation** — Vercel cron logs show each run's JSON result, including the `skipped: '…'` reason
   for gated crons. That's the fastest way to confirm what's actually running.
