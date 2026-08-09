# Metered-service spend guards — idlookup.me

Every paid/rate-limited external service, its daily cap lever, and how to watch spend. All guards are
**fail-open** (a DB blip never blocks the feature) and **cache-first where possible** (caps only meter live,
billable calls). Reviewed 2026-08-09.

## Watch spend
`GET /api/service-usage?secret=<CRON_SECRET>` → today + trailing-30-day calls, est. cost, and the active cap
for Enformion, PDL, Browser.io, 2Captcha, and Twilio, in one JSON.

## Caps by service

| Service | Cap env | Default | Cost env (est) | Guard location | Cache |
|---|---|---|---|---|---|
| Enformion | `ENFORMION_DAILY_CAP` (+ `ENFORMION_WLH_DAILY_CAP` lane) | **uncapped** until set | — | `enformionBudget.mjs` | person-keyed |
| PDL | `PDL_DAILY_CAP` | **uncapped** until set | `PDL_COST_PER_MATCH` ($0.28) | `pdlBudget.mjs` | — |
| Browser.io (Browserless) | `BROWSER_DAILY_CAP` | **200/day** | `BROWSER_COST_PER_CALL` ($0.01) | `serviceBudget.mjs` → `stateAdaptersBrowser.browserFunction` | DB rows served first |
| 2Captcha (solver) | `CAPTCHA_DAILY_CAP` | **200/day** | `CAPTCHA_COST_PER_SOLVE` ($0.003) | `serviceBudget.mjs` → `captchaSolver.solve*` | — |
| Twilio Lookup | `TWILIO_DAILY_CAP` | **200/day** | `TWILIO_COST_PER_LOOKUP` ($0.008) | `serviceBudget.mjs` → `phoneIntel` | phoneIntelDb |
| Email (Resend/SendGrid/SES) | `ABANDON_DAILY_CAP` + per-run batch | ramp | — | `emails-db.mjs` | suppression + kill-switch |
| HIBP | (rate tier) | cron batch/pacing | — | `breachSync` / `emailExposure` | cache-first (self-check free) |

### Notes
- **Browser.io + 2Captcha ship a SAFE DEFAULT cap of 200/day** (owner 2026-08-09) — unlike Enformion/PDL
  (uncapped-until-set), because these had no guard and their keys weren't live yet. So they're protected the
  moment `BROWSER_SERVICE_URL` / `CAPTCHA_SOLVER_KEY` are switched on. Set the env vars to raise/lower; set to
  **0** to explicitly uncap.
- When a cap is hit the paid call is **skipped and the feature self-gates** (browser/captcha → empty results,
  Twilio → the descriptive signal is just absent). No user-facing error, no partial charge.
- Site bot-protection is **Cloudflare Turnstile** (free, via BC) — not a spend line. 2Captcha is the reverse:
  it *solves* other sites' reCAPTCHA/Enterprise for the inmate/sex-offender scrapers.
- Est. costs are rough, for the dashboard only — tune the `*_COST_*` envs to your real rates.

## Tables
`enformion_usage`, `enformion_usage_lane`, `pdl_usage`, `service_usage` (browser/captcha/twilio), plus the
email logs (`email_sends`) and per-feature caches (`phone_intel`, exposure/incarceration DB rows).
