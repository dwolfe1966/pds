# Homefacts traffic — landing pages & flows (public records / background check / sex offender)

**Date:** 2026-07-23 · Design draft (no code cut yet — react first). **Test:** capture ~70k visitors from
homefacts.com into our funnels (currently they hand off to Intelius / TruthFinder).

## What the traffic actually is (verified live in a real browser)
Two homefacts page types drive this:
1. **Offender-detail pages** (e.g. `/offender-detail/CA58934847/Robert-Orlando-Tapia.html`) — a *specific
   named person* (registered offender) with address, DOB, physical description, aliases. The money CTA is
   **"View {Name}'s Criminal Record."**
2. **Offender / arrest search** (`/offenders.html`) — "National Sex Offender Registry / **Local Background
   Checks** / Search by name or location." CTA **"Search Records" / "Pull up their arrest records now."**

**The edge — the outbound links carry structured params:**
```
/ads.html?firstName=Robert%20Orlando&lastName=Tapia&city=Victorville&state=California&type=OffenderD_Text
```
So captured traffic arrives with **name + city + state + a `type` source-label** pre-filled. That lets us
**pay off the exact promise** ("Robert Orlando Tapia, Victorville CA — records") instead of showing a cold
search box — the single biggest conversion lever (promise→payoff; see [[project_adunit_funnel_review]]).
Observed `type` values: `OffenderD_Text`, `offender-details1` (offender-detail criminal-record CTAs),
`Offender_D&af_id=31` (arrest-records CTA). Search page fields: `name / firstName / lastName / city /
srch_state / srch_address / fulladdress`.

---

## ⚠️ Gating items — surface BEFORE launch (not blockers to designing)

1. **Is homefacts a partner or are we buying/scraping the traffic?** If **partner**, they set the outbound
   URL + params for us (the contract above holds — great). If we're **buying/redirecting**, confirm we can
   preserve those params. This changes how reliable the pre-fill is. *(Owner to answer.)*
2. **Sex-offender compliance (legal sign-off before the SO angle goes live).** NSOPW and many state
   registries **restrict commercial use / soliciting money** off registry data. So the SO landing must **pay
   off with our LICENSED criminal/public-records source (Enformion/IDI), NOT by re-serving scraped registry
   data** — framing: *"you found them on a registry; here's their broader public & criminal record from our
   sources."* And never **assert** someone is a current registered offender without a fresh, sourced basis
   (homefacts' own disclaimer says its data may be stale). Intelius/TF run these funnels — doable *with* the
   right framing + disclaimers, not a stop sign, but it needs owner/legal OK.
3. **Payoff-data reality check (do before building the primed teaser).** Our thesis = "name+city+state → show
   *this person's* record." Two known failure modes: common names → IDI **TooManyMatches** (see
   [[project_backlog]] resilient-zero-result); **NSOPW is location-based, not person-keyed** (see
   [[project_life_events_vertical]]) so we may not confirm *this individual*. **Action:** run 2–3 real
   homefacts names through `getPersonSignals`/backend first. If resolution is flaky, the **location-framed
   fallback** ("records found in Victorville, CA — unlock to see") becomes the primary teaser, not an
   afterthought.

---

