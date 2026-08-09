---
name: reference_service_budgets
description: "Where every paid external service's spend cap lives + how to watch usage (idlookup.me)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Metered external services on the SEO app and their spend guards (all fail-open, atomic per-day `tryConsume` upsert, cache-first where possible). Full table: `docs/ops/service-budgets.md`.

- **Enformion** — `enformionBudget.mjs`, `ENFORMION_DAILY_CAP` (+ `ENFORMION_WLH_DAILY_CAP` lane), person-keyed cache. Uncapped until env set.
- **PDL** — `pdlBudget.mjs`, `PDL_DAILY_CAP`, `PDL_COST_PER_MATCH`. Uncapped until set.
- **Browser.io (Browserless)** = `BROWSER_SERVICE_URL`; **2Captcha** = `CAPTCHA_SOLVER_KEY` (solves brokers'/DOC sites' reCAPTCHA for the inmate/sex-offender scrapers); **Twilio Lookup** = `phoneIntel.mjs`. These three had NO cap — added 2026-08-09 via new `lib/serviceBudget.mjs` (`tryConsumeService('browser'|'captcha'|'twilio')`), wired into `stateAdaptersBrowser.browserFunction`, `captchaSolver.solveImageCaptcha/solveRecaptcha`, and `phoneIntel`. **Safe default cap 200/day each** (owner chose safe-default over uncapped-until-set), env-overridable via `BROWSER_DAILY_CAP`/`CAPTCHA_DAILY_CAP`/`TWILIO_DAILY_CAP` (set 0 to uncap). Cap hit → skip paid call, self-gate to empty.
- **Watch spend:** `GET /api/service-usage?secret=<CRON_SECRET>` — today/last-30/est-cost/cap for all five.
- Site captcha is **Cloudflare Turnstile (free)**, not a spend line — don't confuse with the 2Captcha solver.
- Tables: `enformion_usage`, `enformion_usage_lane`, `pdl_usage`, `service_usage`. See [[project_incarceration_data_moat]], [[project_life_events_vertical]], [[project_social_presence]].
