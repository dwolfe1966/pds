# Landing Page Flows — Catalog

**Date:** 2026-07-30
**Purpose:** Reference map of every consumer landing/funnel entry point, what each variant's angle is, and how the flows work. Useful for choosing ad destinations, email CTAs, and A/B decisions.
**Source of truth:** `src/App.js` routes → `src/pages/sales/*` components (headlines/angles pulled from each component). HomeFacts pages: `seo/app/homefacts/*` (idlookup.me).

---

## How a flow works (shared skeleton)

Almost every flow is: **Landing → Loader (fake-progress interstitial) → obfuscated Search Result (SRP) → [SUP upsell, name only] → Payment.**

- **Landing** — a wizard that collects the query. Name flows use a **4-step wizard** (Name → Location → Details → Confirm → Results); phone/email use a shorter **3-step**. Every landing calls `useLandingTrack(vertical, variant)` so GA4 gets per-variant funnel dims.
- **Loader** (`/{vertical}/loader`) — runs the search, shows a progress animation, stores results.
- **Search Result** (`/{vertical}/search-result`) — the obfuscated teaser (blurred owner/records); click → payment.
- **Payment** (`/payment`) — $1 trial → recurring. Email-on-payment capture for phone (`?capture=email`).
- **Exposure & WSFY flows** differ (self-check → identity funnel) — noted in their sections.

**Traffic routing today:**
- **All paid search → `/name/landing/v3`** (incarceration workhorse). See `funnelSplit.resolvePaidRoute`.
- **`/name/landing/v2`** is a split wrapper: **SEO/idlookup.me referral traffic → `v11`**, everyone else → the v2 page.
- **`v11`** (BeenVerified-style) now serves the organic/SEO split only (pulled from paid).

---

## Name flows (`/name/landing/*`) — the workhorse vertical

| Route | Headline | Angle / notes | Type |
|---|---|---|---|
| `/name/landing` | *(PQS-styled entry)* | Original enhanced-design entry point | Legacy entry |
| **`v2`** | **Find Anyone Fast** | General people-search. Wrapper splits SEO traffic → v11. | General / SEO |
| **`v3`** ⭐ | **Find Someone in Jail or Prison** | **Incarceration intent — the primary PAID landing.** Green, 2-col. | **Primary (paid)** |
| `v3a` | Find Someone in Jail or Prison | v3 incarceration redesign, **trust-blue**, single column | Design A/B of v3 |
| `v3b` | Find Someone in Jail or Prison | v3 incarceration redesign, **dark premium**, two-column split | Design A/B of v3 |
| `v4` | Find Lost Relatives & Family Members | Reconnection; warm amber, emotional | Intent/theme |
| `v5` | Research Classmates & Colleagues | Networking/reconnection; professional blue/slate | Intent/theme |
| `v6` | Know Before You Go — Background Check Anyone You're Dating | Dating safety; rose/neutral | Intent/theme |
| `v7` | Find Anyone. Know More. | **Design exploration** — Spokeo-style trust-blue + orange CTA, single search-bar hero, big-number proof band | Design |
| `v8` | The complete background report. | **Design exploration** — dark premium charcoal + amber, split layout w/ "what every report includes" panel | Design |
| `v9` | Search public records. | **Design exploration** — clean minimal white, one blue accent, trust-band-first IA | Design |
| `v10` | Stay safe. Stay connected. | **Design exploration** — warm cream + teal/coral, use-case quadrants (PeopleFinders-style) | Design |
| **`v11`** | **Who are you looking for?** | **BeenVerified-style multi-step flow** (`NameSearchBvFlowPage`). Organic/SEO split. | BV-mimic |
| `v12` | *(divorce copy)* | **Divorce / marriage-records intent** — v3 flow + chrome, divorce copy | Intent/theme |
| `v13` | *(death copy)* | **Death / obituary-records intent** — v3 flow + chrome, death copy | Intent/theme |
| `v14` | *(dating copy)* | **Dating verification** ("safe, real, single?") — v3 flow + DatingTeaser (marriage/divorce reveal; SO check is post-pay only) | Intent/theme |

