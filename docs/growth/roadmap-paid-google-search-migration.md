# Paid — Part 1: Google Search campaign migration

**Status:** execution roadmap   **Scope:** Google **Search** only (Display / PMax / Demand Gen are out of
scope here — nearly all are paused/policy-limited in the account).
**Parent:** [`roadmap-paid-marketing.md`](roadmap-paid-marketing.md) (WS1). Data source:
`Campaign report - Campaign report.csv`.

## What "migrate" means

Rebuild each proven Search campaign in **our** Google Ads account, pointed at **our** funnel
(`idlookup.ai/name/landing/v11`), with tracking wired and bids/budgets reset. Port the winning
**keywords + ad copy verbatim**; change only what must change. We can't inherit the source account's
bid-strategy learning or conversion history — so every migrated campaign starts fresh and re-earns its
target.

## Standard mods — applied to EVERY migrated campaign

1. **Landing** → our funnel: `idlookup.ai/name/landing/v11?shns=<id>` (vertical-matched SUP where one
   exists — see per-campaign column).
2. **Tracking** → GA4 + Google Ads conversion action wired **and verified on a real purchase** before the
   campaign is trusted. (The account's misconfigured campaigns prove this is the #1 failure mode.)
3. **Bid strategy** → **Target CPA from day one, seeded at the proven eCPA** (or a hair below) — this
   instructs Google to *hold* the CPA instead of letting it float. Do **not** launch on uncapped
   *Maximize Conversions* — that's the eCPA-risk mode. With no history in our account, pool signal via a
   **portfolio Target CPA** across the migrated core so it learns faster. If tCPA throttles volume early,
   that's the **safe** failure (low spend), not a blown CPA. Thin-vertical alternative: a hard **CPC cap =
   the proven Avg. CPC** (Manual / Max-Clicks) so eCPA is bounded by CVR while data accrues, then move to
   tCPA. See **Protecting eCPA** below.
4. **Budget** → reset to a controlled start (below). Budget is a **ceiling, not a target** — these are
   volume-limited (see note), so budget rarely binds.
5. **Attribution** → distinct `shns=<id>` per campaign so partner/segment persists to BC
   (`commerceorders.refer`).
6. **Naming** → standardize `Vertical – Segment – v1` (drop legacy `PS123 / BC / PR-IS` tags).
7. **Geo / schedule / negatives** → port; attach shared negative + brand lists.
8. **Policy** → rewrite every disapproved / policy-limited ad before launch (criminal, arrests,
   life-events, and the `"$1 / credit-card-required"` disclosure pattern all tripped policy).

**Scaling note (applies throughout):** almost every campaign is *"limited by search volume"* despite large
budgets — but **scaling ≠ migration.** Migration ports the winners **like-for-like to protect eCPA**;
volume expansion (broader keywords/match) is a **separate, guarded phase** (see Protecting eCPA). The
**lowest-eCPA-risk way to add volume is SEO** — the inmate/life-events vertical pages feed the same intent
at near-zero marginal cost — not aggressive paid keyword broadening.

---

## Protecting eCPA — the core constraint

Migration can't be zero-risk: the **landing changes** (source → our v11) and the **account changes**, and
both move eCPA (`eCPA = Avg.CPC ÷ CVR`). The goal is to **isolate, bound, and guard** the risk — not
pretend it's absent.

1. **Isolate the one unavoidable variable — the landing.** Hold everything else *identical*: exact
   keywords, match types, negatives, geo, schedule, and a tCPA seeded at the proven number. Then any eCPA
   move is attributable to the landing, and the fix is the landing/SUP — not a hunt through confounded
   changes. Pre-validate v11 CVR per vertical in Wave 0 where possible; match the SUP tightly to ad intent.
2. **Never move two levers at once.** Bid, keywords, match types, budget are each eCPA levers. Migrate
   with them **frozen at the proven values**; change exactly one per test afterward.
3. **Bound the downside per campaign:** tCPA seeded at proven (fails safe by throttling volume, not
   overspending) · **small daily budget** · an **eCPA kill-switch** — automated rule to pause/alert if
   trailing-7-day eCPA > proven **×1.4** *after ≥ ~15 conversions* (below that it's noise).
4. **Respect conversion lag.** Early eCPA reads inflated because conversions lag clicks + the conversion
   window. **Don't react before the window closes and ~15–30 conversions accrue** — knee-jerk edits reset
   learning and make eCPA worse.
5. **Decouple scale from the proven core.** Volume expansion goes in a **separate "expansion" sibling
   campaign** with its own test budget + guardrail — **never** added to the proven campaign, so the core's
   eCPA is never contaminated. Prove the expansion at target eCPA before folding budget in.
6. **Prefer in-place modification.** If a campaign already lives in **our** account, don't rebuild it —
   **repoint the landing to v11 and keep its bid learning.** That isolates to the single unavoidable
   variable and preserves the most eCPA history. Rebuild only what lives solely in the source account.

---

## Priority — migrate in waves

### Wave 0 — Foundations (before any migration; days, not weeks)
Nothing scales on broken tracking.
- **Fix conversion tracking / the Google tag** and verify GA4 + Ads fire on a **real v11 purchase**
  (not headless — GA4 drops bot hits).
- Create conversion actions; standardize naming; build shared **negative-keyword** + brand lists; set
  **geo = US**, ad schedule.
- Confirm account structure = **one campaign per vertical × segment** (mirrors what already works).
- **Check account ownership per campaign.** Anything already in **our** account gets **modified in place**
  (repoint landing to v11, keep its bid learning) — lowest eCPA risk. Only *rebuild* what lives solely in
  the source account.
- Build the **portfolio Target CPA** + the **eCPA kill-switch** automated rule (pause/alert at proven
  ×1.4 after ≥15 conv) so guardrails exist before spend starts.

### Wave 1 — Proven core (migrate first) — positive ROAS + real volume
The four-vertical profitable core. Ordered by ROAS × volume × strategic fit.

| # | Campaign → new name | Vertical | Landing / SUP | Bid strategy | Start $/day | Target CPA | Campaign mods |
|---|---|---|---|---|---|---|---|
| 1 | Inmates Lower HHI → `Inmate – Lower – v1` | Inmate | v11 + **inmate/booking SUP** (BookingSignal) | Portfolio tCPA @proven | $100 | ~$10 | port EXACT winning kw + match; **no broadening at migration** |
| 2 | Inmates Upper HHI → `Inmate – Upper – v1` | Inmate | inmate/booking SUP | Portfolio tCPA @proven | $250 | ~$14 | **biggest volume**; expansion = separate guarded phase |
| 3 | Pub Rec – SSN Lower → `PubRec-SSN – Lower – v1` | Public records | v11 + **records/SSN** framing | Portfolio tCPA @proven | $100 | ~$10 | |
| 4 | LE – Death (Upper HHI) → `LifeEvents-Death – Upper – v1` | Life-events | **life-events teaser** (death/obit) | Portfolio tCPA @proven | $200 | ~$15 | fix policy-disapproved ads |
| 5 | LE – Divorce (Upper HHI) → `LifeEvents-Divorce – Upper – v1` | Life-events | LE teaser (divorce) | Portfolio tCPA @proven | $200 | ~$17 | aligns w/ Enformion divorce data |
| 6 | Pub Rec – Pub Rec → `PubRec – Broad – v1` | Public records | records SUP | Portfolio tCPA @proven | $150 | ~$13 | |
| 7 | Pub Rec – SSN → `PubRec-SSN – Broad – v1` | Public records | records/SSN | Portfolio tCPA @proven | $75 | ~$9 | some ads policy-limited → fix |
| 8 | Crim Rec – Court/Crim (BC) → `Criminal-Court – v1` | Criminal | v11 + **criminal SUP** | Portfolio tCPA @proven | $75 | ~$9 | criminal-copy compliance |
| 9 | Crim Rec – Arrests/Jail (BC) → `Criminal-Arrests – v1` | Criminal | criminal SUP | Portfolio tCPA @proven | $75 | ~$17 | arrests-copy compliance (careful) |

**Wave-1 exit gate:** each campaign firing tracked conversions and **holding near its proven eCPA
(kill-switch quiet)** across ≥~15–30 conversions in *our* account. Only then raise budgets / open an
expansion sibling / start Wave 2.

### Wave 2 — Recover & tighten (after Wave 1 proves the pipe)
| Campaign | Vertical | Why here | Mod focus |
|---|---|---|---|
| **Reverse Phone – Track / Competitors / Call** | Reverse phone | Whole vertical **converting blind** (missing tag) — could already be winning | **Fix tag first**, then migrate as a Wave-1-style set |
| **Crim – Police** (1.44×, 16 conv) | Criminal | Positive but **high CPA ($21)** | Tighten keywords/negatives + tCPA before scaling |
| **LE – death (lower HHI)** (1.02×, 8 conv) | Life-events | **Breakeven** | Optimize copy/landing/segment before committing budget |
| **LE – Marriage (Upper HHI)** (3.35×, 5 conv) | Life-events | Strong ROAS, thinner volume | Migrate + gather more volume |

### Wave 3 — Efficiency tests (small budgets, prove-then-scale)
Start each at **$30–50/day**, MaxConv, judge on ≥10–15 conversions before scaling.

| Campaign | Vertical | Signal |
|---|---|---|
| **Dating – PS** | Dating | 4.29× ROAS, 21% CVR (4 conv) — efficiency star |
| **Compet – TF (BC)** | Competitor conquest | 4.84× ROAS (5 conv) — conquest works |
| **PS Main – Orig (PS123)** | People search | 6.98× ROAS (2 conv) — best ratios, thin |
| **Inmates – Mugshots** | Inmate | 2.32× (1 conv) — mugshot angle → BookingSignal |
| **Compet – General (PSs)** | Competitor conquest | 1.55× (3 conv) |

### Hold — do NOT migrate yet
- **Sex-offender / "arrests" variants** — `Crim – Sex Offender` runs at **0.83× (a loss)** + policy;
  all others ended. **Legal review** gates any revival.
- **PS Free – Orig (PS123)** — **0.92× (underwater)** this window; optimize the "free" angle before spending.
- **`"$1 / credit-card-required"` creative variants** — compliance read before reuse.
- **Display / PMax / Demand Gen** — out of scope for this Search-focused part.

---

## Sequencing summary

```
Wave 0  Foundations (tracking + structure)      ── prerequisite, days
Wave 1  Inmate ×2 · PubRec ×3 · LifeEvents ×2 · Criminal ×2   ── the profitable core
Wave 2  Reverse Phone (fix tag) · Crim-Police · LE-death-lower · LE-Marriage
Wave 3  Dating-PS · Compet-TF · PS-Main-Orig · Mugshots · Compet-General   ── small tests
Hold    sex-offender/arrests · PS-Free-Orig · "$1" creatives · non-Search
```

**Through-line:** Wave 1 leads with **Inmate + Life-events**, which are *also* our SEO lead verticals +
first-party data moat — the same investment compounds across paid and organic. Keyword/volume expansion
(the real scaling lever) is exactly where the SEO vertical pages feed paid.

## Open items to confirm before Wave 1
- **Landing/SUP per vertical** — confirm the best-matched SUP exists (inmate→BookingSignal, criminal,
  life-events, records) or design it; default to `v11` where none exists yet.
- **Target-CPA seeds** — the numbers above are the proven cost/conv; confirm against LTV per vertical
  (M-code cohort quality) so we're not scaling to unprofitable-after-refunds conversions.
- **`shns` id map** — assign a distinct id per campaign for BC attribution.
