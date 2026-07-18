# Data Sources — Consolidated Status (Enformion + Inmate) — 2026-07-18

Single snapshot of every incarceration/person data source we've integrated, its state, and what's
blocking each. Detail docs: `docs/inmate-data-activation.md`, `docs/person-enrichment-personsearch.md`.
Memory: `project_inmate_data_layer`, `project_personsearch_enrichment`.

---

## TL;DR status table

| Source | Product | Code | State | Blocker / TODO |
|---|---|---|---|---|
| **Florida OBIS** | FL inmate bulk | ✅ built + ingested | **LIVE-READY** (670k rows, 99.6% w/ charges, mugshot URLs) | none — deploy + point consumer env |
| **Enformion PersonSearch** | person enrichment | ✅ built + wired + validated | **works today** (no gate) | owner: `ENFORMION_ENRICH_PERSIST=1` on Vercel + paid plan for volume |
| **Enformion Criminal Search V2** | nationwide criminal + mugshots | ✅ adapter built | **BLOCKED** | Enformion **Sales** must enable the product on the AccessProfile (owner messaged Sales) |
| **UnlimitedCriminalChecks (UCC)** | criminal + mugshots | ⚠️ adapter (unverified) | pending | owner: key + **written display permission**; confirm req/resp shape |
| **JailBase** | county booking + mugshots | ✅ adapter (RapidAPI) | flaky | JailBase upstream intermittently 503s; enrichment-only, not backbone |

---

## 1. Florida OBIS — LIVE-READY (free, FL depth)
- Ingested all 3 dirs (INMATE_ACTIVE / INMATE_RELEASE / OFFENDER) → Neon `fl_inmates`: **667,829 / 670,606
  rows (99.6%) carry charges**; facility/custody/release populated after the column-name fix.
- Real bug fixed: wrong OBIS column names (`adjudicationcharge_descr`, `FACILITY_description`,
  `custody_description`, `County_of_Conviction`) + double-JSON-encoding + only-one-offense-file parsed.
- **Mugshots**: FL DOC pattern `https://pubapps.fdc.myflorida.com/inmatephotos/{firstCharOfDC}/{DCNumber}.jpg`.
- Provider `floridaObis` in `seo/lib/incarceration.mjs` queries `fl_inmates` (FL/stateless only).
- **To activate**: deploy SEO app + set `REACT_APP_INCARCERATION_URL` (or it derives from LEAD_CAPTURE_URL).

## 2. Enformion PersonSearch — WORKS TODAY (person enrichment, no criminal gate)
- Enabled on the current AccessProfile. Returns full person record: relatives (w/ relationship), address/
  city history, aliases, age, phones, emails, **opt-out flag**.
- Used INTERNALLY to enrich `member_enrichment.relatives` + `past_locations` → lights up WSFY affinities
  `verified_relative` / `shared_relative` / `past_local`. **No display of raw data** → no display-rights gate.
- Guards: corroboration (age±2 or city or it refuses), opt-out honored, fill-only, once/member.
- **Retention CONFIRMED by owner 2026-07-18** — persist gated on `ENFORMION_ENRICH_PERSIST=1`.
- Endpoints: `seo/app/api/enrich-person`; client `enrichViaPersonSearch()` (card-capture trigger).
- **Base URL = `https://devapi.endato.com`** (NOT api.enformion.com — that 404s). Auth: `galaxy-ap-name` /
  `galaxy-ap-password` headers + `galaxy-search-type: Person`. Endpoint `POST /PersonSearch`.
- **Owner TODO**: (a) set `ENFORMION_ENRICH_PERSIST=1` on Vercel; (b) upload consumer bundle
  public.389f19e3.js; (c) ⚠️ **free tier = 100 searches/mo — production needs a PAID plan**.

## 3. Enformion Criminal Search V2 — BLOCKED (Sales gate)
- Adapter built + validated to the confirmed spec: `POST https://devapi.endato.com/CriminalSearch/v2`,
  header `galaxy-search-type: CriminalV2`, request `OffenseState`, response `records[].Photos[].ImageUrl/
  ThumbUrl` (mugshot), `Offenses[].OffenseDescription`, `Addresses[].County/State`.
- **Blocker**: API returns *"Access Profile does not permit client to call Criminal Search V2."* Tested with
  TWO different AccessProfiles (both valid for PersonSearch, neither permitted for Criminal). It's a
  **product-permission gate — Enformion Sales must enable it**. Owner has messaged Sales (2026-07-17).
- Also confirm **written consumer-display permission** (non-CRA, mugshots) before enabling in prod.
- Once enabled: drop the permitted profile's creds in `.env.local` / Vercel, run one live sample, confirm
  the records key + field names against `enformion()` in `seo/lib/incarceration.mjs` (one-line if different).

## 4. UnlimitedCriminalChecks (UCC) — pending (self-serve display candidate)
- Adapter in `incarceration.mjs` → `ucc()` (best-effort shapes, unverified). Self-serve, ~$0.006–0.01/search,
  bundles DOC/arrest/mugshot/court/sex-offender.
- **Owner TODO**: dev account + API key (25 free credits, no approval) + **⚠️ written display permission**
  (their default posture is "informational, not FCRA"). Confirm exact req/resp shape in the trial.
- Env: `UCC_API_KEY`, `UCC_API_URL`.

## 5. JailBase — flaky enrichment (free county bookings)
- Adapter WIRED for the **RapidAPI** tier (direct jailbase.com 503s datacenter IPs). Endpoints `/search/`,
  `/recent/`, `/sources/` (NOT `/search_records/` → 404s). Env `JAILBASE_RAPIDAPI_KEY`.
- **Caveat**: JailBase's own upstream intermittently 503s (their service). Degrades gracefully (returns 0,
  never crashes). Coverage-fill only, not the backbone.

---

## The funnel integration (already built, safe-by-default)
- `InmateBookingTeaser` — locked/blurred tease on `/name/landing/v3` (details step) + PaymentPage.
- `InmateBookingSection` — full delivered report on the member report/detail page.
- Both self-gate (render nothing until a provider returns records) → safe in the live funnel now.
- `POST /api/incarceration` (provider-abstracted, `Promise.allSettled`, dedupe by name|bookingDate|facility).

## Standing constraints (non-negotiable)
- Secrets **env-only**, never in code/commits (verify `git diff --cached | grep <value>`). Rotate any
  creds pasted in chat.
- **Display rights are the binding constraint, not the tech** — get written consumer-display permission
  before displaying UCC/Enformion criminal records (incl. mugshots).
- **Retention** is the adjacent gate (confirmed OK for Enformion 2026-07-18).
- **Never** operate pay-to-remove on mugshots (~18 states outlaw it); free prompt takedown + suppress
  expunged/sealed; honor opt-out flags.