**Reading it:** v2 = general/SEO · **v3 (+a/b) = incarceration, the paid workhorse** · v4/v5/v6/v12/v13/v14 = intent/theme skins on the same wizard · v7–v10 = pure design explorations (same flow, different look) · v11 = the BeenVerified-style alternate flow.

---

## People-Search challenger flows — isolated A/B experiments (2026-07-29)

Three **separate, flag-gated** challenger funnels — NOT in-place edits to the paid V3 flow (which stays the control). Each tests a distinct hypothesis; same search core, same price ($1 → $49.98). One `funnelVariant` slot set at the loader chokepoint drives the treatment. Attributed via `?shn=` so cost-per-trial + trial→paid are measurable per arm. Built end-to-end; live. See `.claude/memory/project_ps_challenger_flows.md`.

| Route | Name | Hypothesis | Treatment | `?shn=` |
|---|---|---|---|---|
| **`/people-search`** | **A · Honest** | Honesty → trust → conversion + retention | No fabricated matches, plain-language price disclosure at checkout, honest "no confirmed match" | `honest-ps` |
| **`/proof-check`** | **B · Proof-First** | Concrete evidence beats promises/fear | Reveals ONE real, checkable record in the clear before the paywall (first-party moat) | `proof-first` |
| **`/my-exposure`** | **C · Search-Yourself** | Self-exposure anxiety + ongoing job → retention | "See what strangers can find about you" → sells a standing monitoring service, not a one-time peek | `self-check` |

Aliases: `/name/landing/honest` (=A), `/name/landing/proof` (=B), `/name/landing/self` (=C). Status: built + build-clean + attributed; live to real traffic.

---

## Phone flows (`/phone/*`)

| Route | Headline | Angle / notes |
|---|---|---|
| `/phone/landing` | *(PQS-styled entry)* | Original phone entry |
| **`/phone/landing/v1`** ⭐ | Find Out Who Owns Any Number | **Reframed reverse-lookup → single-owner reveal** (P1; incarceration-moat teaser, masked owner) |
| `v2` | Who Owns This Number? | General reverse-phone |
| `v3` | Who Called Me? | Unknown/spam-caller intent |
| `v4` | Find a Lost Contact | Reconnection |
| `v5` | Is This a Legitimate Business? | Business verification |
| `v6` | Verify Before You Meet | Dating/meeting safety |
| **`/phone/safe`** | Is This Call Safe? | **P2** — free line-safety hook (Twilio line type · carrier · risk band) + gated owner |
| **`/phone/exposure`** | Is Your Phone Number Exposed? | **P3** — reverse *your own* number → exposure teaser → WSFY funnel (net-new angle) |

---

## Email flows (`/email/*`)

| Route | Headline | Angle / notes |
|---|---|---|
| `/email/landing` | *(PQS-styled entry)* | Original email entry |
| `v2` | Who Owns This Email? | General reverse-email |
| `v3` | Who Sent This Email? | Sender identification |
| `v4` | Reconnect with Someone You've Lost | Reconnection |
| `v5` | Verify a Business Contact | Business verification |
| `v6` | Verify Before You Trust | Safety/trust |
| **`/email/exposure`** | Is Your Email Exposed? | **E3** — HIBP breach self-check → identity/WSFY funnel (email sibling of P3) |

---

## Records-intent flows (`/records/*`) — Homefacts partner traffic

Auto-prime from URL params (person-primed) → loader → SERP; cold traffic (no params) → the 4-step wizard.

| Route | Angle / notes |
|---|---|
| `/records/sex-offender` | **(a) person-primed** — SO flag pre-pay (possible-match, framed to verify); corroborated record post-pay |
| `/records/background-check` | **(b) primed + (c) cold** — background-check hook; arrest/booking pre-pay, full criminal post-pay |
| `/records/public-records` | **(d) cold** — public-records hook + any pre-pay booking/marriage hits; full records post-pay |

### Homefacts / partner URL structure

Homefacts links go **directly** to `/records/*` — there is **no `/?shn=` boot redirect** (`landing.route` is null in the registry). Each link carries:

