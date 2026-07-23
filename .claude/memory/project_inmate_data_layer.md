---
name: project_inmate_data_layer
description: First-party incarceration/booking data layer on idlookup.me Vercel (JailBase + UnlimitedCriminalChecks) powering the /name/landing/v3 inmate funnel; investment priority
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

**Strategic frame (owner 2026-07-17):** paid search is the main acquisition channel; the primary
focus is **inmate searches**. Investment order set: **#1 inmate-data enrichment**, **#2 email engine**.
The proven winning pattern = **building first-party APIs on the idlookup.me Vercel+Neon server**,
independent of BC. Inmate data + email both ride that pattern.

## Built 2026-07-17 (commit `1c6b1e2`, NOT yet on Vercel/BC)
- **`seo/lib/incarceration.mjs`** — provider-abstracted layer. Normalized `BookingRecord` (name/age/
  gender/race/charges[]/mugshotUrl/bookingDate/facility/county/state). `findBookings(query, env)` runs
  all enabled providers (Promise.allSettled → never throws), dedupes by name+date+facility (prefers a
  mugshot). Adapters:
  - **JailBase** (free, no key): documented shape `records[]` (first/last/age/gender/race, booking_date,
    source_id/source_name, state/county, charges, mugshot img URL, details[[label,value]]). Search is
    BY SOURCE (jail) — nationwide-by-state needs the sources list first (POC passes optional sourceId).
    ⚠️ JailBase **503s datacenter IPs** — Vercel serverless may be blocked → may need RapidAPI/paid tier
    or a residential proxy.
  - **UnlimitedCriminalChecks** — env-configured (`UCC_API_KEY`, `UCC_API_URL`); defensive best-effort
    mapper (exact fields TO FINALIZE IN TRIAL). Only enabled when the key is set. **Owner securing
    consumer-DISPLAY permission in writing — required before enabling** (research: docs/research/
    incarceration-data-apis.md — display rights are the binding constraint, not tech).
- **`seo/app/api/incarceration/route.js`** — POST endpoint (keys stay server-side).
- **Client:** `src/services/incarcerationService.js` + **`InmateBookingTeaser`** — real booking records
  (blurred mugshot thumbs + charge counts) on the **`/name/landing/v3` 'details' step**
  (NameSearchLandingV3Page.js, the incarceration-themed funnel). **SAFE-BY-DEFAULT: renders NOTHING
  until a feed is live** (count 0), so it's already in the live funnel with zero disruption.

