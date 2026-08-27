# Roadmap — Paid marketing (the proven engine)

**Status:** roadmap for review
**Goal:** scale the channel that already generates our conversions and revenue, profitably.

> Paid is the one channel with **proven unit economics** — a proven model, with
> early CPAs trending down. This roadmap is about **pressing a working advantage**, not validating an
> unknown one.

---

## Current state — the campaign selection (account snapshot)

The account runs **profitably in aggregate: 2.22× value/cost, $13.43 cost/conv, 7.88% CVR** across 297
conversions (source: `docs/growth/Campaign report - Campaign report.csv`). Conversion tracking is
**LIVE + verified** (GA4 + Google Ads) — the signal everything optimizes against and the one affiliate
postbacks hang off. Winners get replicated on our funnel (`idlookup.ai/name/landing/v11?shns=1`).
**These are volume-constrained, not budget-constrained** (see the scaling note under WS1).

### Scale now — positive ROAS + real conversion volume
| Campaign | Vertical | Cost/conv | Value/cost | CVR | Conv | Note |
|---|---|---|---|---|---|---|
| **Inmates (PR-IS) Lower HHI** | Inmate | **$9.49** | **3.06×** | 7.9% | 40 | ⭐ best volume × ROAS |
| **Pub Rec – SSN Lower** | Public records | **$9.77** | **2.49×** | 15.2% | 32 | ⭐ |
| **LE – Death (Upper HHI)** | Life-events | $14.87 | **2.02×** | 9.4% | 35 | life-events is now a core vertical |
| **LE – Divorce (Upper HHI)** | Life-events | $16.76 | 1.57× | 9.4% | 32 | |
| **Inmates (PR-IS) Upper HHI** | Inmate | $13.86 | 1.87× | 4.7% | 52 | ⭐ most volume in the account (~11.6k impr) |
| **Pub Rec – Pub Rec** | Public records | $12.48 | 2.08× | 11.7% | 25 | |
| **Crim – Police** | Criminal | $21.23 | 1.44× | 4.9% | 16 | positive, watch CPA |
| **Pub Rec – SSN** | Public records | $8.91 | **2.81×** | 11.9% | 10 | |
| **Crim Rec – Court/Crim (BC)** | Criminal | $8.85 | **2.75×** | 13.8% | 8 | |
| **Crim Rec – Arrests/Jail (BC)** | Criminal | $17.23 | 2.0× | 11.1% | 9 | |
| **LE – death (lower HHI)** | Life-events | $23.92 | 1.02× | 5.5% | 8 | breakeven — optimize or hold |

### Test — strong ratios, thin volume (prove before scaling)
| Campaign | Vertical | Cost/conv | Value/cost | CVR | Conv | Note |
|---|---|---|---|---|---|---|
| **Compet – TF (BC)** | Competitor conquest | $8.26 | **4.84×** | 14.3% | 5 | conquest vs. a competitor brand |
| **Dating – PS** | Dating | $6.42 | **4.29×** | 21.1% | 4 | efficiency star |
| **LE – Marriage (Upper HHI)** | Life-events | $11.95 | **3.35×** | 7.7% | 5 | |
| **PS Main – Orig (PS123)** | People search | $3.94 | **6.98×** | 18.2% | 2 | best ratios, thin |
| **Inmates – Mugshots** | Inmate | $17.21 | 2.32× | 4.0% | 1 | mugshot angle → BookingSignal |
| **Compet – General (PSs)** | Competitor conquest | $15.01 | 1.55× | 13.6% | 3 | |

### Fix — misconfigured, converting blind (recover first)
Several **enabled** campaigns read **"Eligible (Misconfigured) — missing a Google tag"**, so conversions
aren't tracked and they can't be judged. **Fix the tag before deciding on them:** `Reverse Phone –
Track / Competitors / Call`, `PS Main – lower (PS123)`, `LE – marriage lower`, `LE – divorce (lower)`,
`BG – Misc Misc`. Reverse-phone (a whole vertical) is spending with **zero visible conversions** — likely
converting blind.

