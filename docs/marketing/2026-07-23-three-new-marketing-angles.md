# Three new marketing angles — working brief

**Date:** 2026-07-23 · **Status:** first draft to react to · **Owner:** dwolfe

Three acquisition angles, each a distinct promise → payoff → paywall funnel built on data we already
have or are standing up. **Key insight: these are mostly ASSEMBLY of existing capabilities into three
branded funnels — not net-new data builds.** We already have Enformion (Divorce live, Marriage pending,
PersonSearch), NSOPW sex-offender data, the self-built Who's-Searching-For-You engine, identity
mapping + KBA gate, person-keyed signal cache, flow-aware teasers, the $1→$49 billing, and GTM/GA4
conversion tracking. So the build cost is low and the leverage is high.

## At-a-glance

| | B.1 Marriage / Divorce | B.2 Who's Looking For You | B.3 Check Your Date |
|---|---|---|---|
| **Core job** | "Is he/she really single/divorced?" | "Who's searching for ME?" (curiosity + safety) | "Who am I really about to meet?" (safety) |
| **Emotional driver** | Trust / suspicion | Vanity / curiosity | Fear / self-protection |
| **Data used** | Enformion divorce+marriage | Our WSFY reverse-match engine | Criminal + NSOPW + marriage + identity (composite) |
| **Intent** | Medium-high | Low-medium (curiosity) | **High** |
| **Expected CTR** | Medium | **Highest** (curiosity hook) | Medium-high |
| **Expected CAC** | Medium | Low (cheap clicks) — watch trial→paid | Higher, but best LTV (safety = pays) |
| **Best channels** | Google Search + Meta | Meta + TikTok | Meta + Google Search + TikTok |
| **Pilot priority** | 2nd | 3rd (cheapest test / north-star wedge) | **1st (highest intent, showcases report breadth)** |

---

## B.1 — Marriage / Divorce

### Value propositions
- **"Know before you commit."** Confirm anyone's marriage & divorce history in seconds.
- **"Is your partner really single?"** — verification, not gotcha.
- Secondary: genealogy/family-history record lookup (cheap, broad, retargetable).

