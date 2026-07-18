# Person Enrichment via Enformion PersonSearch (WSFY affinities)

_2026-07-17. Built while Enformion **Criminal Search V2** is Sales-gated. Uses the **PersonSearch**
product, which IS enabled on the current AccessProfile today — no criminal/Sales gate._

## What it does
`findPerson()` (`seo/lib/person-search.mjs`) queries Enformion PersonSearch and returns a normalized,
enrichment-ready record: real **relatives** (with relationship), **address/city history**, aliases, age,
opt-out flag. `personToEnrichment()` maps a **corroborated** match into the `member_enrichment` shape
(relatives as name strings, `past_locations` as "City, ST"). `POST /api/enrich-person` wraps it.

This lights up the WSFY affinities that are dark today because `member_enrichment.relatives` /
`past_locations` are sparse: **`verified_relative` / `shared_relative` ("Shares a relative with you")**
and **`past_local` ("Once lived in your area")** — the high-intrigue teasers WSFY monetizes.

## Compliance posture (the load-bearing part)
1. **Internal use only.** WSFY emits **derived labels** ("May be family"), never the raw relatives/cities.
   Verified: the only readers of `member_enrichment.relatives`/`past_locations` are `wsfy.mjs` (derived
   tags) and `/api/member-enrichment` GET (returns **counts** only → "N relatives on record"). No raw
   Enformion value reaches a consumer. (Every other `relatives` display in the app reads the **BC**
   report/teaser, which is separately licensed.)
2. **Corroboration-gated writes.** `personToEnrichment()` writes **nothing** unless the chosen record is
   corroborated by **age (±2) or an exact city match** (`matchConfidence: 'high'`). A common name with no
   age/city → `reason: 'ambiguous'`, no write. This stops a stranger's network poisoning a member's signal.
3. **Opt-out honored.** An opted-out PersonSearch record is never used.
4. **⚠️ RETENTION GATE — the one open blocker.** This endpoint *persists* third-party data into our DB (a
   derivative store). Enformion's dev/free tier may restrict results to **query-time use only** (no
   caching/retention), independent of display rights. **`/api/enrich-person` is DRY-RUN by default** and
   only writes when **`ENFORMION_ENRICH_PERSIST=1`**. Do **not** set that (and do not run a backfill) until
   Enformion confirms data retention is permitted under the agreement. If it isn't, the fallback is
   compute-at-query-time (fetch PersonSearch live in the WSFY build, compute tags in memory, persist
   nothing) — a latency/cost hit, but no retention exposure.

## Activation — retention CONFIRMED by owner 2026-07-17 (storage permitted)
```
# already set for PersonSearch: ENFORMION_AP_NAME / ENFORMION_AP_PASSWORD (env-only, per profile)
ENFORMION_ENRICH_PERSIST = 1     # SET THIS on the Vercel SEO project to turn persistence on in prod
```
Set locally in `seo/.env.local`; **owner must set it on the Vercel SEO project** for production.

Client wiring is live: `saveIdentityFormInfo` (checkout card-capture — the members with no self-report)
fires `enrichViaPersonSearch()` → `POST /api/enrich-person`, **once per member** (localStorage-guarded;
free tier is 100 searches/mo). Server is **fill-only**: it reads the current row and only fills the
relatives/past_locations dimension that's empty — never overwrites BC-sourced data, never re-burns quota.

## Status
- ✅ `findPerson` + `personToEnrichment` (corroboration gate) — built, tested live (corroborated match =
  50 relatives / 8 past cities; name-only "John Smith" → refused).
- ✅ `POST /api/enrich-person` — fill-only, retention-gated persist. Write path validated on a real row
  (relatives preserved at 2, past_locations filled to 8, source=enformion_personsearch).
- ✅ Client wiring — `enrichViaPersonSearch` fired from card-capture, guarded to once/member.
- ⏭️ Owner TODO: set `ENFORMION_ENRICH_PERSIST=1` on Vercel + upload the consumer bundle. Free-tier quota
  (100/mo) means **production volume needs a paid Enformion plan** — flag before real traffic.
- ⏸️ KBA-from-PersonSearch still deferred — any KBA surfaces one real fact as an option (= "display"), so
  it needs the same written permission as criminal. Backfill is moot (only 1 corroboratable member exists).
