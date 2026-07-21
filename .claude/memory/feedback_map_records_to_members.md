---
name: feedback_map_records_to_members
description: "Every public-record data source must map back to members + profiles, never a standalone lookup"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Owner directive (2026-07-19): when building ANY public-record data source (incarceration, court, divorce,
marriage, sex-offender, …), **always map the returned data to existing members and profiles** — it must attach
to an identity, never be an isolated lookup. The value compounds only when a record binds to a person.

**Why:** it's the [[project_freemium_identity_community]] north star — more records mapped to identities = richer
profiles + a stronger "manage your exposure" product. Same reasoning as the incarceration moat.

**How to apply — the 4 surfaces every record maps to** (see `docs/design/life-events-data-mapping.md`):
1. **Searched report** — render in the report's right section (criminal area done; divorce/marriage → a section;
   sex-offender → safety flag). Tight post-pay match (name+state+age±1+gender).
2. **Member's OWN identity/exposure** (`/my-identity`) — their own records = exposure → score + suppress/protect
   (incarceration already wired via MyProfileModular's criminal module).
3. **Relationship graph** — marriage/divorce expose spouse/ex-spouse names → enrich relatives + member_enrichment,
   AND use as a corroboration signal (ex-spouse matches a known relative → confidence strong).
4. **member_enrichment / WSFY** — enrich the member's stored profile + sharpen who's-searching matching.

Person-keyed cache like the `inmates` table (fetch once, reuse across surfaces). Free/scraped layers ($0) safe on
teasers; paid layers (Enformion divorce $0.05 / marriage $0.10) fetched POST-signup only, cached to avoid double spend.
Providers built: [[project_incarceration_data_moat]] (incarceration/court), `seo/lib/lifeEvents.mjs` (divorce live,
marriage pending entitlement), NSOPW sex-offender in recon. See [[feedback_first_party_data_independence]].
