---
name: project_homefacts_prototype
description: HomeFacts replacement built at idlookup.me/homefacts — area-profile pages on the SEO public-data engine; deck collateral for NIC CEO
metadata:
  type: project
---

**HomeFacts replacement — built + deployed to idlookup.me/homefacts, 2026-07-29.** Owner wants to take over HomeFacts.com (NIC-owned, [[project_homefacts_traffic]] / docs/partnerships/homefacts-*) and pitch the NIC CEO. Decision: don't just mock it — build a working replacement on our own SEO Next.js engine ("we can TOTALLY DO BETTER right now").

**What HomeFacts is:** search a city/ZIP/address → an area profile (neighborhood summary, schools, crime, property, environmental hazards, natural disasters, demographics, neighborhood info, sex offenders). Current site = Bootstrap 3 / PHP 5.3 / #337ab7 blue, dated. Home H1 "Get Reliable Neighborhood Information Instantly"; #1 traffic = offenders/person-name; monetizes via a "Local Background Checks" affiliate handoff to TruthFinder/Intelius.

**Our build (seo/ app, Next.js 15 RSC + ISR 60d + Neon, inline styles via lib/ui.js):**
- `app/homefacts/page.js` — landing: client typeahead (`HomefactsSearch.js`) over the ~2,067-city index built from `data/state-slice.json`; 9-module overview (5 Live / 4 Soon badges); popular cities.
- `app/homefacts/[state]/[city]/page.js` — the area profile, all 9 modules + jump-nav. **LIVE on real data:** neighborhood summary + demographics + property (ACS 5-yr via `lib/facts.js` `getCityAcs`), neighborhood info (Wikidata chips + population trend PopChart + StateMap + NPS historic + LoC newspapers + notable people), and **registered sex offenders** (first-party Neon via `querySexOffenders` — Austin showed 16 real records locally). **PENDING modules** (schools, crime, environmental, natural-disaster) render the section + honestly name the real public source being wired (NCES / FBI Crime Data Explorer / EPA EJScreen-ECHO / FEMA National Risk Index) — NEVER fabricated numbers.
- `lib/homefacts.js` — `propertyStats`/`demographicStats`/`HF_MODULES`/`hfCityPath`/`hfStatePath`.
- URL grain = **city** (state-slice + city-acs are place-level; NO ZIP/county ACS yet — search box shows an honest "ZIP/address coming next" hint). State seg is bare 2-letter → middleware (`/people`+`/profiles` only) leaves `/homefacts` untouched.

**Deploy:** committed (5915055) + pushed main → Vercel auto-deploys idlookup.me (repo=pds, root=seo). Production `npm run build` clean. **Additive only** — no changes to existing routes/sitemap/robots/middleware. **Deliberately NOT in the sitemap** (prototype: live + demoable without mass-submitting ~2k pages to the young, indexing-sensitive domain — see [[project_seo_indexing_incident]]; sitemap/index decision pending owner).

**GRAIN MODEL (owner 2026-07-29):** an "area-profile" (= "property-profile", same thing) can be a **city, county, ZIP, or address**. Owner wants **both city AND ZIP grain** (resolved the advisor's "surface as owner decision" fork — owner said do it). Better page IA = LATER (owner deferred).
- Planned routes: city `/homefacts/[state]/[city]` (LIVE); ZIP `/homefacts/zip/[zip]`; county `/homefacts/[state]/county/[county]`; address = a SEARCH input (geocode → ZIP/city profile), not a static page.
- **ZIP/address SEARCH shipped 2026-07-29** (keyless, commit c407658): `app/api/homefacts/resolve/route.js` — ZIP→Zippopotam, address→Census geocoder → covered-city (exact slug) or nearest covered city (haversine), honestly labeled; profile shows "Showing {City} — the area we cover for {ZIP/address}" via `?from=`. `HomefactsSearch.js` calls it for ZIP/address, city names stay local typeahead.
- ⚠️ **BLOCKER for real ZIP/county DATA:** ACS at ZCTA + county **requires CENSUS_API_KEY** (verified: keyless → "Missing Key"). Owner HAS one (fetch-acs uses it, passed on CLI) but it's NOT in seo/.env.local or (likely) Vercel env. **Need CENSUS_API_KEY in env** → then build zip/county pages via **fetch-at-generation** (ISR caches 60d per page → no 33k pre-ingest needed). Requested from owner.

**FEMA disasters — LIVE 2026-07-29 (6th module, commit 4482f1b).** `scripts/fetch-fema-nri.mjs`: NRI county table from ArcGIS FeatureServer `services.arcgis.com/XG15cJAlne2vxtgt/.../National_Risk_Index_Counties/FeatureServer/0` (query where=1=1, paginate resultOffset+2000, ~3,232 counties, 18 hazards `{HZ}_RISKR`; note riverine flood = **IFLD** not RFLD; overall = RISK_RATNG Very Low→Very High). City→county via **FCC block API** (lat/lng→STCOFIPS). Writes `data/city-fema.json` keyed "ST/slug" (2,040/2,070 cities, ~885KB, committed). **Batch/incremental save** (BATCH 250) — first attempt lost everything to a single end-of-run write that never fired. `lib/homefacts.js` `getCityFema`/`femaRatingColor`; profile renders overall pill + top-6 hazard severity bars. Modules now **6 live / 3 soon**.

**Next data modules (free/public):** NCES (schools), FBI CDE (crime, api.data.gov key), EPA EJScreen/ECHO (environment) — each has grain friction; scope one at a time. AND the 4-grain data (real ZIP+county ACS) once CENSUS_API_KEY lands.

**CEO collateral:** redesign-concept Artifact (before→after, offender/records money-page, place×person bridge) — brand stays HomeFacts (evolve their blue, not IDL green), no "competitor" framing (thin-economics/LTV, Zillow is the real competition), only sourced numbers. Deck docs in docs/partnerships/homefacts-*.
