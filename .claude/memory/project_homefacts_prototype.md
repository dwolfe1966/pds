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

**Next data sources to wire (all free/public, same pre-cached JSON pattern as `scripts/fetch-acs.mjs`):** FEMA NRI (county, no key — easiest, covers disasters), NCES/Urban Institute Education Data API (schools), FBI CDE (crime, api.data.gov key), EPA EJScreen/ECHO (environment). Then add county/ZIP grain.

**CEO collateral:** redesign-concept Artifact (before→after, offender/records money-page, place×person bridge) — brand stays HomeFacts (evolve their blue, not IDL green), no "competitor" framing (thin-economics/LTV, Zillow is the real competition), only sourced numbers. Deck docs in docs/partnerships/homefacts-*.
