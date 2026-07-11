# idlookup.ai Funnel — What to Mimic from BeenVerified (and What to Reject)

_Draft 2026-07-11. Built on the first-hand teardown in `docs/design/beenverified-funnel-teardown-2026-07.md`
and the 2026-03-16 competitor UX research. Tiered by BOTH conversion impact and compliance/FTC risk._

## 0. Read first: our funnel is already the more honest one

We are **not** behind BeenVerified on integrity — we're ahead. Our funnel keeps a **real SRP** + a
**`SupTeaserA` teaser with masked-but-never-fabricated counts** + **value-before-email**. BeenVerified's
default paid arm **skips the results/teaser entirely** and replaces it with a ~90-second **fake-progress
loader** that **captures email mid-loader at a frozen 75%** (sunk-cost) before showing anything, then
walls a $36.89/mo sub with a hidden $1 trial and phone-only cancellation.

So this is **not** "copy BeenVerified." It's: **borrow their anticipation/persuasion craft, keep our
honesty, and reject their dark patterns.** The advisor's frame holds — rank by risk, not just lift, and
let the owner pick.

**Cheapest first move (do before anything below):** the **2026-07-03 funnel redesign is committed but
NOT deployed** (`project_funnel_redesign_2026_07_03`). Deploying it is a built-and-paid-for conversion
win sitting on the shelf. Ship that first; measure; then layer the items below.

---

## Tier A — Safe + high-ROI (recommend building)

These raise conversion without adopting a dark pattern. Aligned with the owner's value-first stance.

### A1. A much richer, longer anticipation loader (highest-leverage gap)
Our loader is functional; BeenVerified's is a **conversion instrument**. Without lying about progress,
add to our `*/loader` pages:
- **Animated "Searching:" checklist** that reveals real source categories we actually query
  (public records, court records, address history, phone/email, relatives…) — reinforces perceived depth.
- **Live-activity ticker** ("35,000+ searches today," "N reports generated this hour") — social proof.
  Use **real** rolling numbers if we can, or clearly plausible aggregate copy; avoid fabricated
  per-user claims.
