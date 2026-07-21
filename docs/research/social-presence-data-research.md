# Social-Presence Data — Sources & Feasibility Research

_Research for IDLookup, 2026-07-21. Not legal advice — the legal section is research; privacy counsel should review before any scraping program or new data-broker activity._

## TL;DR — the one thing that reframes the whole vertical

**No platform or vendor lets you go from a name / email / phone → a specific person's social profiles as a clean lookup.** That discovery primitive does not exist — every official API is handle-only or your-own-account-only. So social presence is **not a lookup key; it's an enrichment layer.** You must resolve identity from your own data first (which we already do — IDI/BC + our inmate/SO/public-records graph), derive a candidate handle/email, then *attach* social.

That's actually good news for us: **we already have the hard part** (identity resolution). Social presence bolts on as another enrichment module alongside inmate/SO/life-events.

Three ways to get it, in order of cleanliness:
1. **Buy a matched-social API** — Spokeo (best), Pipl, TLO, Social Links. Sales-gated, but they've done the matching. **Enformion's API does NOT provide social** (it's a UI-only feature) — corrects a common assumption.
2. **Free OSS enumeration** (Sherlock/Maigret/Holehe) keyed off a handle/email *we already resolved* — cheap discovery leads, but must be corroborated before claiming "this is them."
3. **Direct platform scraping** — enrich-only, high-maintenance, and only worth it for a specific platform.

---

## Part 1 — The BUY path (vendors who sell matched social profiles)

### Realistically usable for consumer social (all sales-gated)
| Vendor | Social data returned | Match key | Real pricing signal | Fit |
|---|---|---|---|---|
| **Spokeo** (best fit) | FB, IG, TikTok, X, YouTube, LinkedIn, Reddit, dating apps — **platform + profile URL + photo**; 540M+ profiles | name+loc, email, phone, address, **username**, PersonID (6 API endpoints) | Sales-gated API; consumer ~$20/mo. No public API rate card | Richest named-platform social + a username match key + a real API |
| **Pipl** | Identity-cluster: social_profiles, usernames, user_ids across FB/LI/X/IG/GitHub/TikTok. No follower counts/bios | flexible: name+loc, email, phone, username | **~$0.10/query**, ~$500–1k/mo historical min; ~$3k–130k/yr contracts | Open-ended linkage; FCRA use **possible if approved in writing** |
| **TLO / TLOxp** (TransUnion) | Social Media Search over 145+ sources — links + photos | **email** (up to 5) | **~$1.00/social search** + subscription, sales-quoted | Credential-gated (GLBA/DPPA); email-keyed |
| **Social Links** | 30+ sources, social graph + posts/engagement + geotags (SOCMINT) | name, email, phone, username, image | **$0.11–0.50/call**, contact sales | Enterprise/investigations; deepest but heaviest |
| **Red Violet / idiCORE** | "social media detail" as linkage signal — **no named-platform+photo catalog** | full identity resolution | sales-gated enterprise | Thin social; ~same data class as our existing IDI/BC stack |

### Cheap + self-serve, but WRONG shape (do not use as report content)
PDL ($98/mo+), FullContact (now Ziff Davis), Hunter, Tomba, Apollo, RocketReach, Lusha. These are **B2B/professional** (LinkedIn/GitHub-skewed), need a **seed email**, and their **terms bar people-search / FCRA-adjacent use**. Fine as *internal* enrichment, never as displayed report content.

### Dead ends & landmines
- **Endato / EnformionGO API** — person/PII only, **no social endpoint**.
- **BeenVerified, Intelius/TruthFinder/Instant Checkmate (PeopleConnect)** — consumer walled gardens, **no API/feed to buy**.
- **Proxycurl** — the go-to LinkedIn API — **litigated into shutdown by LinkedIn, July 2025.** Any scrape-dependent LinkedIn feature inherits this existential risk.

---

## Part 2 — The per-platform reality (official API + scraping)

| Platform | Person-lookup API? | Scraping | Verdict |
|---|---|---|---|
| **X/Twitter** | Handle/ID only, no email/phone. Basic $200/mo → Pro $5k → Enterprise ~$42k/mo | Login-walled since 2023; needs headless+residential+accounts | Low yield, high cost |
| **Facebook** | Email/phone lookup **killed 2018**; own/managed accounts only | Logged-out public scraping **legally defensible** (Meta lost *v. Bright Data*); enrich-only | Enrich-only, no discovery |
| **Instagram** | Basic Display API **shut down Dec 2024**; Business Discovery = username-only, business accounts only | Tightening login wall; enrich-only | Weaker than FB |
| **LinkedIn** | **No name/phone API at all**; email "Handle Lookup" is partner-only + bars this use | Most hostile anti-bot; documented enforcement (hiQ $500k, Proxycurl killed) | **Avoid — hostile source** |
| **TruthSocial** | Mastodon API, handle-only; **auth-walled for non-prominent users since Aug 2025** | Bounded by the new auth wall | Effectively closed |
| **TikTok / Reddit** | No commercial people-lookup; pseudonymous by design | Aggressive anti-bot / paid tiers | Near-useless for people-search |

**Anti-bot economics if you do scrape:** Cloudflare/DataDome/HUMAN everywhere; residential proxies ~$1.50–4/GB + CAPTCHA solving — continuous opex, not a stable feed.

---

## Part 3 — The FREE / OSS path (discovery, not identification)

Cheap, no keys, answer one question: _does identifier X exist on platform Y?_ — a **lead, not an ID.**

- **Username enumeration:** Sherlock (400+ sites), **Maigret** (2500+, parses pages into dossiers, recursive), WhatsMyName (dataset), Blackbird (username+email).
- **Email/phone → social:** **Holehe** (email → 120+ sites via silent password-reset probing), Socialscan (email/username availability), Epieos/GHunt (email→Google account name/photo), PhoneInfoga.

**The identity-resolution gap (the hard problem):** "handle X exists" ≠ "person P owns it." Handles aren't unique; existence is *inferred* (false positives from soft-404s); enumeration-blocking causes false negatives; impersonators/squatters; chained/AI pivots compound error. Practitioner standard = **≥2 independent corroborating signals** before calling an attribution confirmed (shared email/phone, reverse-image photo continuity, linked personal sites, timeline continuity).

**Product takeaway:** great as a cheap **discovery/tease layer**; treating a raw hit as a confirmed identity risks **false attribution against a real, uninvolved person** — the exact accuracy failure behind the FCRA/misappropriation actions below.

---

## Part 4 — Legal risk profile (for a people-search / reseller business)

The battleground moved from CFAA ("how you got in") to **contract + use** ("what you agreed to / what you do with it"). The line is **logged-out vs. logged-in.**

- **Scraping public data is broadly defensible:** *hiQ v. LinkedIn* (CFAA doesn't bar public scraping) + *Meta v. Bright Data* (Jan 2024, Meta lost) + *X v. Bright Data* (May 2024, X lost, copyright preemption). **But** hiQ ultimately **lost on breach of contract** and paid **$500k** — because it **created fake accounts** and had agreed to LinkedIn's ToS. _District-level, fact-specific, appealable — not settled precedent._
- **The exposures that actually matter for us (mostly independent of scraping):**
  - **FCRA** — the people-search killer. If data is used/**marketed** for eligibility (employment/tenant/credit), you're a CRA. TruthFinder/Instant Checkmate paid **$5.8M** (2023); Spokeo **$800k** (2012) — **disclaimers don't save you.** _This already applies to us._
  - **Biometrics (BIPA) — existential IF we process faces.** Displaying a photo ≈ copyright caveat; **generating a faceprint** from it = Illinois BIPA, $1k–5k **per violation**, private right of action. Clearview: **$51.75M** settlement. → **Never build face matching.**
  - **Data-broker registration** — CA (Delete Act + DROP), TX, VT, OR; per-day penalties. CA narrows the "publicly available" exemption to **exclude mass-scraped data.** _Already applies to our people-search._
  - **FTC Section 5** — "unfair" collection/sale of **sensitive** data (precise location, health, orientation, minors). Avoid those categories.

**Mitigations that move the needle:** logged-out only; **never create accounts** (the hiQ trap); don't circumvent technical barriers (CFAA line); rate-limit + respect robots.txt; **no faceprints**; prefer factual fields over re-hosting photos; register as a data broker + honor opt-out/delete; genuinely stay out of FCRA marketing; contractual downstream limits on any resale.

---

## Part 5 — Recommendation for IDLookup

We already resolve identity and already operate as a people-search data broker, so the incremental legal delta of adding social **presence** is small — *as long as we don't add faceprints, don't market for screening, and honor our existing opt-out/registration duties.*

**Recommended shape — social presence as an enrichment MODULE (like inmate/SO/life-events), corroborated, displayed conservatively:**

1. **Fastest clean win — pilot a matched-social API.** Get a sales quote from **Spokeo (People Intelligence API)** and **Pipl** (get FCRA/permissible-use approval in writing). Key off a person we've already resolved → display *platform + profile URL + photo*. Sales-gated pricing is the only friction; the matching is done and the ToS risk sits with them.
2. **First-party lean — OSS enumeration as a discovery/signal layer.** Keyed off a handle/email **we already resolved** (from IDI/BC + our own data), run Maigret/Holehe-style checks to build a first-party "social footprint" signal. **Gate any "this is them" claim behind ≥2 corroborating signals** (shared email/phone match, photo continuity). Use it for a *tease* ("we found N possible social profiles — unlock to review") rather than asserting ownership. This fits our first-party moat strategy and the Signals-augmentation engine.
3. **Direct scraping — only opportunistically**, logged-out, one platform at a time, if a specific one proves high-yield. Not a foundation.
4. **Hard nos:** faceprints/face-match; LinkedIn scraping; logged-in/fake-account scraping; using B2B enrichment (PDL/FullContact/etc.) as displayed content; marketing any of it for employment/tenant/credit screening.

**Suggested next step:** if this vertical is a go, the cheapest way to *learn* is to (a) request Spokeo + Pipl quotes in parallel, and (b) prototype the OSS footprint signal against a handful of people we've already resolved, to measure real match/corroboration rates before committing to a paid feed.
