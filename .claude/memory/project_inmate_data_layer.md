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