- **Rotating testimonials / anticipation panels** ("Did you know…") to fill dwell time.
- Keep the loader honest about progress (no frozen-75% email gate — that's Tier C).
- **DO NOT** add a "confidential / we never notify the person you searched" line — see A3.

### A2. Bulk-plan price anchor at the paywall
BeenVerified shows $36.89/mo **next to** a $71.94/3-mo ($23.98/mo) anchor — classic decoy that makes the
default look reasonable. We show a bare $1 trial → $49.98/mo. Add a **higher-priced multi-month or
"premium" comparison** beside our default so the chosen plan is anchored, not naked. Pure presentation;
no compliance cost. A/B it.

### A3. ~~"Confidential search" reassurance~~ — REJECTED (owner, 2026-07-11)
Do **NOT** add any "100% confidential / we never notify the person you searched" messaging. It is
**counter to our business model**: we are two-sided — the person being searched is *also* a customer
(WSFY / "who's searching for you"). Promising searchers their activity is invisible guts the product we
sell on the other side. Stay **neutral** on the search funnel: neither promise confidentiality nor
advertise visibility (which would scare searchers off). The 2026-03-16 competitor research recommended
this line; it does not apply to us. _(This is why we're NOT BeenVerified/TruthFinder — they're
one-sided search tools; we monetize both sides.)_

### A4. Payment-method breadth (already on the roadmap)
BeenVerified offers Apple Pay / Google Pay / PayPal / card. **PayPal is already a near-term owner item
(2026-07-08 backlog)** — this teardown reinforces it. PayPal + wallet buttons reduce checkout friction.
Gated on BC supporting the **recurring** PayPal billing agreement (BC ask — scope first).

## Tier B — Effective, needs judgment

### B1. Progressive input refinement
BeenVerified drips inputs one screen at a time (name → city → age/middle → …) each with an "I'm not
sure" escape, maximizing commitment via small steps. Our wizards already collect stepwise; the mimic is
the **"I'm not sure / skip" escape on every step** (keeps users moving instead of bouncing on a field
they can't answer) and tighter one-question-per-screen pacing. Low risk, real lift. Note: the owner has
**already decided to keep the "Possible Matches Found!" pre-search hook** (`project_adunit_funnel_review`)
— consistent with this tier.

### B2. Pre-sell monitoring/alerts inside the funnel
BeenVerified bundles "ongoing monitoring" into the sub via fear-of-missing-changes, pitched **in the
loader**. This is a direct tie-in to our **Identity Management / Alerts** product
(`identity-management-wsfy-plan.md`): once we have a real monitoring story, pre-sell it as part of the
membership value at the paywall. Sequence **after** the monitoring backend exists so we're not
pre-selling vapor.

## Tier C — Reject (FTC/FCRA risk; owner already rejects these)

Document them so we're deliberate, not accidental:
- **Email-before-value** (capturing email mid-loader before showing anything) — we capture at signup,
  after value. Keep it.
- **Fake progress** (frozen 75%, fabricated per-user "searching" that isn't) — we keep loaders honest.
- **Hidden $1 trial behind exit-intent + silent auto-convert** — our trial terms are disclosed at the
  CTA. Don't bury them.
- **Phone/email-only cancellation** buried in an FAQ — retention-by-friction; FTC "click-to-cancel"
  exposure. Keep cancellation self-serve.
- **"Someone is searching for you" as a funnel hook** — that's a MyLife tactic, **absent from
  BeenVerified**. It's a *differentiation opening for our WSFY product*, but only if the signal is
  **real** (BC inbound-activity finder). Don't fake it in the funnel.

## Resolution (owner 2026-07-11): build it as an OPTIONAL FLOW, don't choose

The real question BeenVerified raises is architectural — **keep our real SRP+teaser, or move to their
loader-replaces-teaser model?** Owner's answer: **don't pick — build the BeenVerified structure as a
separate, parallel _optional flow_ and A/B it against our existing funnel.** This is pulled **early**
(Wave 1), because it's additive and reversible: the existing proven path is untouched, a controlled
slice is routed through the new flow, and the winner earns more traffic. We get the data instead of
betting the "one conversion shot" on a guess.

**What the optional flow is (build spec, v0):**
- A **new funnel route** — e.g. `…/landing/v7` or a `?flow=bv` / feature-flagged arm off the existing
  landing. Existing `…/v2–v6` routes and their traffic are **unchanged**.
- **Structure = BeenVerified's (3-step drip, built 2026-07-11):** `name → location(+city) →
  details(age/middle + FCRA consent)`, each with an "I'm not sure" escape → a **long anticipation
  loader that carries the payoff** (loader-replaces-teaser: category checklist that checks off +
  carouseled anticipation panels + personalized email gate; ~15s now, TODO tune toward BV's 60–90s) →
  paywall with the bulk-plan anchor. Fires `search_step ×3` + `fcra_agree` + `loader_start` +
  `email_capture` + `loader_complete`.
- **No step counter** (owner 2026-07-11): the drip shows no "Step X of N" — a visible count signals
  commitment ahead (friction); BV hides drip length, the "I'm not sure" escapes carry momentum.
- **Extended post-email tail** (owner 2026-07-11): two-phase loader — freezes at **75%** for the email
  gate, then a longer **75→100% "Finalizing your report"** tail (~16s) with rotating status lines +
  all checklist items completing, before hand-off.
- **Social-proof / infographic assets** (`BvSocialProof.js`, all inline SVG/CSS — no external images,
  CSP-safe, no trademark risk): ★ review bar, security badges, a rotating testimonial, an animated
  "reports generated" live counter, and a **use-case donut infographic** ("How people use IDLookup").
  ⚠️ **All numbers/testimonials are PLACEHOLDER** (centralized in `PLACEHOLDER_*` consts) — owner must
  approve real/substantiated figures before live traffic; do not run fabricated stats as fact.
- **THREE hand-off versions** (owner 2026-07-11), selected by `?dest=`:
  `serp` → `/name/search-result` · `sup` → `/search/:id` (top match) · `payment` → `/payment` (faithful
  BV, no results shown). Each is a **distinct funnel arm** — landing variant `bv-serp | bv-sup |
  bv-payment` — so the three convert-rates are directly comparable. `sup`/`payment` **fall back to
  `serp`** when the search returns no top match (verified: dev-captcha 0-results → SERP fallback).
- **Gating — MANUAL FEATURE FLAG (owner decision 2026-07-11).** The flow lives behind a flag, **off by
  default**. We flip it on for **internal / manual testing first**, before exposing any real ad traffic.
  No automatic A/B split at first. Once it's validated internally, decide separately whether to promote
  it to a % split on live traffic. Implementation: a single flag (env/config or a query-param override
  for manual QA) that routes to the new `…/v7` / `?flow=bv` route.
- **Fidelity — STRUCTURE + EMAIL-TIMING TEST (owner decision 2026-07-11).** Copy their structure
  faithfully **and test capturing email mid-loader (before value is shown)** as a remarketing lead —
  their highest-leverage tactic. **Keep our hard guardrails: disclosed trial terms + self-serve
  cancellation** (we do NOT copy the hidden exit-intent trial or phone-only cancel). So the flow is:
  progressive drip → long anticipation loader → **email capture mid-loader** → finish loader → paywall
  (disclosed trial, price anchor).
- **Email-mid-loader implications:** (1) the captured email is a **remarketing lead, not an account**
  (accounts still require full signup) — it feeds the abandoned/remarketing pipeline (area iv), so this
  flow is a reason the email backend matters. (2) Needs a **consent/notice** at capture (CAN-SPAM /
  privacy) — a short "by continuing you agree to…" line, not a silent grab. (3) Suppression applies.
- **Measurement:** requires the Wave 0 instrumentation (`loader_complete`/`teaser_view`/`email_capture`
  distinct, variant-tagged) so the internal test — and any later live split — is readable.

## Sequence
1. **Deploy the 2026-07-03 redesign** (already built — cheapest win).
2. **A1 richer loader** (highest lift, no risk). _(A3 confidentiality — REJECTED, do not build.)_
3. **A2 price anchor** (A/B) + **B1 progressive refinement / skip escapes**.
4. **A4 PayPal/wallets** (gated on BC recurring-PayPal support — scope the ask now).
5. **B2 monitoring pre-sell** — after the Identity/monitoring backend exists.
6. Per-ad-unit content optimization (owner's own planned pass) folds into steps 2–3.

## Metrics
Landing→search→loader-complete→teaser→signup→paid, per ad unit and per variant. We already fire the
`client_*` GA4 funnel; make sure loader-complete and teaser-view are distinct steps so A1/A2/B1 lift is
measurable.
