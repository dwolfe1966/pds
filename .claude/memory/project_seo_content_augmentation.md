---
name: project_seo_content_augmentation
description: SEO directory content-augmentation pipeline — ACS demographics + name-facts live; Wikidata next; news skipped
metadata: 
  node_type: memory
  type: project
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

Content-augmentation build for the state/city/name SEO directory (2026-07-10, HEAD ~6d662c5, deployed to idlookup.me via Vercel).

**Shipped (city + leaf pages now carry real, public-domain content):**
- `seo/data/city-acs.json` — Census ACS 5-year, **2,067 cities, 22 fields** (pop/age/income/home-value/rent/tenure/race/education/unemployment/commute). Built by `seo/scripts/fetch-acs.mjs` (1 call/state, matches slice cities by normalized name, 99.9%). Needs a **free Census API key** (owner's, env-only, NEVER committed — `.env`/inline only).
- `seo/data/name-facts.json` — surname race/ethnicity (2010 Census surname CSV) + first-name gender/peak-decade (SSA-derived hadley mirror; ssa.gov 403s datacenter IPs). Built by `seo/scripts/build-name-facts.mjs`. 192 firsts / 126 lasts, 100%.
- `seo/lib/facts.js` — loaders + prose generators (slug-hashed variation to avoid templated footprint). Wired into city landing (`[state]/[city]/page.js`) + leaf (`[state]/[city]/[name]/page.js`).

**Gate pivot:** city-grain `estInCity ∈ [2,750)` replaced the state ceiling (`seo/lib/directory.js`) → ~866k pages (90% at estInCity 2–9). Owner's number was 750; it barely bites (even John Smith/LA = 521) — the floor (2) drives scale.

**Build resilience fix:** `getSitemapUrls`/`getNameIndex` in `lib/data.js` now try/catch the Neon call → fall back to committed JSON. Root cause of the earlier build crash: `.env.local` sets `DATABASE_URL` → build hits prod Neon → this sandbox can't reach `*.neon.tech` (census/github work, Neon blocked) → 10s connect-timeout then JSON fallback. Vercel builds reach Neon fine.

**City-page modules now LIVE (all city-native, server-SVG/data, no runtime calls):** ACS at-a-glance + race bars + prose; **occupations** (C24010, 5 groups — sales/office is _027/_063 NOT _025/_061); Wikidata facts chips (founded/county/elevation/nickname); **population-trend SVG chart** (`lib/popchart.js`, Wikidata P1082+P585 anchored by ACS pop, 2011 cities); **locator map** (StateMap highlight); **notable people** (P19, `city-people.json`, 1872 cities — placed BELOW "Most common names" per owner, new-tab links); **historic places** (NPS NRHP, `city-historic.json`, Is_NHL='X'=landmark); **historic newspapers** (LoC Chronicling America bulk titles, `city-newspapers.json`, 599 cities, state-filtered); **nearby cities** (haversine). Fetchers: fetch-wikidata{,-people,-pophistory}.mjs, fetch-nps-historic.mjs, fetch-chronicling.mjs. **City news = decided AGAINST**; **FRED metro = skipped** for the city-native occupations module (owner chose (c)).

⚠️ Open concern: page is now content-rich but "Most common names" (the funnel/conversion content) sits mid-page below the demographic modules — consider a prominent search CTA higher up so conversion isn't buried.

**Principle:** facts are free, prose isn't — pull public-domain/CC0 facts, generate our own prose; never copy Wikipedia/proprietary text. Full landscape + exact codes/formats in `docs/research/seo-content-augmentation.md` (Parts A/B/C).

Related: [[project_seo_live_idlookup_me]] [[project_seo_layer1_built]] [[project_seo_concept_decisions]] [[reference_bc_extid_ephemeral]]
