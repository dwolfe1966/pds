---
name: project_life_events_vertical
description: "Divorce/marriage/sex-offender \"life events\" acquisition vertical — data providers, funnel teasers, member mapping, caching"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Second acquisition vertical after inmate (see [[project_incarceration_data_moat]]): **life events** = divorce + marriage records (Enformion) and sex-offender data (NSOPW scrape). Same playbook: differentiated DATA HOOK → landing/SERP/SUP teaser → map records to existing members/profiles ([[feedback_map_records_to_members]]).

## Data providers (as of 2026-07-11)
- **Enformion/Endato** (galaxy-ap-name/password headers): **Divorce Search ENTITLED + working** ($0.05, POST /DivorceSearch, header `galaxy-search-type: Divorce`; dev host `devapi.endato.com` works, prod `api.endato.com/DivorceSearch` 404s — owner must confirm prod path). **Marriage Search = Pro-plan-only, access-denied** ($0.10) — owner TODO to enable. Criminal V2 ($2/search, Pro-only) → SKIP, validated the scraping moat instead.
  - Divorce record = TWO parties: `spouse*` fields = searched person, `otherSpouse*` = ex. Top-level firstName is empty — map from spouse fields. **DROP SSN** (never display/store).
  - ⚠️ Verify Enformion billing model (per-search-with-results vs per-record) before scaling v12.
- **NSOPW** (nsopw-api.ojp.gov/nsopw/v1/v1.0/search): behind Cloudflare → BROWSER-TIER via Browserless BQL `verify(type:cloudflare)` (same pattern as AZ inmate adapter). ALIAS match (primary registry name often ≠ search name → high false-positive risk). Location-only zip search works (no name; 33301→130). ~10s/call.
- **IDI/idiCORE** (via BC): has criminal/court/sex-offender + civil (likely divorce/marriage) but public-display licensing wall ([[project_seo_idi_display_license]]). Owner TODO: get IDI data-dictionary from BC for marriage/divorce coverage.

## Sex-offender placement (owner-corrected)
Do NOT attribute sex-offender records to a person's REPORT (alias match = wrong-person risk, high stakes). Instead: **location-based on MY profile** — "offenders near <my current location>", not linked to any specific person. `SexOffenderSection` (person-attributed) kept UNWIRED for a future DATING vertical ("Safety Check"). `NeighborhoodSafetySection` (location-based) wired to member identity, keyed on member address zip.

## Matching principle (same as inmate)
LOOSE (name+state) pre-signup teasers to convert; TIGHT post-pay for attribution. Divorce/marriage carry NO age → always "possible match — verify," never assert identity. `corroboratePerson(record, person, {pad})` in incarcerationService.js (age±pad + gender-must-match-when-known).

## Dating vertical (angle #2) — BUILT 2026-07-19
Second acquisition vertical, reuses the life-events plumbing. flow='dating'. "Is this person safe/real/single?"
- **v14 landing** (`/name/landing/v14`, `NameSearchLandingV14Page`) → VerticalIntentLanding, DATING_CFG (v13 was already taken = death).
- **`DatingTeaser`**: capability tease (the full safety check the paid report runs) + the cheap/cached marriage/divorce reveal ("are they really single?"). Loose on landing/SERP, strict on SUP.
- **CRITICAL (owner + advisor 2026-07-19): NO sex-offender fetch pre-signup** — not even a blurred count. A loose name+state NSOPW match can't corroborate age/gender, so a "safety record" teaser is an implicit claim about a named person = the wrong-person harm removed from the report, made looser. Also NSOPW is ~10s browser-tier (blank box at conversion). SO check is POST-PAY only.
- **Report payoff** (post-pay, `getFlow()==='dating'` only): `SearchResultDetailPage` fetches lifeEvents with `sexOffender:true`, filters `recordType==='sex-offender'` through `corroboratePerson` (age±1 + gender + state) BEFORE rendering `SexOffenderSection`. `corroboratesAge` returns false when either age missing → empty-and-safe. NSOPW records carry age+gender so corroboration bites. Distinct framing from location-based "offenders near them" (FamilyWatchdog/NeighborhoodSafety).
- Teaser wired: landing details + SERP (loose) + SUP (strict), all flow-gated on 'dating'.

## Funnel wiring (flow-aware, via funnelFlow service, session key 'funnelFlow')
- **v12 landing** (`NameSearchLandingV12Page` → `VerticalIntentLanding`, DIVORCE_CFG): sets `flow:'divorce'`, renders `DivorceTeaser` at details step (loose).
- **SERP** (`SearchResultsPage`): DivorceTeaser loose when `getFlow()==='divorce'`.
- **SUP** (`SupTeaserA`): DivorceTeaser **strict** when flow==='divorce' (age-filter records carrying age, cap top 2, "Possible record — verify").
- **Report + identity** (`SearchResultDetailPage`, `AccountPage` identity subtab): `MarriageDivorceSection` + ex-spouse→relatives merge.

## Key files
- `seo/lib/lifeEvents.mjs` (divorce/marriage/sexOffender providers + `findLifeEvents` orchestrator + cache), `seo/lib/lifeEventsDb.mjs` (person-keyed `life_events_cache` table, 60-day TTL, keyFor=recordType:first:last:state), `seo/lib/sexOffender.mjs` (envelope `{count,records}` NOT bare array), `seo/app/api/life-events/route.js` (POST, CORS allowlist, maxDuration 60).
- Client: `src/services/lifeEventsService.js`, `src/components/{DivorceTeaser,MarriageDivorceSection,SexOffenderSection,NeighborhoodSafetySection}.js`.
- Docs: `docs/marriage-divorce-data-research.md`, `docs/design/life-events-data-mapping.md`.

## Caching
Person-keyed cache bounds paid-provider cost (like `inmates` table): repeat name+state hits Neon not vendor. Verified 1953ms→349ms cache hit. Owner ACCEPTED divorce teaser pre-signup (normally paid providers are post-signup only) BECAUSE caching bounds cost.

## State (2026-07-11)
Deploy candidate **public.3e9be099.js** — full divorce angle (landing/SERP/SUP teasers + report/identity sections + neighborhood safety + caching). NOT yet uploaded to BC. Owner was mid-testing the teaser (v12 → Michael Johnson / Nevada → details step). Life-events endpoint LIVE on idlookup.me (Vercel).

Owner TODOs: enable Enformion Marriage (Pro plan) + confirm prod endpoint path; get IDI data-dictionary from BC; upload bundle to BC; verify Enformion billing model.
Dating vertical (angle #2) = BUILT (see section above). Deploy candidate carrying divorce + dating + address-map + report-crash-fix: `public.34ff7cea.js`.
