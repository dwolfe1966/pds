# Campaign specs — 3 acquisition angles (buildable layer)

**Date:** 2026-07-23 · Builds on `2026-07-23-three-new-marketing-angles.md` (strategy). This doc is the
**concrete, hand-to-a-media-buyer / hand-to-a-designer** layer: real ad copy, landing wireframes wired to
our existing components, and the conversion + tracking flow. Copy is draft — legal/compliance review before
spend (FCRA line on every landing; no fabricated data).

**What we already have to build on:** landing flows `/name/landing/v3…v13`, `SupTeaserA` (SUP teaser), the
person vCard, the BV-style loader (`OnboardingReveal` / v11), payment teasers (`WsfyPaymentTeaser`,
`IdentityPaymentTeaser`, life-events teasers), person-keyed signal cache, `$1→$49` billing, GTM/GA4
(`purchase` conversion live). Data: Enformion Divorce (live) + Marriage (pending), NSOPW sex-offender,
inmate DB, our WSFY engine, PersonSearch enrichment. **→ these are assembly jobs, not new builds.**

---

## B.1 — Marriage / Divorce

### Ad copy (draft)
**Meta / TikTok (interruption + story):**
1. *"He said he was divorced. The records said something else."* → "Check anyone's marriage & divorce history."
2. *"Before you blend two families — know the whole story."*
3. *"Is your partner's 'ex' actually an ex?"* → "Public marriage & divorce records, in seconds."
**Google Search (high-intent, exact-match):**
- `[name] marriage records`, `divorce records [state]`, `is [name] still married`, `marriage license lookup`
- Headline: "Marriage & Divorce Records — Search Any Name" · Desc: "See marriage dates, divorce filings & more. Private search — no one is notified."
**TikTok concept:** UGC "I ran his name and found a marriage he never mentioned" (record-reveal blur→unblur).

### Landing wireframe (`/name/landing/v12` divorce variant — already exists)
1. Hero: search box pre-primed ("Enter a name to see marriage & divorce records") + trust line.
2. Loader (`OnboardingReveal`): "Searching marriage & divorce databases…" (build anticipation, ~10s).
3. SRP → person picker (name/age/city).
4. **SUP teaser** (`SupTeaserA`): person vCard + **blurred** record counts — "Marriage records: 2 · Divorce records: 1 · Last filing: 20XX".
5. Value bullets (benefits): "Confirm their status · See prior marriages · Private & instant."
6. Email capture → `/payment` ($1 trial) → report reveals the marriage/divorce timeline.
7. Footer: FCRA disclaimer ("not for eligibility decisions").

### Flow + tracking
`ad → /name/landing/v12?shn=… → srp_view → sup_view (life-events teaser) → email_capture → /payment → purchase (GA4)`. Reuse person-keyed cache so the teased record set = the unlocked report.

---

## B.2 — Who's Looking For You (WSFY)

### Ad copy (draft) — ⚠ real reverse-search data only, never fabricated counts
**Meta / TikTok (curiosity — highest CTR):**
1. *"Someone's been looking you up. See who."*
2. *"Who searched your name this month?"* (phone-notification creative)
3. *"An old friend? An ex? A recruiter? Find out who's looking for you."*
**Google Search (lower volume, still buy):** `who searched for me online`, `who is looking me up`.
**TikTok concept:** screen-record of the WSFY reveal (blurred searcher list → "someone in [your state]").

### Landing wireframe (self-search — this is also the freemium-identity front door)
1. Hero: **"Enter your name to see who's been looking."** (self, not third-party).
2. Loader → **`WsfyPaymentTeaser`**: "N people searched for you · 1 from [your state] · 1 possible relative" — **masked names**.
3. Honest framing: names unmask only after you **claim + verify your own identity** (KBA) — we already gate this.
4. Email capture → payment / identity claim → verified reveal.
5. Cross-tie: this feeds the identity dashboard (exposure score, hide controls) → the north-star product.

### Flow + tracking
`ad → self-name landing → wsfy_teaser_view → email_capture → /payment?reason=wsfy → purchase → identity claim (KBA)`. **Retargeting hook:** anyone who ran any site search → "while you searched, N searched for you."

---

## B.3 — Check Your Date (pre-date safety) — recommended first pilot

### Ad copy (draft)
**Meta / TikTok (safety, women 25–45 primary):**
1. *"Before you meet him — meet his record."*
2. *"Swipe. Match. Verify."* → "Criminal records, sex-offender check, marriage status & real identity."
3. *"$1.3B was lost to romance scams last year. Don't be next."*
**Google Search (strong intent):** `[name] background check`, `is my online match real`, `romance scam check`, `catfish lookup`.
**TikTok concept:** dating-app UI → "run a safety check" → composite reveal (very shareable safety-tip format).

### Landing wireframe (safety-branded)
1. Hero: **"Meeting someone new? Know who you're really talking to."** search by name (+ optional phone/city).
2. Loader: "Running criminal, sex-offender, marriage & identity checks…" (composite anticipation).
3. **SUP composite teaser**: person vCard + blurred **"⚠ 1 criminal record · Sex-offender: [check] · Marital status: [flag] · Identity: [verified/unverified]"**.
4. Safety reassurance + **FCRA disclaimer** (personal safety only — NOT tenant/employment); NSOPW display-limit compliant.
5. Email → `/payment` ($1) → full safety report (best showcase of report breadth).
6. Content asset: "Date-Safety Checklist" (SEO + retargeting).

### Flow + tracking
`ad → date-safety landing → srp_view → sup_view (composite) → email_capture → /payment → purchase`. Bundles criminal + NSOPW + marriage + identity → also the strongest retention/upsell story.

---

## Shared build checklist
| Piece | Status |
|---|---|
| Landing flows / SUP teaser / loader / vCard | ✅ exist — clone + re-theme per angle |
| Life-events teaser (marriage/divorce) | ✅ built (`v12`) |
| WSFY teaser + KBA gate | ✅ built |
| Composite "date safety" teaser (criminal+NSOPW+marriage+identity in one) | 🟡 assemble from existing verticals |
| GA4 `purchase` + funnel events | ✅ live |
| Ad accounts / pixels (Meta, TikTok) | ❓ need to confirm (Google Ads is live) |

## The one input I still need from you (to finish the budget)
Monthly test budget + **current & target CAC** and **subscriber LTV**. With those I convert the placeholder
day-rates into real per-angle allocations and kill thresholds. Absent them, a sane starting test = **~$150–200/day
per angle, 3 hooks each, kill losers day 5–7, grade on trial→paid (not CTR)**.

## Suggested next step
Pick the pilot (my rec: **B.3 Check Your Date** — highest intent, best showcases the report) and I'll produce
the full launch package: final ad-set structure, 8 copy variants, the landing built from our components, the
tracking plan, and a day-by-day test schedule. Or say "all three" and I'll do the creative for each in parallel.
