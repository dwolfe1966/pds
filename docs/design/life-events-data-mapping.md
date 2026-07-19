# Life-events data → map it to members & profiles (design principle)

Owner principle (2026-07-19): **every public-record data source we add (incarceration, court, divorce, marriage,
sex-offender, …) must map back to existing members and profiles — never a standalone lookup.** The value compounds
only when a record attaches to an identity. This is the same north-star as the freemium identity community: the
more records we bind to identities, the richer each profile and the stronger the "manage your exposure" product.

## The 4 surfaces every life-event record maps to

1. **Searched profile / paid report** — the person a member looked up. Records render in the report's appropriate
   section (incarceration/court → "Criminal & Court Records" ✅ done; divorce/marriage → a "Marriage & Divorce"
   section; sex-offender → a safety flag + criminal area). **Match TIGHT** (name+state+age±1+gender) post-pay.

2. **The member's OWN identity / exposure** (`/my-identity`) — the member's own records = what's public about them.
   Feeds the **exposure score** + the suppress/protect product. (Incarceration already wired into the identity's
   "Court & Criminal" module ✅.) Divorce/marriage/sex-offender should land here the same way, matched on the
   member's mapped identity (name/state/age).

3. **Relationship-graph enrichment** (the high-value, under-used one) — marriage/divorce records expose a
   **spouse / ex-spouse name**. That's relationship intelligence: "married to X", "divorced from Y". It should
   enrich the profile's **relatives/associates** list AND `member_enrichment` relationships — and doubles as a
   **corroboration signal** (if a divorce record's ex-spouse matches a known relative, confidence → strong).

4. **`member_enrichment` / WSFY** — records enrich the member's stored profile (relationships, exposure items) and
   sharpen "who's searching for you" matching (a searcher's records/relationships help identify + tease them).

## Unified data model (mirror the `inmates` table)
Life-events records should live in a **person-keyed cache** (like `inmates` for incarceration) so a record fetched
once is reused across reports, the member's exposure view, and enrichment — not re-fetched per surface. Normalized
shape carries `recordType` ('incarcerated' | 'court' | 'divorce' | 'marriage' | 'sex-offender'), the subject's
name/age/gender/state, the event fields (dates, county, offenses, spouse), and a **match key** (name+state+age).

- **Free/scraped layers** (incarceration ✅, sex-offender NSOPW next) → first-party store, $0, safe on teasers.
- **Paid layers** (Enformion divorce $0.05, marriage $0.10) → fetched **post-signup only**, cached to the person so
  we don't pay twice; never on the high-volume prospect teaser.

## Concrete wiring pattern (what "map to members/profiles" means in code)
- **`/api/incarceration`** already merges providers by person → report + identity. Add a sibling **`/api/life-events`**
  (or extend it) that runs divorce/marriage/sex-offender for a person and returns the same normalized, `recordType`-
  tagged shape.
- **Report** (`SearchResultDetailPage`): fetch life-events for the report subject → merge into the report body
  (criminal area for court/sex-offender; a new marriage/divorce block; relatives list gets the spouse/ex-spouse).
- **Identity** (`/my-identity`): fetch life-events for the member's mapped identity → exposure module + score.
- **Relationships**: divorce/marriage `spouseName`/`exSpouseName` → append to the profile's relatives + `member_enrichment`.

## Matching rule (unchanged, applies to ALL record types)
- **Pre-pay teasers** (landing/SERP): LOOSE (name+state) — convert.
- **Post-pay (report + identity)**: TIGHT via `corroboratePerson` (age±1 + gender-when-known) + Strong/Possible label.

## Status
- Incarceration/court: fully mapped (report criminal area + identity module + tight match). ✅
- Divorce: provider built (`lib/lifeEvents.mjs`, entitled, $0.05). NOT yet mapped to report/identity/relationships. ← next
- Marriage: provider ready, self-gated on Enformion entitlement (`MARRIAGE_ENABLED`).
- Sex-offender: NSOPW adapter built (`lib/sexOffender.mjs`, browser-tier). **NOT a report record** (owner 2026-07-19):
  name-attributing a fuzzy ALIAS match to a searched person is the weak/risky use — pulled from the report. The right
  use is the **"other people" dimension** we haven't fleshed out: a **location-based "registered offenders near you"**
  safety feature on the MEMBER'S OWN profile (NSOPW supports zip + GPS coords — no attribution problem, real safety
  value), and/or confident attribution only via the relationship graph. Adapter/endpoint (opt-in `sexOffender`) kept ready.