### Audiences
- Women 30–55 dating post-divorce (highest-suspicion segment) — "verify your match."
- New relationships (6mo–2yr), the commitment/"is this real" stage.
- Recently engaged / considering re-marriage (due diligence on a new partner or an ex's status).
- Genealogy hobbyists (low intent, cheap CPMs, good for retargeting pools).
- Geo skew toward higher-divorce-rate states.

### Ads
- **Story hooks (Meta/TikTok UGC):** *"He said he was divorced. The records said otherwise."* · *"Before you say 'I do' again — check the records."*
- **Search intent (Google):** `marriage records [state]`, `divorce records lookup`, `is [name] divorced`, `[name] marriage records` — high-intent, buy these.
- **Creative:** record-reveal mockup (blurred → unblur), UGC testimonial, relationship-timeline graphic.
- **Channels:** Google Search (high-intent record queries), Meta (interest + lookalike), TikTok (story UGC), YouTube pre-roll for the story hook.

### Budget (framework — needs your real numbers)
- 30-day test, placeholder **$150/day**: Meta $80 / Google Search $50 / TikTok $20.
- 3 ad sets per channel (one per sub-angle hook); kill losers day 5–7.
- Success gate = CAC ≤ target (need LTV/churn to set it; on $1→$49 the first-cycle-profitable ceiling is roughly CAC < $30–40).

### Landing experience
- Name search → SRP → SUP teaser: **"Marriage records: 2 · Divorce records: 1"** (blurred) over the person vCard.
- We already have a divorce landing variant (`v12-divorce`) and the life-events teaser to build on.
- Reassurance band: public records · private search (no notification) · **FCRA "not for eligibility decisions" disclaimer** (mandatory — keep framing to relationship/curiosity, never tenant/employment).

### Conversion flow
Ad → name-search landing (intent pre-filled) → loader ("searching marriage & divorce databases…") → SRP/SUP record-count teaser → email capture → $1 trial payment → report reveals the marriage/divorce timeline. Reuses the person-keyed cache + flow-aware teaser already built.

---

## B.2 — Who's Looking For You (WSFY)

### Value propositions
- **"Someone's been looking you up. See who."** — vanity + curiosity, the highest-CTR hook of the three.
- **"Find out who's searching for you — and why."**
- Safety framing: *"Is someone investigating you? Know who."*
- Reconnection framing: *"An old friend? An ex? A recruiter? See who's looking."*

### Audiences
- Broad (everyone has the curiosity), but best converters:
  - Recently active daters ("who looked me up after our date?").
  - Job seekers (recruiters).
  - Safety/privacy-conscious ("an ex", reputation management).
- Age 25–45, broad gender.
- **Retargeting goldmine:** anyone who ran any search on our site → *"While you were searching, N people searched for you."*

### Ads
- **Hooks:** *"3 people searched for your name this week."* (notification style) · *"Who's been looking you up online?"*
- ⚠️ **Honesty guardrail:** counts and searcher hints must come from **real reverse-search data only — never fabricated** (this is a hard rule; WSFY is self-built on real counts). Mask names until the viewer claims/verifies their own identity.
- **Creative:** phone-notification mockup, blurred searcher list ("someone in [city] · a possible relative").
- **Channels:** Meta + TikTok (curiosity crushes here), YouTube; light Google Search (`who searched for me online`).

### Budget (framework)
- Placeholder **$150/day**, weighted to the cheap-click channels: Meta $90 / TikTok $40 / Google $20.
- ⚠️ Curiosity clicks can be low-intent — **grade on trial→paid conversion, not CTR.**

### Landing experience
- Self-search: "Enter your name to see who's looking." → reverse-match teaser: **"N searched for you · 1 from [your state] · 1 possible relative"** (blurred), using the WsfyPaymentTeaser we built.
- Reveal of real names is **gated behind identity claim + KBA verification** (already enforced — you can't see third parties until you've verified you are who you say). The tease stays honest and masked until then.

### Conversion flow
Ad → self-name landing → loader → WSFY teaser (real, masked counts) → email capture → payment / identity claim → verified reveal. **This is also the wedge into the freemium-identity north star** — the WSFY funnel doubles as the top of the identity-community product, so spend here compounds beyond the immediate sale.

---

## B.3 — Check Your Date (pre-date safety)

### Value propositions
- **"Meeting someone new? Know who you're really talking to — before you meet."**
- Composite reveal in one report: **criminal records · sex-offender registry (NSOPW) · marital status (secretly married?) · real identity / photo / age verification (catfish check).**
- Romance-scam angle: *"$1.3B lost to romance scams last year. Don't be next."*
- This is the proven flagship of the category (TruthFinder/BeenVerified's biggest angle) and it **showcases the full breadth of our report** — the best single demonstration of everything we aggregate.

### Audiences
- **Online daters, women 25–45** (primary safety segment, highest intent).
- Men too (catfish / romance-scam concern).
- Recently matched / about-to-meet (retarget dating-adjacent interests).
- Secondary: parents of young-adult daters.

### Ads
- **Hooks:** *"Before you meet him, meet his record."* · *"Swipe. Match. Verify."* · *"Is your match hiding a marriage? A record? Find out before you meet."*
- **Search intent (Google):** `[name] background check`, `is my online match real`, `romance scam check`, `catfish lookup` — strong buy.
- **Creative:** dating-app-style UI → "run a safety check", catfish reveal, TikTok safety-tip UGC (very shareable).
- **Channels:** Meta (dating interests + lookalikes), Google Search, TikTok (safety-tip UGC).

### Budget (framework)
- Likely the strongest of the three → placeholder **$200/day**: Meta $100 / Google $60 / TikTok $40.
- Highest intent + highest willingness-to-pay (safety) — expect higher CAC but best payback.

### Landing experience
- Search by name (+ optional phone / city / photo pulled from the dating app) → composite safety teaser:
  **"⚠️ 1 criminal record · Sex-offender check: [clear/flag] · Marital status: [flag] · Identity: [verified/unverified]"** (blurred) → paywall.
- Safety-branded, responsible urgency. **Prominent FCRA disclaimer** (personal safety only — never tenant/employment/credit). Respect NSOPW display-use restrictions (location-based, not report-attributed).
- Content asset: a "date-safety checklist" for SEO/organic + retargeting.

### Conversion flow
Ad → date-safety landing (name + optional signals) → loader ("running criminal, sex-offender, marriage & identity checks…") → composite teaser → email → $1 trial → full safety report. Naturally bundles four verticals, so it's also the best upsell/retention story.

---

## Compliance guardrails (all three)
- **FCRA:** none may be positioned for employment, tenant, credit, or insurance eligibility. Every funnel carries the "not a consumer reporting agency / not for FCRA-permissible purposes" disclaimer. Keep framing to personal safety / relationships / curiosity.
- **No fabricated data** — especially WSFY counts. Real reverse-search data only.
- **Private search** — reassure the subject is never notified.
- **NSOPW / sex-offender** display has use restrictions — location-based presentation, not report-attributed.

## What I need from you to firm up budget + targeting
1. **Total monthly test budget** and any per-angle split preference.
2. **Channels you can execute now** — Meta / Google / TikTok / YouTube? (We have a live Google Ads account — there's an Ads export in the repo — plus GTM/GA4 pixels.) Ad accounts + pixels ready for each?
3. **Current CAC, target CAC / payback window, and subscriber LTV** (churn curve) — this converts the placeholder budgets into real gates.
4. **Which angle to pilot first** — my rec: **B.3 Check Your Date** (highest intent, best showcases report breadth), or **B.2 WSFY** if you want the cheapest test + north-star alignment.
5. **Creative capacity** — can we produce UGC/TikTok-style, or start with static + search?

## Suggested next step
Pick the pilot angle + confirm budget/channels, and I'll turn that one into a full campaign spec: exact ad-set structure, 5–8 headline/primary-text variants, the landing wireframe (reusing our existing SUP/teaser components), the tracking plan (GA4 events + conversion), and a day-by-day test/kill schedule.
