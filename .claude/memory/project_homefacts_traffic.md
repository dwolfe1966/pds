---
name: project_homefacts_traffic
description: homefacts.com partner traffic test (70k visitors) — 4 landing experiences for public-records/background-check/sex-offender intents
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
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

**Funnel break + fix (2026-08-13).** 500+ real HomeFacts visitors/day, but the funnel collapses AT THE CAPTCHA: the co-brand landing AUTO-FIRED the search on arrival (`autoPrime` → `runSearch()`) → dropped visitors into BC Turnstile with NO human gesture → only 12–29% passed (8/12: 531→153; 8/13: 145→17). Everything downstream is residue; ~0 conversions all-time, so NO homefacts billing tag exists (not an attribution bug — no charges happened). Root cause: Turnstile scores on human interaction; a programmatic on-load search has none. (Google People Search doesn't hit this — no name in URL → users type+click → Turnstile passes.) FIX (Move 1+2): `primeToConfirm:true` → land primed traffic on the pre-filled CONFIRM step (initialized at mount, no flash) with the SignalTeaser (value first) + a one-click "See <Name>'s report →" CTA; the click gives Turnstile its gesture. **On a SEPARATE preview route `/name/landing/homefacts-v2` (HOMEFACTS_V2_CFG, variant 'homefacts-v2') — NOT the live experience** (owner: too much traffic on the line; d6afea5). `/name/landing/homefacts` stays LIVE auto-fire. Review side-by-side (`?firstName=&lastName=&state=`), then flip the live cfg only after sign-off. VerticalIntentLanding primeToConfirm handling is gated on the cfg flag so live is untouched. Owner: pushing the CAPTCHA itself back is the deeper fix (later); also a REBILL/attribution check is needed before scaling (shn → BC sale/order + rebill config). Not yet deployed (owner deploys).

**Dedicated HomeFacts landing (2026-08-10, David Teng @ NIC integration):** `/name/landing/homefacts` = `HomeFactsLandingPage` → `VerticalIntentLanding cfg={HOMEFACTS_CFG}` (variant 'homefacts', flow/teaser 'publicRecords', autoPrime, safety+records copy). Link owner gives HomeFacts: `idlookup.ai/name/landing/homefacts?shn=<BC token>&firstName=<>&lastName=<>&state=<>` (owner gets real shn from BC; owner manages consumer builds/deploy). Params: VerticalIntentLanding now reads KEYS CASE-INSENSITIVELY (lc-map `qp()` helper) + aliases (fn/firstname/first, ln/lastname/last, mn/middlename/middle, state/st, city, age) — no casing assumptions. State: `normalizeState` assumes 2-letter, falls back to parsing full names ("California"→CA). **Co-branded SERP header:** `cfg.partnerBrand:'homefacts'` → VerticalIntentLanding persists sessionStorage `idlPartnerBrand` → SearchResultsPage header shows "{brand} × HomeFacts" + "In partnership with HomeFacts" (also falls back to `attribution.shnName/partner` matching /homefacts/i). NOT deployed (owner uploads bundle). The older `/records/*` funnels (homefacts-so/bg/pr) still exist for the 3-intent split; the dedicated route is the single branded experience David requested.

**shN per URL (owner req, 2026-07-23):** placeholder registry keys in campaignRegistry.js — `homefacts-so` / `homefacts-bg` / `homefacts-pr` (partner=Homefacts, channel=the intent, landing.route null). Verified: ?shn=homefacts-so → attribution.partner=Homefacts + GTM partnerName/partnerChannel. Swap for real BC shConIds when minted. FINAL URLs carry both `type` (fine placement) + `shn` (experience). Teaser fixes 2026-07-23: split mashed firstName, city→teaser subject, teaser renders on ERROR (loader carries subject on error), background/publicRecords lead with real record when found.