- **Person params (primed):** `fn` / `firstName`, `ln` / `lastName`, `mn` / `middleName`, `city`, `state`, and `type` (drives the teaser subject). Present → **auto-prime → loader → SERP**. Absent → the **cold 4-step wizard**.
- **Attribution:** `?shn=` with one token per experience so BC + GTM attribute each URL distinctly (`partner=Homefacts`, `channel=`the intent):
  - `homefacts-so` → `/records/sex-offender`
  - `homefacts-bg` → `/records/background-check`
  - `homefacts-pr` → `/records/public-records`
  - Optional `?shl=<shColId>` for finer placement within an intent. *(These are PLACEHOLDER shN tokens — swap for real BC-provisioned shConIds when minted.)*

**Example homefacts URLs:**
```text
# Sex-offender, person-primed (arrives from an offender-detail page)
https://www.idlookup.ai/records/sex-offender?shn=homefacts-so&fn=Robert&ln=Orlando&city=Miami&state=FL

# Background-check, person-primed
https://www.idlookup.ai/records/background-check?shn=homefacts-bg&fn=Jane&ln=Doe&city=Austin&state=TX

# Public-records, cold (no person params → wizard)
https://www.idlookup.ai/records/public-records?shn=homefacts-pr
```

---

## HomeFacts — neighborhood-data MVP (`idlookup.me/homefacts`)

A working replacement for HomeFacts.com built on the SEO engine (`seo/app/homefacts/*`, Next.js/Vercel/Neon). Search a **city, county, ZIP, or address** → a neighborhood "area profile." The place→person bridge: every page folds in popular names + incarceration records that link into people-search. Domain = `https://idlookup.me` (CTAs link to the `idlookup.ai` funnel). See `.claude/memory/project_homefacts_prototype.md`.

| Route | What it is |
|---|---|
| `/homefacts` | Landing + search (city / county / ZIP / address typeahead) |
| `/homefacts/{state}` | State hub — cities, counties, incarceration & popular names |
| `/homefacts/{state}/{city}` | **City area profile** — 9 modules + incarceration + names + location map + offender map |
| `/homefacts/{state}/county/{county}` | County profile — ACS + FEMA + incarceration + offender map |
| `/homefacts/zip/{zip}` | ZIP profile — real ZCTA Census + schools/crime/incarceration/names + maps |

**Modules (all live on real data):** demographics, property, schools (NCES), crime (FBI UCR/NIBRS), environmental hazards (EPA TRI), natural-disaster risk (FEMA NRI), neighborhood info (Wikidata/NPS/LoC), sex-offender registry (first-party) + incarceration records (first-party). Interactive OSM location map + Leaflet sex-offender pin map. Sitemap: `/sitemap-homefacts.xml`.

---

## Identity / self-check flows

| Route | Headline | Angle / notes |
|---|---|---|
| **`/see-who`** | See Who's Searching For You | **WSFY** (`WsfyLandingPage`) — identity-confirm wizard (name+city+age+email/phone) → self-match → KBA/DL verify → silent account → `/payment?reason=wsfy`. The convert engine that `/phone/exposure` + `/email/exposure` hand off to. |

---

## Example URLs (copy-paste)

Base domain = `https://www.idlookup.ai`. Name landings accept optional prefill (`fn`/`firstName`, `ln`/`lastName`, `city`, `state`). Paid Google traffic actually enters at `/?shn=<24-hex shConId>` and boot-redirects to the campaign's landing (v3) — the direct URLs below also work for testing.

