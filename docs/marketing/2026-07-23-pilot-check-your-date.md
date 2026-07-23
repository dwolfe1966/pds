# Pilot launch package — "Check Your Date" (pre-date safety)

**Date:** 2026-07-23 · Builds on `2026-07-23-campaign-specs.md`. This is the launch-ready package for the
recommended first pilot. **Copy is draft — compliance review before spend.**

### Assumptions (owner to confirm — easy to repoint)
- **Pilot = B.3 Check Your Date** (highest intent, best showcases the full report).
- **Channels = Meta + Google Search** (Google already live). TikTok listed as a fast-follow.
- **Budget = placeholder** pending your CAC/LTV — using **$180/day** ($100 Meta / $80 Google) for the math below.
- Offer = existing **$1 trial → $49/mo**. Success metric = **trial→paid CAC ≤ target** (need LTV to set it;
  interim guardrail: first-cycle-profitable ⇒ blended CAC < ~$35).

---

## 1. Objective & KPIs
- **North-star:** profitable paid subscribers, not clicks. Grade ad sets on **cost-per-trial** *and*
  **trial→paid %**, not CTR.
- Funnel KPIs (from GA4/GTM, `docs/EVENTS_CATALOG.md`): `landing_view → srp_view → sup_view → email_capture
  → begin_checkout → purchase`. Watch the sup→email and email→purchase steps hardest.

## 2. Audience & ad-set structure

**Meta (4 ad sets × 3 creatives):**
| Ad set | Targeting | Angle |
|---|---|---|
| AS1 — Women daters 25–45 | interests: online dating apps (Tinder/Bumble/Hinge), single, safety | primary safety |
| AS2 — Romance-scam aware | interests: fraud awareness, AARP (older skew), scam news | scam-loss angle |
| AS3 — Broad + Advantage+ | let Meta optimize on the pixel `purchase` signal | volume/scale test |
| AS4 — Lookalike 1% | LAL of past purchasers (once pixel has ≥100 conversions) | efficiency |

**Google Search (1 campaign, 4 ad groups by intent):**
- AG1 name-check: `[name] background check`, `background check on someone`
- AG2 catfish/real: `is my online match real`, `catfish lookup`, `verify online date`
- AG3 romance-scam: `romance scam check`, `is he a scammer`
- AG4 dating-safety: `date safety check`, `check someone before meeting`
- Exact + phrase match; negative-keyword list (jobs/employment/tenant — FCRA-excluded uses).

## 3. Ad copy — 8 Meta variants (rotate 3 per ad set, kill losers)
**Primary text / Headline:**
1. "Meeting someone from an app? Run a 2-minute safety check first." / **Know before you go**
2. "He seemed perfect online. The records told a fuller story." / **Check your match**
3. "Swipe. Match. Verify." / **Criminal, sex-offender, marriage & identity — one search**
4. "$1.3B was lost to romance scams last year. A quick check is free to start." / **Don't be a statistic**
5. "Is your match hiding a marriage? A record? Find out before you meet." / **See the full picture**
6. "Before the first date, know who you're really talking to." / **Date safe**
7. "Catfish use fake names and photos. Verify the real person behind the profile." / **Spot a catfish**
8. "Your safety is worth two minutes. Search any name now." / **Start your safety check**

**Google RSA:** Headlines — "Check Anyone Before You Meet", "Criminal + Sex-Offender + Marriage", "Private —
No One Is Notified", "See Their Real Identity", "Start for $1". Descriptions — "Run a safety check on your
online match. Criminal records, sex-offender registry, marital status & identity. Private & instant." /
"For personal safety only. Not for employment or tenant screening."

## 4. Landing build spec (dev-buildable)
**Create `/name/landing/v14` (date-safety)** by cloning the current best name flow and swapping the teaser:
1. **Hero** — headline "Meeting someone new? Know who you're really talking to." · name input (+ optional
   phone/city, prefill from `?q=`) · trust row (🔒 private search · public records · instant).
2. **Loader** (`OnboardingReveal`) — steps: "Searching criminal records… sex-offender registry… marriage &
   divorce… identity & photos" (~10–12s anticipation).
3. **SRP** — person picker (name/age/city) → sets the person-keyed cache.
4. **Composite SUP teaser** (NEW — assemble in `SupTeaserA`): person vCard + **blurred** safety grid:
   `⚠ Criminal records: N · Sex-offender check: [run] · Marital status: [flag] · Identity: [verify]`.
   Source = `getPersonSignals` (already flow-prioritized). NSOPW shown location-based per its display limits.
5. **Benefit bullets** — "Verify their identity · Check for records · See marital status · Peace of mind."
6. **Email capture → `/payment`** ($1 trial) → full safety report.
7. **FCRA disclaimer** (persistent footer): personal-safety/curiosity only; not a consumer report; not for
   employment/tenant/credit.

**Only new dev = the composite teaser (#4).** Everything else clones existing components.

## 5. Tracking plan
- UTM/shn scheme on every ad URL: `?shn=<pilot-shn>&utm_campaign=check-your-date&utm_medium=cpc&source=<meta|google>`
  (matches existing attribution; keep `?shn=` so BC attribution + GA4 line up — see attribution memory).
- GA4/GTM events (client_ namespace) at each funnel step; **conversion = `purchase`** (already live/verified).
- Meta pixel: standard events `ViewContent` (sup_view), `Lead` (email_capture), `Purchase`. Feed Advantage+/LAL.
- Dashboard: cost-per-trial + trial→paid % by ad set & keyword, daily.

## 6. 14-day test/kill schedule
- **D0** launch all Meta ad sets (3 creatives each) + Google campaign at the placeholder budget.
- **D3** kill any creative with CTR <0.8% *and* zero trials; reallocate.
- **D5** kill ad sets/keywords above 1.5× target cost-per-trial; keep the rest.
- **D7** first trial→paid read (7-day trial → first $49 charge). Re-grade on **paid** CAC, not trial CAC.
- **D10** scale winners +30–50%/day; launch 2 fresh creatives against the winning angle.
- **D14** decision: scale / iterate / pivot to the next angle. Write results back here.

## 7. Compliance checklist (pre-spend)
- [ ] FCRA disclaimer on landing + ads; framing stays personal-safety/curiosity (no eligibility language).
- [ ] NSOPW sex-offender data shown per its display restrictions (location-based, not report-attributed).
- [ ] No fabricated counts — teaser reflects real `getPersonSignals` output.
- [ ] "Private — no one is notified" is accurate.
- [ ] Meta/Google policy: background-check/"personal attributes" ad-policy review (Meta restricts implying
      knowledge of criminal history — keep copy to "verify/know who you're talking to", not "see their crimes").

## 8. Owner inputs to finalize
1. Confirm pilot + channels (assumed B.3 · Meta+Google).
2. **Budget + current/target CAC + subscriber LTV** → sets real allocations & kill thresholds.
3. Meta ad account + pixel access; creative capacity (UGC vs static).
