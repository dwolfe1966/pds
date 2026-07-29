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

**BUILT ✅ 2026-07-23 (bundle public.87c0dbf7.js, NOT deployed):** 3 config-driven routes on VerticalIntentLanding
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

**⚠️ STRATEGIC PARTNERSHIP (2026-07-29) — supersedes the "traffic test" framing below.** The 70k traffic-switch was DESIGNED + funnels BUILT but is **NOT deployed/live** — turning it on is part of the ask. Now pursuing a deeper deal with **Nations Info Corp (NIC)** — HomeFacts's owner since 2022 (bought from ATTOM/RealtyTrac), David = NIC founder + a major investor in PDS/IDLookup (⚠️ NIC does NOT own IDLookup — never imply it; pitch on strategic value + economics only). Deliverables: `docs/partnerships/homefacts-{strategy.md, deck-slides.md, cover-note.md}` + a published deck artifact. Thesis: HomeFacts is a **people-search engine in a real-estate costume** — #1 organic = sex-offender/person-name; it brokers that traffic to TruthFinder+Intelius (PeopleConnect, **non-exclusive** per owner) for a per-lead fee. We propose: run/**rebuild** its SEO (off the 2013 PHP-5.3 stack) + convert traffic to our OWNED funnel (full LTV vs affiliate sliver) + merge place×person data. Verified facts: **Moz DA 47**, ~2,100 referring domains, domain **est. 1996**, **~135K visits/mo declining** (SimilarWeb), 10.3M indexed pages. TruthFinder/Intelius are OUR competitors, **not NIC's — Zillow is** (real estate). Credibility anchor: David Wolfe built MyLife.com SEO → ~20M/mo Google + 4M Bing (2014–18). Rev-share kept flexible. Owner GST direction: facts straight → sell synergies/combined value → detailed plan → "we could basically rebuild homefacts."

**shN per URL (owner req, 2026-07-23):** placeholder registry keys in campaignRegistry.js — `homefacts-so` / `homefacts-bg` / `homefacts-pr` (partner=Homefacts, channel=the intent, landing.route null). Verified: ?shn=homefacts-so → attribution.partner=Homefacts + GTM partnerName/partnerChannel. Swap for real BC shConIds when minted. FINAL URLs carry both `type` (fine placement) + `shn` (experience). Teaser fixes 2026-07-23: split mashed firstName, city→teaser subject, teaser renders on ERROR (loader carries subject on error), background/publicRecords lead with real record when found.
