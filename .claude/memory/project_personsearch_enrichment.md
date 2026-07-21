---
name: project_personsearch_enrichment
description: "Enformion PersonSearch enrichment for WSFY affinities — built, corroboration+retention gated, one owner blocker"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Built 2026-07-17 while Enformion **Criminal Search V2** is Sales-gated (see [[project_inmate_data_layer]]).
Enformion **PersonSearch** IS enabled on the current AccessProfile today (no gate) and returns a full
person record: real relatives (w/ relationship), address/city history, aliases, age, opt-out flag.

**What shipped** (on main; Vercel SEO app not redeployed, consumer bundle public.389f19e3.js not on BC):
- `seo/lib/person-search.mjs` — `findPerson()` normalizes PersonSearch; `personToEnrichment()` maps a
  **corroborated** match into the `member_enrichment` shape (relatives=name strings, past_locations="City, ST").
- `seo/app/api/enrich-person` — app-key gated, **fill-only** (reads current row, fills only empty
  relatives/past_locations — never overwrites BC data, never re-burns quota; short-circuits already_enriched).
- Client `enrichViaPersonSearch()` (memberEnrichment.js) fired from `saveIdentityFormInfo` (card-capture),
  **once/member** (localStorage guard). Write path validated on a real row (rel preserved 2, past filled 8).
- Populating `member_enrichment.relatives` + `past_locations` lights up the WSFY affinities that are dark
  today (`verified_relative` / `shared_relative` / `past_local`) — see [[project_wsfy_self_build]].

**Three guards (advisor-hardened, don't remove):**
1. Compliance = internal-only: verified the ONLY readers of member_enrichment relatives/past_locations are
   `wsfy.mjs` (derived labels like "May be family") + member-enrichment GET (COUNTS only). No raw Enformion
   value reaches a consumer, so no display-rights gate for THIS use. (All other `relatives` displays read
   the BC report/teaser, separately licensed.)
2. Corroboration gate: `personToEnrichment` writes NOTHING unless age(±2) OR exact-city match
   (`matchConfidence:'high'`); common-name/name-only → `reason:'ambiguous'`, no write. Prevents a
   stranger's network poisoning the "May be family" signal. Tested live: John Smith name-only → refused.
3. Opt-out honored (never enrich from an opted-out record).

**Retention CONFIRMED by owner 2026-07-17** (storage permitted). Persist gated on `ENFORMION_ENRICH_PERSIST=1`
(set in local .env.local; **owner must set on Vercel SEO project** for prod).

**OWNER TODO to go live:** (1) set `ENFORMION_ENRICH_PERSIST=1` on Vercel; (2) upload consumer bundle
public.389f19e3.js to BC. ⚠️ **Free tier = 100 searches/mo — production volume needs a PAID Enformion plan**
(fill-only + once/member guard conserve, but real signups will exceed 100/mo). Flag before real traffic.

**Deferred:** one-time backfill is MOOT (only 1 corroboratable member row exists — demo corpus).
**KBA-from-PersonSearch deferred** — any KBA surfaces one real fact as an option = "display", so it needs
the same written permission as criminal (separate from retention).
