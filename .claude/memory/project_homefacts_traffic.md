---
name: project_homefacts_traffic
description: homefacts.com partner traffic test (70k visitors) — 4 landing experiences for public-records/background-check/sex-offender intents
metadata:
  type: project
---

**Test (owner 2026-07-23):** capture ~70k visitors from **homefacts.com** (a PARTNER — confirmed) into our
funnels, instead of their current Intelius/TruthFinder handoff. Design doc: `docs/marketing/2026-07-23-homefacts-traffic-funnels.md`.

**The edge (verified live via Playwright):** homefacts outbound CTAs carry structured params —
`/ads.html?firstName=Robert%20Orlando&lastName=Tapia&city=Victorville&state=California&type=OffenderD_Text`.
As a partner they set these for us, so captured traffic arrives **name+city+state pre-filled** → pay off the
exact promise (primed path), not a cold search. `type` values (`OffenderD_Text`, `offender-details1`,
`Offender_D`/`af_id=31`) = per-placement attribution keys → map to shN+UTM, grade cost-per-trial & trial→paid
BY placement.

**BUILT ✅ 2026-07-23 (bundle public.5041b554.js, NOT deployed):** 3 config-driven routes on VerticalIntentLanding
— /records/sex-offender, /records/background-check, /records/public-records — each AUTO-PRIMES when firstName+lastName
arrive (else cold-search). Teaser engine: FLOW_PRIORITY + SignalTeaser capability-hook flows (background/sexOffender/
publicRecords) + intent-aware copy. **SO FLAG pre-pay** (owner decision): "⚠ Possible offender record for {name} —
unlock to verify" (amber, framed to verify NOT assert); corroborated criminal/SO records stay POST-PAY from licensed
source. Captures homefacts `type` (partner_landing/primed_search events). Verified live. Pre-launch: deploy, partner
URL/type map, getPersonSignals reality check, FCRA-at-payment confirm, state full-name→abbr.

**Original 4 experiences:** (a) Sex-Offender person-primed, (b) Background-Check person-primed,
(c) Background-Check cold-search, (d) Public-Records cold-search. Each = existing landing infra
(OnboardingReveal loader + SupTeaserA + $1→$49 billing); ONLY new work = 3 intent-specific teaser variants
(off `getPersonSignals`) + primed/cold branch + param read + location-framed fallback.

**Gates RESOLVED:** partner ✅, sex-offender compliance sign-off ✅ (still pay off from LICENSED source
Enformion/IDI, NOT re-served registry scrapes; no asserting current-registered status without fresh basis;
keep FCRA + registry disclaimers). Payoff-data reality check understood → location-framed fallback is
first-class (common names → IDI TooManyMatches; NSOPW is location-keyed not person-keyed).

Ties to [[project_life_events_vertical]] (NSOPW/criminal), [[project_signals_augmentation]] (getPersonSignals),
[[project_adunit_funnel_review]] (promise→payoff), Check-Your-Date pilot (same safety report/teaser).