### Hold — legal / underwater
- **Sex-offender + "arrests" copy** — `Crim – Sex Offender` runs at **0.83× (a loss)** + policy limits;
  every other sex-offender/arrests variant is ended. Gate on legal review before reviving.
- **`PS Free – Orig (PS123)`** — **0.92× this window (slightly underwater)**; the generic "free" people-
  search play is marginal — optimize or deprioritize vs. the winners above.
- **LEGAL** — the `"No $1 in ad copy (just Credit Card required)"` creative pattern needs a compliance read.

**The through-line:** the proven core is **Inmate + Public Records + Life-events + Criminal** — four
verticals above breakeven, Inmate carrying the volume. **Inmate + Life-events are also our SEO lead +
first-party-data verticals** — paid proves them, SEO compounds them, we own the data. Point new budget +
ad units there.

---

## The workstreams

### WS1 — Relight & scale the proven core (fastest revenue)

> **Execution plan (Part 1):** [`roadmap-paid-google-search-migration.md`](roadmap-paid-google-search-migration.md)
> — which campaigns to migrate, with what mods, in what wave order (Google Search focused).

Priority order (ROAS × volume × strategic fit):
1. **Inmate** — `Inmates Lower HHI` (3.06×, 40 conv) + `Upper HHI` (1.87×, 52 conv — biggest volume in the
   account). Highest paid volume **and** the SEO/data moat — the strategic center; also test `Mugshots`.
2. **Public Records / SSN** — `SSN Lower` (2.49×, 32) + `Pub Rec` (2.08×, 25) + `SSN` (2.81×, 10). Deep,
   efficient demand.
3. **Life-events** — `Death Upper` (2.02×, 35) + `Divorce Upper` (1.57×, 32) + `Marriage Upper` (3.35×).
   Aligns with the Enformion divorce/marriage data vertical.
4. **Criminal** — `Court/Crim` (2.75×) + `Arrests/Jail` (2.0×); `Crim – Police` (1.44×, watch CPA).
5. **Tests (small, controlled; scale on proof):** `Dating – PS` (4.29×), `Compet – TF` conquest (4.84×),
   `PS Main – Orig` (6.98×).
6. **Recover the misconfigured campaigns** — fix the Google tag before writing any of them off (esp. the
   whole Reverse Phone vertical).

**Scaling note — volume-limited, not budget-limited.** Nearly every campaign reads "limited by search
volume / missing enough relevant keywords" despite large daily budgets (inmate = $2,600/day). More budget
alone won't scale them — **broaden keywords/match types + add ad units**, and grow coverage via the
vertical pages (SEO×paid compounding). Port winning ad units verbatim first, then iterate.

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

## Owners (RACI)

*Roles, not names (assign in planning): **Lead** growth · **Eng** · **Analyst** · **Design** · **techBC**
BC eng · **Legal** · **CEO** · **Partner**. RACI: R does the work · A accountable/sign-off (one per row) ·
C consulted · I informed. Weeks map to the Gantt timeline.*

| Phase / task | Wks | R | A | C | I |
|---|---|---|---|---|---|
| Wave 0 · tracking + GCLID | W1–2 | Eng, Analyst | Lead | techBC | CEO |
| Legal sign-off (SSN/arrests/mugshots) | W1–3 | Lead | CEO | Legal | Eng |
| Wave 1 · launch (Paused→live) | W2–3 | Lead | Lead | Eng | CEO |
| Wave 1 · eCPA proving | W3–6 | Lead, Analyst | Lead | — | CEO |
| Wave 2 · recover (tags, Rev-Phone) | W4–8 | Eng, Lead | Lead | Analyst | CEO |
| Wave 3 · efficiency tests | W6–9 | Lead | Lead | Analyst | — |
| Scale winners + budget up | W6–12 | Lead | Lead | Analyst | CEO |
