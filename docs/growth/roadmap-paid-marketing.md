# Roadmap — Paid marketing (the proven engine)

**Status:** roadmap for review
**Goal:** scale the channel that already generates our conversions and revenue, profitably.

> Paid is the one channel with **proven unit economics** — a proven model, with
> early CPAs trending down. This roadmap is about **pressing a working advantage**, not validating an
> unknown one.

---

## Current state — the campaign selection (account snapshot)

Conversion tracking is **LIVE + verified** (GA4 + Google Ads) — the signal everything optimizes against,
and the same signal affiliate postbacks hang off. Winners get replicated on our funnel
(`idlookup.ai/name/landing/v11?shns=1`). Below is the enabled set with real economics, ranked by
efficiency. **These are volume-constrained, not budget-constrained** (see the scaling note under WS1).

### Scale now — positive ROAS + real conversions
| Campaign | Vertical | Cost/conv | Value/cost | CVR | Conv | Note |
|---|---|---|---|---|---|---|
| **Pub Rec – SSN** | Public records | **$5.19** | **4.96×** | 22.6% | 7 | ⭐ best efficiency in the account |
| **Inmates (PR-IS) Lower HHI** | Inmate | **$9.18** | **3.12×** | 7.8% | 23 | ⭐ best volume × ROAS (1,951 impr) |
| **Crim Rec – Arrests/Jail (BC)** | Criminal | $10.90 | **3.67×** | 16.2% | 6 | |
| **Crim Rec – Court/Crim (BC)** | Criminal | $8.99 | **3.06×** | 13.3% | 4 | |
| **Pub Rec – SSN Lower** | Public records | $9.03 | 2.72× | 15.5% | 13 | |
| **Pub Rec – Pub Rec** | Public records | $11.61 | 2.55× | 16.2% | 12 | |
| **Inmates (PR-IS) Upper HHI** | Inmate | $16.29 | 1.87× | 4.3% | 21 | highest volume (4,114 impr) = "inmates-upper" |
| **PS Free – Orig (PS123)** | People search | $9.55 | 1.57× | 12.5% | 2 | general-intent flagship |
| **Crim – Police** | Criminal | $19.07 | 1.72× | 5.0% | 7 | positive, but watch CPA |

### Test — great ratios, thin volume (don't scale yet)
| Campaign | Vertical | Cost/conv | Value/cost | CVR | Conv | Note |
|---|---|---|---|---|---|---|
| **Dating – PS** | Dating | $3.26 | 9.72× | 37.5% | 3 | outlier efficiency; small controlled test |
| **PS Main – Orig (PS123)** | People search | $6.77 | 5.91× | 10% | 1 | promising ratios, 1 conv |
| **Inmates – Mugshots** | Inmate | — | — | 0% | 0 | spend, no conv yet; mugshot angle → ties to BookingSignal |

### Fix / hold
- **FIX first — `PS Main – lower (PS123)` is misconfigured** (missing Google tag → conversions not
  tracked). Don't judge it until the tag is fixed. Same caution for thin-impression `PS Main – UPPER` /
  `PS Free (PS123)`.
- **HOLD — sex-offender + "arrests" copy.** `Crim – Sex Offender` runs at 0.39× ROAS + policy limits;
  every other sex-offender variant is ended. Gate on legal review before reviving.
- **LEGAL** — the `"No $1 in ad copy (just Credit Card required)"` creative pattern (several ended
  locate/crim variants) needs a compliance read before reuse.

**The through-line:** the proven core is **Public Records + Inmate + Criminal** — and **Inmate is also the
SEO lead vertical and our first-party data moat.** One vertical that paid proves, SEO compounds, and we
own the data on. Point new budget + ad units there first.

---

## The workstreams

### WS1 — Relight & scale the proven core (fastest revenue)

Priority order (efficiency × volume × strategic fit):
1. **Public Records / SSN** — `Pub Rec – SSN` (4.96×), `SSN Lower` (2.72×), `Pub Rec` (2.55×). Best unit
   economics in the account.
2. **Inmate** — `Inmates Lower HHI` (3.12×) + `Upper HHI` (1.87×). Highest paid volume **and** the SEO/data
   moat — the strategic center; also test `Inmates – Mugshots`.
3. **Criminal** — `Crim Rec Arrests/Jail` (3.67×) + `Court/Crim` (3.06×); `Crim – Police` watch CPA.
4. **People Search** — `PS Free – Orig` (1.57×) as the general-intent base; plan already written in
   `docs/ads/idl-general-intent-campaign-plan.md` (v11 landing, ad units A/B, keywords).
5. **Dating – PS** — a **small** test only (stellar ratios on 3 conv).

**Scaling note — volume-limited, not budget-limited.** Nearly every campaign reads "limited by search
volume" despite large daily budgets (inmate = $2,600/day). More budget alone won't scale them — **broaden
keywords/match types + add ad units**, and grow coverage via the vertical pages (SEO×paid compounding).
Port winning ad units verbatim first, then iterate — don't rewrite proven creative from scratch.

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