## Shared architecture (all 3 landings — only NEW work is per-intent teaser content)
Read query params (`firstName,lastName,city,state,name,zip,type`) on load, then branch:
- **Primed path** (name present) → skip search → **loader** (`OnboardingReveal`, "Pulling {name}'s records
  in {city}, {state}…") → **person teaser** (`SupTeaserA` + composite `getPersonSignals`, blurred) → email
  capture → **`/payment`** ($1 trial) → full report. *Fallback if the person doesn't resolve:* location-framed
  teaser + name confirm/disambiguation.
- **Cold path** (no name) → intent-matched **search box** → SRP → same teaser → paywall.
Everything but the teaser content already exists (landing flows, loader, `SupTeaserA`, `$1→$49` billing,
GA4 `purchase`).

---

## The 3 landings

### (a) Public Records  — `/records/public-records`
- **Promise:** "Search public records on anyone." Broadest intent (homefacts "more"/general links).
- **Teaser (licensed sources):** addresses & address history, phones, relatives/associates, court & civil
  records, business/asset hints, criminal summary — blurred.
- **Copy:** "Public records for {Name}" / primed: "We found public records for Robert Tapia in Victorville, CA."
- **Cold search:** name + state.

### (b) Background Check — `/records/background-check`
- **Promise:** pays off "Local Background Checks / Search Local Arrest Records / Pull up their arrest records."
- **Teaser (licensed):** **criminal & arrest records**, court records, a sex-offender *flag* (not the registry
  data itself), identity/photos, addresses — blurred, criminal emphasized.
- **Copy:** "Background check on {Name}" / "See arrests, criminal & court records."
- **Cold search:** name + state (matches homefacts by-name), or location.
- **Source fit:** offenders.html arrest CTA + `type=Offender_D`.

### (c) Sex Offender — `/records/offender-record`  (⚠ gated on item #2)
- **Promise:** pays off the offender-detail "View {Name}'s Criminal Record" — the highest-intent, person-
  specific moment. Visitor is a concerned resident/parent (safety).
- **Payoff (compliance-safe):** lead with our **licensed criminal & public record** on that person —
  *"You found {Name} on a registry. Here's their broader criminal & public record."* Plus "other records in
  {city}" and a safety framing. **Do NOT re-serve the scraped registry entry as the paid product**, and don't
  assert current-registered status without a fresh source.
- **Copy:** primed: "Robert Orlando Tapia — Victorville, CA. See the full criminal & public record." Cold:
  "Search criminal & offender records by name or location" (mirrors homefacts by-name / by-location).
- **Upsell path:** convert offender-lookup into a broader "check anyone near you / check someone you know"
  subscription (this ties to the **Check Your Date** safety angle — same report, same teaser components).

---

## Source → landing mapping (homefacts CTA → our funnel)
| Homefacts source (params/`type`) | → Our landing | Path |
|---|---|---|
| Offender-detail "View Criminal Record" (`OffenderD_Text`, `offender-details1`) — name+city+state | **(c) Sex Offender** | primed |
| Offender-detail "Pull up their arrest records" (`Offender_D`, `af_id=31`) | **(b) Background Check** | primed |
| offenders.html name/location search | **(b) Background Check** (SO data inside) | cold search |
| General homefacts "more"/records links | **(a) Public Records** | cold search |

---

## Compliance (bake into every landing)
- **FCRA** disclaimer on every page: not a consumer report; not for employment/tenant/credit/insurance.
  Framing stays personal-safety / curiosity / awareness.
- **Registry data:** payoff comes from licensed sources, not re-served NSOPW/registry scrapes (gating item #2).
- **Accuracy:** never assert registered-offender status without a fresh, sourced basis; mirror homefacts'
  "data may be stale" caution.
- **Private search** — the subject is not notified.

## Measurement plan (this is a 70k *test* — learning, not just signups)
- Map each homefacts `type`/`af_id` → our **shN + UTM** (e.g. `?shn=<homefacts-so>&utm_campaign=homefacts&utm_source=homefacts&utm_content=OffenderD_Text`).
  Preserve the source-label so we can grade **by placement**. (Attribution scheme per [[project_ads_conversion_2026_06_07]].)
- KPIs by placement: landing→SRP/teaser→email→**purchase** (GA4 live), **cost-per-trial**, **trial→paid %**.
- **Success metric (set up front):** trial→paid CAC ≤ target (needs LTV); interim guardrail blended CAC < ~$35.
- Segment: primed vs cold, and the 3 intents, so 70k tells us which homefacts placement + which intent converts.

## Validation before build
1. Owner answers gating #1 (partner vs buy) + #2 (SO legal OK).
2. Run 2–3 real homefacts names through `getPersonSignals` → confirm primed teaser resolves (else lead with
   location-framed fallback).
3. Confirm the param contract on a live homefacts→us handoff (name/city/state/type arrive intact).

## Build checklist (once validated — small, mostly assembly)
- New route(s) that read the params + branch primed/cold (clone an existing `/name/landing/vX`).
- 3 per-intent teaser variants of `SupTeaserA` (public / background / offender) off `getPersonSignals`.
- Location-framed fallback teaser.
- shN/UTM + GA4 wiring per placement.
