---
name: project_seo_individual_profiles
description: SEO individual Others-Profile leaf pages + the data-sourcing model (bulk IDI is OUT; Census skeleton + BC teaser fill + ISR governor)
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Individual person-profile pages now sub under the name-in-city leaf, and we settled **how
they get populated**. Shipped 2026-07-15/16 (commit `7b8ef77` on main, NOT yet on Vercel).

## Architecture (what shipped)
- **`person_profiles` re-keyed per-INDIVIDUAL**: `first+last | STATE | norm(city) | ageToken`
  (age disambiguates same-name people in a city; middle-name variants dedupe into one). Added
  `city_norm` col + `idx_pp_city`; TRUNCATEd on re-key. In `seo/lib/search-activity-db.mjs`:
  `upsertPersonProfiles` (deduped batch upsert), `getCapturedPeople({firstNorm,lastNorm,state,cityNorm})`,
  `getCapturedPerson(profileId)`. `ageToken(age)` in `seo/lib/ids.js` (digits/dash or 'x') — MUST
  match the upsert's ageTok.
- **`/people/[state]/[city]/[name]`** (Census stats landing) now lists the real captured individuals
  ("N profiles for {name} in {city}"), each linking to its profile.
- **`/people/[state]/[city]/[name]/[id]`** (id = ageToken) = the individual leaf: server-rendered
  teased profile. Free facts render (location history, relatives from teaser JSON); paid modules
  (phones/emails/addresses/court/property/financial) are LOCKED with 🔒 and **NO real data in the
  HTML** (revenue safety — nothing to scrape); unlock CTA → idlookup.ai funnel w/ UTM. Full JSON-LD
  (breadcrumb + Person) + FCRA footer, all in initial HTML. `revalidate` 60d.
- Verified: capture→dedupe→list→resolve-by-ageToken on Neon + `next build` (route builds as dynamic ƒ)
  + local screenshots at localhost:3100 (James Smith LA seed, since deleted).

## The two data problems (the key discussion — bulk IDI is OUT)
Owner: "Bulk IDI ask will be hard." So we do NOT gate on it. Two separate problems:
1. **Landing pages (name-in-city) = solved, free.** Pure U.S. Census (name-freq × city pop + ACS +
   name facts). Millions of name×city pages at $0. This is the SEO *skeleton/surface area*.
2. **Individual profiles = need a real person.** Three fills, in feasibility order:
   - **(a) Organic capture — LIVE, free.** Consumer searches already POST teaser → `person_profiles`
     (rides the search-activity ingest, server-side, no client change). Every searched person becomes
     a profile. Grows with traffic; limit = only *searched* people.
   - **(b) Lazy server-side teaser pull — THE SCALE PATH, no bulk feed.** Census taxonomy says which
     names live in which cities → on crawl, the SEO app calls **BC teaser search server-to-server**
     (Vercel→BC) for that name+city → caches individuals into `person_profiles` → they become profile
     pages. ISR 60d = one BC call per name×city per 60d, only for pages we expose. **Census = map,
     BC teaser = fill, sitemap = cost governor.** Only dependency = BC teaser callable server-side
     (SMALL ask, not a data license; prod captcha already off per [[project_bc_removed_prod_captcha]]).
   - **(c) Bulk IDI — hard, parked.** Would seed whole population at once; biggest ask.
- **Index-building ties to (b):** only sitemap a name×city page if willing to populate it → crawl =
  populate. Paginated sitemap (50k/file) from the Census taxonomy is the throttle on BOTH indexing
  and BC call volume. Start narrow (top names × top cities), widen as it proves out.
- **Decision:** ship (a) [done] + build (b). Do NOT wait on bulk IDI.

## Update 2026-07-16
- **Geo pipeline bug FIXED** (`0bd3d7c`): captured teasers have NO top-level city/state — geo is a
  location HISTORY in `locations`/`location` ("CITY, ST"). `upsertPersonProfiles` was reading
  r.city/r.state (always empty) → every captured person stored NULL geo → name-in-city listing
  (filters state+city) could never match. Added `primaryCityState()` (canonical = most-recent =
  locations[0]); backfilled the 31-row corpus. All 31 now have geo.
- **BC ask registered = `SEO-TEASER`** (drafted, NOT sent; doc BC_CONSUMER_FEATURE_ASKS.md). KEY
  finding: the blocker is **Cloudflare Turnstile at the front door**, NOT password captcha (which is
  off) — a headless server fetch 412s at Turnstile (evidence: sweep-profiles.mjs must run HEADED=1).
  So the ask = "let our SEO backend through the bot gate" (API key/bearer, since Vercel has no stable
  egress IP for allowlisting). CAVEAT flagged: IDI's standard T&C may prohibit automated ingestion
  (separate clause from public-display) — verify the bespoke grant covers server-side ingestion
  BEFORE scaling lazy-pull. See [[project_seo_idi_display_license]].
- **Owner decision: profile spread = "canonical page, listed on every city."** ONE profile page per
  person (at canonical/current city), but LISTED on every city hub in their location history (each
  hub links to the single canonical profile). No duplicate profile pages. Requires storing the full
  location history queryably → started `loc_tokens text[]` (GIN-indexed) on person_profiles + a
  `primaryCityState` sibling to build all tokens. **loc_tokens WORK IS INCOMPLETE** (column+index
  added to Neon; upsert not yet writing tokens; getCapturedPeople not yet filtering by
  `loc_tokens @> [city|state]`; name-page link not yet using canonical path). Resume here if
  continuing lazy-pull.

## NEXT (start here) — but note SEO indexing took priority (see [[project_seo_indexing_incident]])
1. Wire the **"crawl = populate" lazy-pull** — BLOCKED on `SEO-TEASER` (BC must open the Turnstile
   gate) AND on confirming IDI ingestion rights. Don't build until both clear.
2. Finish the **loc_tokens** work above (canonical-page-listed-on-every-city).
3. Profiles into the sitemap: **DEFERRED** — after the 7/13 indexing incident we retreated to a
   ~1000-URL conservative sitemap. Do NOT add profile URLs until they carry real content AND the
   domain is being crawled again.
4. Thin-content gate (don't generate near-empty profiles).

Relates to [[project_seo_live_idlookup_me]], [[project_seo_content_augmentation]],
[[project_modular_profile]] (the consumer report/profile design this teases toward),
[[reference_bc_extid_ephemeral]].
