# Marriage & Divorce data assets — research (angle #1)

Research 2026-07-19. Question: what data powers a marriage/divorce search angle, and can we source it?

## Headline: the data hook is SOLVED via Enformion (our existing account) — no county scraping needed
Unlike incarceration (50 state DOC sites → feasible to scrape), marriage/divorce records are **county-level**
(~3,000 clerks + state vital-records indexes, some divorce records **sealed**) — first-party scraping is much
harder. But **Enformion/Endato** (the account we already have — galaxy-ap creds) carries marriage + divorce as
**dedicated API products** (43B records, 6,000 sources). So we source it the same way as CriminalSearch.

## Live test results (2026-07-19, our account, devapi.endato.com)
- **Divorce Search — ENTITLED ✅ NOW.** `POST /DivorceSearch`, header `galaxy-search-type: Divorce`. Body:
  `{FirstName, LastName, City, State, SpouseFirstName, DivorceDate}`. Returns real records — Michael Johnson → 10,
  Garcia/TX → 10. Record fields: `spouseFirstName/MiddleName/LastName`, `spouseGender`, `divorceDate`, `county`,
  `state`, plus `poseidonId/tahoeId/ssn/spouseKey`.
- **Marriage Search — NOT entitled.** `POST /MarriageSearch` [`Marriage`] → 400 "Access Profile does not permit
  client to call Marriage Search." Exists; needs Enformion to enable it (SAME as CriminalSearch/v2 — one ask).
  Body: `{FirstName, LastName, City, State, MaidenName}` → `{spouseFirstName, spouseLastName, marriageDate, county, state}`.

## Caveats
- **Dev vs prod endpoint:** works on `devapi.endato.com`; `api.endato.com/DivorceSearch` → 404 (prod uses a
  different path/version). Confirm the prod endpoint + prod entitlement before going live.
- **PII/display:** the divorce record carries **SSN** and full spouse name — NEVER display full SSN; mask it. Show
  spouse name + divorce date + county/state (the compelling, safe-to-show fields).
- **Sealed records** won't appear (expected).

## What we already have on the marketing side
- **Divorce funnel is a LIVE campaign** — `campaignRegistry.js`: "Google Divorce Upper/Lower" → `/name/landing/v6`.
  But v6 has **no divorce-specific data teaser** (shows generic "Criminal Records" value chips). The data hook is
  the missing piece — wire Enformion Divorce Search + a divorce teaser (like the inmate `InmateBookingTeaser`).
- `NameSearchLandingV4Page` lists "Birth, marriage & family records"; VerticalIntentLanding has divorce=v12/death=v13.
- BC report (`reportExtract`) has **relationship** data (relativeList type/subType — may flag spouse/ex-spouse) but
  **no marriage/divorce records** (no dates/certificates).

## Strategic read — Enformion is the "life-events" engine for BOTH angles
Enformion gives us a unified life-events layer: **Criminal (v2, pending) + Divorce (live) + Marriage (pending)**.
- **Angle #1 (marriage/divorce):** Divorce live now → wire into the v6 funnel; Marriage one ask away.
- **Angle #2 (dating-verification):** "is your date married / divorced / has a record?" = the SAME layer
  (marriage + divorce + criminal) + a scrapeable **sex-offender registry** first-party moat.
So the Enformion enablement (Marriage + Criminal V2) + the already-live Divorce power both funnels.

## Enformion asks (bundle these)
1. Enable **Criminal Search V2** (already asked — for the inmate/dating safety layer).
2. Enable **Marriage Search** (new — for the marriage angle).
3. Confirm the **production** endpoint/base + entitlement (dev works; prod path differs).

## Recommended next steps
1. **Divorce (now):** add an Enformion `divorceSearch()` provider (mirror `incarceration.mjs`'s enformion pattern) +
   a divorce data teaser on v6 (spouse name + divorce date + county). This is buildable today with our entitlement.
2. **Marriage:** file the enablement ask; wire the same once enabled.
3. **First-party moat (later, optional):** state vital-records marriage/divorce INDEX scrape for the states that
   publish searchable online indexes — a freshness/cost moat like the DOC roster, but county fragmentation makes
   Enformion the pragmatic primary.