## Update 2026-07-17 — JailBase wired but unreliable; Florida OBIS built + verified
- **JailBase → RapidAPI (commit `c5c78e3`):** owner subscribed; adapter now uses the RapidAPI host,
  env-keyed (`JAILBASE_RAPIDAPI_KEY`, host default `jailbase-jailbase.p.rapidapi.com`, endpoint `/search/`
  — NOT `/search_records/`, that 404s). Auth VERIFIED working. **BUT JailBase's own origin 503s
  persistently all session** (their service — nginx 503 through RapidAPI's proxy) → can't get live data.
  Key is ENV-ONLY, never committed; local copy in gitignored `seo/.env.local`. **Owner pasted the key in
  chat → suggested rotating.** Treat JailBase as flaky enrichment, not the backbone.
- **Florida OBIS (commit `d951782`) — the reliable source we control.** FL DOC's full inmate DB = free
  monthly tab-delimited zips (fdc.myflorida.com), no key/permission. `scripts/ingest-florida-obis.mjs`
  (header-driven, streaming, batched upsert → Neon `fl_inmates`; joins offenses+aliases by DC number).
  `florida-obis` provider queries fl_inmates (FL/stateless only). **Verified end-to-end** (synthetic FL
  inmate → findBookings count 1, normalized w/ computed age + charges). To load real data: download+unzip
  OBIS → `node --env-file=.env.local scripts/ingest-florida-obis.mjs <dir>`. Confirm the exact column
  header names on first run (parser is fuzzy-header-mapped; add aliases in COLS if a field is blank).

## Florida OBIS FULLY LOADED 2026-07-17 (commit `cb32d62`) — the live inmate source
**670,606 FL inmates in Neon `fl_inmates`; 667,829 (99.6%) with charges, 190,145 with facility, 666,425
with readable custody status.** Verified through the adapter (Mary Jones/FL → age, ACTIVE, FT. PIERCE, 6
charges w/ county). OBIS files live on disk at `seo/obis/` (3 dirs: INMATE_ACTIVE / INMATE_RELEASE /
OFFENDER + .mdb + .XLSX). Real OBIS column names (confirmed from the files): DCNumber, LastName/FirstName,
Race/Sex/BirthDate, `custody_description`/`supvstatus_description` (status), `FACILITY_description`/
`facility_description`, `PrisonReleaseDate`/`SupervisionTerminationDate`; offense files use
`adjudicationcharge_descr` + `County_of_Conviction`. The ingest maps all of these now.
**NO mugshots in OBIS** (booking display shows 👤 placeholder + charges/facility/status). FL DOC offender
photos exist at a URL pattern (dc.state.fl.us/OffenderSearch) — a future enhancement; JailBase/UCC would
add mugshots too. Re-load monthly: re-run the ingest per dir (idempotent upsert by dc_number).

## Email platform (investment #2) — foundation built 2026-07-17 (commit `afed7c3`)
`sendCampaign` (suppression-aware + logged), `email_sends`/`email_suppression` Neon tables, generic
`POST /api/email/send`, welcome flow. Env-gated on `SENDGRID_API_KEY` — blocked only on owner SendGrid
domain-auth. See [[project_email_recovery_pipeline]].

## To activate (owner + trial)
1. **JailBase**: solve the datacenter-IP block (RapidAPI tier or proxy); it's per-jail (source_id) so
   decide state coverage strategy (fetch sources list per state, or start with high-volume jails).
2. **UCC**: get key + **written consumer-display permission**; finalize the field mapper in the trial;
   set `UCC_API_KEY`/`UCC_API_URL` on Vercel.
3. **Florida OBIS** (free bulk state roster) = cheap depth for one big state — not built yet.
4. Env: `REACT_APP_INCARCERATION_URL` (or derives from `REACT_APP_LEAD_CAPTURE_URL`).

## Data-source strategy (from the two research docs)
- **Display rights are the gate, not tech.** Enterprise feeds (CLEAR/TLOxp/Accurint/VINE-Appriss/IDI)
  forbid consumer redisplay. Self-serve aggregators (Enformion/Endato lead, Tracers deep, JailBase free,
  UCC) are the consumer-displayable tier — verify (a) booking data is in-API and (b) display permitted.
- **IDI-through-Vercel** is technically possible but the license (NOT tech) governs public use — and IDI
  DOES have a paid **~$6k/mo SEO/display data class** ([[project_seo_idi_display_license]]); standard tier
  prohibits it. IDI stays for the gated paid report; public/inmate display uses a display-rights source.

Relates to [[project_growth_plan_2026_07_11]] (email = investment #2, the retention keystone),
[[project_email_recovery_pipeline]] (abandoned-checkout exists, PAUSED on SendGrid domain-auth),
[[project_seo_idi_display_license]].


**⚠️ FRESHNESS CHECK 2026-07-23:** DB IS updating (`inmates` table = 544,846 rows; last_crawled max = seconds ago; 23,715 crawled in last 2 days) — but that's from LIVE/on-demand crawls (real searches), NOT the batch. The SCHEDULED daily refresh (`.github/workflows/crawl-inmates.yml`, cron 07:00 UTC) has been FAILING 7/22 + 7/23 (4s fails) — root cause = **GitHub Actions BILLING** ("job was not started because recent account payments have failed or your spending limit needs to be increased"). Last successful full crawl = 7/21 (manual dispatch). So most states are frozen at 7/21; only searched states stay fresh. **Sex-offender crawler (`crawl-sex-offenders.mjs`) has NO scheduled workflow** — manual/on-demand only. OWNER FIX: GitHub Settings → Billing & plans (resolve failed payment / raise Actions spend limit) → daily cron resumes. DB freshness query: `node --env-file=seo/.env.local` on the `inmates` table.
