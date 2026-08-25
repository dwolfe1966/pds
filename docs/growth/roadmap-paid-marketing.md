# Roadmap — Paid marketing (the proven engine)

**Status:** roadmap for review
**Goal:** scale the channel that already generates our conversions and revenue, profitably.

> Paid is the one channel with **proven unit economics** — a proven model, with
> early CPAs trending down. This roadmap is about **pressing a working advantage**, not validating an
> unknown one.

---

## Current state (proven, with real numbers)

Legacy compet account, **a recent 14-day window** (`docs/ads/compet/`) — the winners we replicate:

| Campaign (legacy) | Vertical | Spend | Conv. | CPA / cost-per-conv | CVR | Value/Cost |
|---|---|---|---|---|---|---|
| **PS Free – Orig (PS123)** | People search | $87.08 | 7.5 | **$11.61** (best ad group `Find Free`: **$7.68**) | 8.15% | — |
| **Crim Rec – Court/Crim (BC)** | Criminal/court | $153.42 | 9 | **$17.05** | 7.50% | **1.45×** |
| **LE – death (lower HHI)** | Life-events | $176.54 | 11 | **$16.05** | 7.33% | **1.78×** |

- **Conversion tracking is LIVE and verified** (GA4 + Google Ads purchase events) — the signal
  everything optimizes against, and the same signal affiliate postbacks hang off.
- Landings already point at the current funnel: `idlookup.ai/name/landing/v11?shns=1`.
- Most of the ~30 legacy campaigns are **paused/ended** — the opportunity is to relight the proven
  winners on our current landings/economics, not to invent demand.

**The strategy:** replicate the **economically profitable ad units** from compet, using the segmentation
approach already proven on **inmates-upper** and **people-search-upper** (upper-HHI targeting).

---

## The workstreams

### WS1 — Port the proven winners (fastest revenue)

Relight the campaigns with real, positive economics on our current landings:

- **People Search Free** (`PS Free / PS123`, $11.61 CPA) → live plan already written:
  `docs/ads/idl-general-intent-campaign-plan.md` (Campaign 1, $50/day, `name/landing/v11?shns=1`,
  ad units A/B drafted, keyword set defined).
- **Criminal / court records** (`Crim Rec`, 1.45× value/cost) → rides the same intent our inmate SEO
  vertical targets.
- **Life-events – death / divorce** (`LE-death` 1.78× value/cost) → aligns with the life-events data
  vertical.
- Port the **winning ad units verbatim** (headlines/descriptions that already earned the CPA), then
  iterate — don't rewrite proven creative from scratch.

### WS2 — Segmentation (the "upper" approach)

- Replicate the **upper-HHI** targeting proven on **inmates-upper** and **people-search-upper** — higher
  intent-to-pay cohorts, better back-end economics.
- Structure campaigns by vertical × segment (upper vs. broad), so budget flows to the segments that
  convert to *paid*, not just to clicks.

### WS3 — Landing / funnel mapping

- Map each ad unit to the right landing + SUP teaser variant (funnel redesign + SUP challenger variants
  already built). Match message to keyword intent (free-search intent → free-framed landing, etc.).
- Reuse the `shns` param convention so attribution + partner/segment context persist through to BC
  (`commerceorders.refer`).

### WS4 — Measurement & unit economics (keep it honest as we scale)

- **CAC vs. LTV per vertical/segment** — the decision metric for scaling each campaign.
- **Cohort quality via the M-code billing classification** (`project_csr_billing_classification`) —
  distinguish real subscribers from declines/involuntary churn so CPA isn't flattered by unpaid
  conversions. Paid traffic quality shows up here first.
- GA4 + Ads (live) for conversion; watch for headless/bot inflation (GA4 drops some headless hits).

### WS5 — Scale cadence & budget governance

- **Scale winners, cut losers** on a fixed review cadence; move budget toward the lowest-CPA /
  highest-value-per-cost campaigns.
- Respect the **service spend guards** (`reference_service_budgets`) — daily caps on the enrichment
  services paid traffic can trigger downstream (Enformion/PDL/captcha/Twilio).
- Start each ported campaign **Paused-for-review → small daily budget → scale on proven CPA** (the plan
  doc's default).

### WS6 — New / adjacent angles (from the compet inventory + our data)

Proven-or-promising verticals in the legacy account to test against our first-party data + funnels:

- **Reverse phone**, **arrest/sex-offender** (search) — align to NSOPW/criminal data + **legal flags**
  before scaling.
- **Dating / background-check** cross-intent (compet ran Dating-BG, Dating-Cheating).
- The three new marketing angles already scoped (`project_marketing_angles`): marriage/divorce, WSFY,
  check-your-date funnels.

---

## Phasing

- **Now:** relight **PS Free** on `name/landing/v11` per the existing plan doc (proven $11.61 CPA);
  confirm conversion tracking end-to-end on the live landing.
- **Near:** add **Crim Rec** + **LE-death** (positive value/cost); stand up the upper-HHI segments.
- **Mid:** scale winners against CAC/LTV + M-code cohort quality; expand landings/SUP variants per
  vertical.
- **Ongoing:** budget governance, creative iteration, new-angle tests gated on legal review.

## Open items

- Confirm the **current live CPA trend** on our own account (not just legacy compet) to set scale
  thresholds.
- **Legal review** for arrest/sex-offender/criminal ad copy + landing claims before scaling those.
- Per-vertical **CAC↔LTV** targets (needs the M-code cohort read).

## What we can do this week

- Relight **PS Free – Orig** on `idlookup.ai/name/landing/v11?shns=1` (plan + ad units already written),
  Paused-for-review → $50/day.
- Verify the GA4/Ads conversion fires on the live v11 landing (real purchase, not headless).
- Pull the current-account CPA trend to anchor scale decisions.
