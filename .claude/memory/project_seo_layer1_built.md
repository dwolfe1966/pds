---
name: project_seo_layer1_built
description: "SEO Layer 1 (name + location skeleton) is BUILT — pipelines, data, and sizing in seo/"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

**SEO Layer 1 (the URL universe) is built 2026-07-05** — the name + location
skeleton from free public-domain Census data. See [[project_seo_concept_decisions]]
and [[project_seo_idi_display_license]] (data layer = BC/IDI, display-licensed).

**Pipelines (zero npm deps; static www2.census.gov files — the api.census.gov data
API 302-redirects headless):**
- `seo/scripts/build-name-skeleton.mjs` — Census 2010 surnames CSV (162,253 last) ×
  Census 2020 first-names XLSX (53,615 first; parsed from raw XML, no xlsx lib).
- `seo/scripts/build-location-skeleton.mjs` — Census 2023 Gazetteer places joined to
  SUB-EST 2024 population by GEOID.

**Committed data (`seo/data/`):** first-names.json, last-names.json, places.json
(32,329 places), and the *-stats.json sizing files. Raw downloads (`seo/.cache/`)
and the big `name-pairs.ndjson` queue are gitignored (regenerate via the scripts).

**Universe sizing (the "how big" answer):**
- ~27.15M viable name-hub pages (name pairs with ≥1 expected real person).
- ~214M addressable individual profile pages (~US adult pop — sanity check).
- 32,329 location hubs (333 ≥100k pop, 10,219 ≥1k) for decision #6 first-class geo hubs.
- estPeople = firstCount×lastCount/POP (independence prior = search-demand rank);
  top pairs sane (Michael Smith ~32k, John Smith ~29k).
- Name×location hub count (/name/state/city) is DERIVED from BC/IDI at mint time
  (where a name's people actually live), NOT pre-computed from Census.

**NEXT (not yet done):** (1) BC name+location probe — does adding a city beat
`TooManyMatches`? closes the enumeration question. (2) Vercel prep for the `seo/`
Next app. (3) BC ASK 0 = live data to replace fixtures. (4) wire the skeleton into
the app (`getPerson` seam + hub routes + sitemaps). Hosting decision = Vercel.
