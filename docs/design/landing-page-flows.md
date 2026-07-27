# Landing Page Flows — Catalog

**Date:** 2026-07-27
**Purpose:** Reference map of every consumer landing/funnel entry point, what each variant's angle is, and how the flows work. Useful for choosing ad destinations, email CTAs, and A/B decisions.
**Source of truth:** `src/App.js` routes → `src/pages/sales/*` components (headlines/angles pulled from each component).

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

---

## Identity / self-check flows

| Route | Headline | Angle / notes |
|---|---|---|
| **`/see-who`** | See Who's Searching For You | **WSFY** (`WsfyLandingPage`) — identity-confirm wizard (name+city+age+email/phone) → self-match → KBA/DL verify → silent account → `/payment?reason=wsfy`. The convert engine that `/phone/exposure` + `/email/exposure` hand off to. |

---

## Quick decision guide (for ad/email destinations)

- **Highest-intent paid destination:** `/name/landing/v3` (incarceration) — where paid already goes.
- **Re-engaging the lead list (mostly signup + name-teaser):** send back into the **name funnel** (`/name/landing/v3`), or their abandoned report if a target is known.
- **Self-check / identity angle (net-new):** `/phone/exposure`, `/email/exposure` → `/see-who`.
- **Spam/safety angle:** `/phone/safe` (once Twilio line-safety is live).
- **Design tests:** v7–v10 (name) are look/IA explorations on the same proven flow.