```text
# ── Paid entry (redirects to the campaign landing, today v3) ──
https://www.idlookup.ai/?shn=1a2b3c4d5e6f7a8b9c0d1e2f

# ── Name ──
https://www.idlookup.ai/name/landing
https://www.idlookup.ai/name/landing/v2
https://www.idlookup.ai/name/landing/v3?fn=John&ln=Smith&state=TX      # ⭐ paid workhorse (incarceration)
https://www.idlookup.ai/name/landing/v3a
https://www.idlookup.ai/name/landing/v3b
https://www.idlookup.ai/name/landing/v4                                 # lost relatives
https://www.idlookup.ai/name/landing/v5                                 # classmates/colleagues
https://www.idlookup.ai/name/landing/v6                                 # date safely
https://www.idlookup.ai/name/landing/v7                                 # design: Spokeo-blue
https://www.idlookup.ai/name/landing/v8                                 # design: dark premium
https://www.idlookup.ai/name/landing/v9                                 # design: minimal white
https://www.idlookup.ai/name/landing/v10                                # design: warm safety
https://www.idlookup.ai/name/landing/v11                                # BeenVerified-style flow
https://www.idlookup.ai/name/landing/v12                                # divorce/marriage intent
https://www.idlookup.ai/name/landing/v13                                # death/obituary intent
https://www.idlookup.ai/name/landing/v14                                # dating verification

# ── Phone ──
https://www.idlookup.ai/phone/landing
https://www.idlookup.ai/phone/landing/v1                                # ⭐ single-owner reveal (P1)
https://www.idlookup.ai/phone/landing/v2                                # who owns this number
https://www.idlookup.ai/phone/landing/v3                                # who called me
https://www.idlookup.ai/phone/landing/v4                                # find a lost contact
https://www.idlookup.ai/phone/landing/v5                                # legitimate business?
https://www.idlookup.ai/phone/landing/v6                                # verify before you meet
https://www.idlookup.ai/phone/safe                                      # P2 — is this call safe (Twilio)
https://www.idlookup.ai/phone/exposure                                  # P3 — reverse your own number

# ── Email ──
https://www.idlookup.ai/email/landing
https://www.idlookup.ai/email/landing/v2                                # who owns this email
https://www.idlookup.ai/email/landing/v3                                # who sent this email
https://www.idlookup.ai/email/landing/v4                                # reconnect
https://www.idlookup.ai/email/landing/v5                                # verify a business contact
https://www.idlookup.ai/email/landing/v6                                # verify before you trust
https://www.idlookup.ai/email/exposure                                  # E3 — is your email exposed (HIBP)

# ── Records (Homefacts) — see the structure above ──
https://www.idlookup.ai/records/sex-offender?shn=homefacts-so&fn=Robert&ln=Orlando&city=Miami&state=FL
https://www.idlookup.ai/records/background-check?shn=homefacts-bg&fn=Jane&ln=Doe&city=Austin&state=TX
https://www.idlookup.ai/records/public-records?shn=homefacts-pr

# ── People-Search challengers (A/B experiments) ──
https://www.idlookup.ai/people-search                                   # A · Honest        (?shn=honest-ps)
https://www.idlookup.ai/proof-check                                     # B · Proof-First   (?shn=proof-first)
https://www.idlookup.ai/my-exposure                                     # C · Search-Yourself (?shn=self-check)

# ── Identity / self-check ──
https://www.idlookup.ai/see-who                                         # WSFY convert engine
https://www.idlookup.ai/see-who?email=jane@example.com                  # prefilled from E3
https://www.idlookup.ai/see-who?phone=3105551234                        # prefilled from P3

# ── HomeFacts (idlookup.me — neighborhood MVP) ──
https://idlookup.me/homefacts                                           # landing + search
https://idlookup.me/homefacts/tx                                        # state hub
https://idlookup.me/homefacts/tx/austin                                 # city profile (9 modules + maps)
https://idlookup.me/homefacts/fl/miami                                  # city w/ offender pin map
https://idlookup.me/homefacts/fl/county/broward                         # county (incarceration + offender map)
https://idlookup.me/homefacts/zip/78701                                 # ZIP profile (real ZCTA data)
```

---

## Quick decision guide (for ad/email destinations)

- **Highest-intent paid destination:** `/name/landing/v3` (incarceration) — where paid already goes.
- **Re-engaging the lead list (mostly signup + name-teaser):** send back into the **name funnel** (`/name/landing/v3`), or their abandoned report if a target is known.
- **Self-check / identity angle (net-new):** `/phone/exposure`, `/email/exposure` → `/see-who`.
- **Spam/safety angle:** `/phone/safe` (once Twilio line-safety is live).
- **Design tests:** v7–v10 (name) are look/IA explorations on the same proven flow.
