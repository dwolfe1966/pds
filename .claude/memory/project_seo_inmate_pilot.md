---
name: project_seo_inmate_pilot
description: "SEO inmate-vertical pilot — data volumes, facility-column is DIRTY, cornerstone guide shipped"
metadata: 
  node_type: memory
  type: project
  originSessionId: a30cdc08-f0c0-401c-a086-f4170eba2f74
---

Inmate-vertical SEO pilot (roadmap `docs/growth/roadmap-seo.md` WS3/WS4). Data lives in Neon (seo `.env.local` DATABASE_URL).

**Real data volume (verified 2026-08):** `inmates` table = **622k** rows (removed=FALSE) — NC dominates (450k), then IL 20k, TN 17k, PA 13k, CA 11k, TX 10k, NY 10k, KY 7.5k. `fl_inmates` = **670k** (Florida, separate). **480k have mugshots.** ~1.3M first-party records total — a real moat. Query helpers in `seo/lib/incarceration.mjs` (`rosterTopNamesByState`, `rosterByNameState`, `countiesByState`, `stateInmateCounts`) + `seo/lib/inmatesDb.mjs` (`queryInmates`).

**⚠️ Facility-roster pages are NOT viable as-is (checked, deferred):** `inmates.facility` is DIRTY — top NC "facilities" are placeholders (`UNKNOWN AT CONVERSION` 137k, `LOCATION UNKNOWN` 47k) then **county names** (`MECKLENBURG COUNTY`), and `fl_inmates.facility` = **city** (MIAMI, FT. LAUDERDALE). So naive facility pages = junk titles + duplicate the existing county/city taxonomy (the duplication the roadmap warns against). Would need data-cleaning (map to real jail names, drop placeholders) first.

**Already built (don't rebuild):** name-in-state inmate pages (`rosterByNameState`, linked from `/people/[state]` incarceration section, in sitemap) + county taxonomy. The clean SEO surface for the inmate moat = name/county pages (done) + authority content (the gap).

**Shipped — /guides authority cluster (5 guides + hub, IN the sitemap):** `/guides` hub + `/guides/how-to-find-an-inmate` (pillar, data-driven state list via stateInmateCounts) + `how-to-find-a-federal-inmate` + `county-jail-roster` + `find-inmate-by-name` + `are-mugshots-public`. All static 60d ISR, HowTo/FAQ/Article/Breadcrumb JSON-LD, FCRA footer, cross-linked + linked from `/people/[state]` incarceration section. Guide list = single source of truth `seo/lib/guides.mjs` (hub + sitemap both read it). Added to `app/sitemap-directory.xml/route.js` (GUIDES_LASTMOD 2026-08-26, priority 0.7) — verified 6 guide URLs in built sitemap (8,263 total). Commits 10c101a, dadac52, c3bd24d. SEO app auto-deploys to idlookup.me on push to main (Vercel). To extend: add a guide's page.js + an entry in lib/guides.mjs (appears in hub + sitemap automatically). See [[project_seo_recovery]], [[project_inmate_data_layer]].
