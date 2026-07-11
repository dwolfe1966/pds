# Freemium Strategy — Keeping Free Users Warm Until They Convert

_Draft 2026-07-11. Grounded in `docs/design/freemium-current-state.md` (current-state audit)._

## 0. The honest starting point

Today there is **no durable free tier — "free" just means "pre-trial."** The value curve is a binary
cliff: a free user gets real *search* and real *teasers*, but **zero full reports**; paid gets the
report ($1.00 / 7-day trial → $49.98 recurring, `src/services/brand.js:40-42`). Every teaser
dead-ends at the same paywall (`/people/:id`, the only paid-gated route). A non-converting free user
has **essentially nothing durable to return for**: the two "engagement" features (WSFY, Alerts) are
mock, the free dashboard renders empty personal state, nothing persists server-side, and there is no
email re-engagement loop.

That's the whole problem in one sentence: **we capture the account, then give it no reason to come
back.** People-search is inherently transactional (a one-off need), so "keep free users happy until
we convert" means *manufacturing recurring reasons to return that a one-off searcher wouldn't
otherwise have.*

## 1. What "free" is actually for (strategy)

Free's job in this category is **not** to be a generous product — it's to:
1. **Capture the account/email at peak intent** (they came to search someone).
2. **Hold a warm relationship** across the gap between (a) this search need and (b) the next one, or
   (c) the moment identity-anxiety converts them.
3. **Feed the email lifecycle** (area iv) so we can re-engage on our schedule, not theirs.

So the free tier is a **retention & re-engagement instrument**, and its content should be chosen for
"gives a reason to return + a reason to upgrade," not "maximally useful for free."

## 2. The free-value ladder (what we give, in order of leverage)

### Lever A — Rich free self-experience via PARTIAL reveal (the MyLife model) — the anchor
_Owner direction 2026-07-11: at MyLife the rich free experience did **NOT** give away a full background
report. It gave away **parts** of it — about the individual themselves ("see YOU"). Do that here._

Let any member get a rich, engaging view of **what's publicly out there about _them_** — **without
handing over the full paid report**:
- **Exposure / reputation preview of yourself** — the categories that exist (records, phone, address,
  relatives, etc.) with **teased/masked snippets**, using the same masked-teaser mechanic we already
  run on the SUP (`SupTeaserA`), just pointed at the user themselves. Partial, not the full unmasked
  report.
- **An exposure/reputation score** — "your info appears in N records across M sources."
- **The "who's searching for you" hook** — on-brand for us (two-sided model), and the strongest
  return-trigger; real once BC ships the inbound-activity finder, partial from our own tracking in the
  interim (see `identity-management-wsfy-plan.md` §2c).

Why this is the right anchor:
- **Creates anxiety/engagement that drives TOWARD conversion** instead of satisfying the need (a free
  full report would satisfy it).
- **Doesn't spend our one conversion shot.** The paywall's pull stays intact.
- **Low COGS + already-public data** — it's teaser data we'd surface anyway, not a full report pull.
- **On-brand + defensible** ("see what's public about you") and the natural gateway to the paid
  Identity-management / monitoring upsell.

**What we are NOT doing here (deferred — see Lever D):** giving away a **full** self-report. That is a
separate, later, gated experiment (credit card on file + identity validation, segment-only), because we
often get **one crack at the conversion nut** and don't want to spend it for free by default. COGS is
minimal per pull, so cost isn't the blocker — conversion economics is.

### Lever B — Persisted, personal state worth returning to
Free users currently persist **nothing** server-side (Search History is localStorage-only, dies on
device change). Give free accounts durable, server-side:
- **Saved people / watchlist** (star a teaser → saved to their account).
- **Search history** synced server-side (cross-device).
- A **dashboard that reflects their own activity** instead of an empty marketing strip.
Even without unlocking reports, "the people I was looking into" is a real reason to log back in — and
each saved person is a primed upgrade target.

### Lever C — Real return-signals (WSFY / Alerts / monitoring)
The mock WSFY/Alerts produce no returnable signal. Make them yield a **real** one:
- **Ship-now:** Identity Exposure snapshot + re-scan (data we own; no BC).
- **Interim monitoring** (needs area iv backend): watch a saved person/identity → we re-run the
  search on a cadence, diff it, and **email on change** ("a new record was found"). This is the
  classic "come back" trigger and it runs on our own infra (see `identity-management-wsfy-plan.md`
  §3c). File the BC asks for the better server-side version in parallel.

### Lever D — Deferred: a full report as a gated experiment (NOT a default giveaway)
Two variants, both **deferred** and **gated**, because giving away a full report spends our one
conversion shot:
- **Full self-report, segment-only** — "see your own full report, with a **credit card on file** to
  validate your identity," offered to a **segment** of users, not all. CC-on-file is mandatory before
  any full report is given away (owner, 2026-07-11). This is the "see YOU" idea taken all the way, but
  as a controlled test.
- **Metered taste of *others'* reports** — e.g. one free full report/month or one section unlocked.
  Directly trades revenue; **A/B only**, watch conversion, never ship globally. Owner's
  conversion-vs-compliance caution (Bugs #34/#35) applies.

Lever A (partial self-reveal) delivers most of the engagement benefit **without** spending the
conversion shot, so it's the anchor; Lever D stays parked until we choose to test it on a segment.

## 3. The email lifecycle (this is what makes free work — depends on area iv)

Free retention is impossible without an owned email channel. The freemium plan is **gated on the
first-party email platform** (`docs/design/email-platform-current-state.md` / area iv). Minimum
lifecycle:
1. **Welcome / activation** — right after free signup: "See your own exposure report free" (Lever A).
2. **Abandoned-checkout** — the `checkout_abandoned` trigger is already wired in `PaymentPage.js`;
   it currently has no home. This is the highest-ROI email and the reason to build the platform.
3. **Saved-person nudge** — "You saved N people — unlock their full reports."
4. **Monitoring alert** — "New record found for a name you're watching" (Lever C).
5. **Win-back** — dormant free users, periodic "someone may be searching for you" (honest once WSFY
   is real; until then, "check your exposure").

## 4. Where the upgrade prompts live (convert without lying)
- The teaser paywall stays the primary conversion point (don't weaken it).
- Add **upgrade CTAs on the new free surfaces**: saved-person list, exposure snapshot ("manage/monitor
  ongoing = upgrade"), monitoring emails.
- Keep **honesty**: no fake urgency on the *member* side that contradicts the "nothing is fabricated"
  dashboard footer. (The freemium audit flagged WSFY's synthetic events contradict that footer —
  resolve by making WSFY real or clearly labeling it a preview.)

## 5. Sequence

1. **Lever A (partial self-reveal: exposure preview + score + WSFY hook)** — highest leverage, no BC
   blocker, reuses the existing teaser mechanic. No full report given, no CC required. Ship first.
2. **Lever B (server-side saved people / history)** — needs a small persistence layer (our server or
   BC `managedContact`-adjacent store); real return reason.
3. **Area iv email platform** — welcome + abandoned-checkout first (abandoned-checkout alone likely
   pays for the build).
4. **Lever C interim monitoring** — once the email/monitoring backend exists.
5. **Lever D (deferred)** — full self-report for a **segment** with **CC on file** + identity
   validation, or a metered taste of others' reports; A/B only, after the above. Parked by default.

## 6. Metrics to instrument (so we can tell if it's working)
- Free→paid conversion rate (baseline first — we may not have a clean number today).
- Free-account **return rate** (D1/D7/D30 logins) — the core freemium health metric, ~zero today.
- Abandoned-checkout email → recovered-conversion rate.
- Saved-person → report-unlock rate.
- Exposure-snapshot view → opt-out and → upgrade rates.

## 7. Risks
- **Cannibalization** (Lever D) — trades revenue; gate behind A/B. Lever A avoids it.
- **Owned-email deliverability/compliance** — SPF/DKIM/DMARC, CAN-SPAM unsubscribe (area iv covers).
- **Mock features eroding trust** — either make WSFY/Alerts real (interim) or label them clearly;
  don't let "coming soon" rot.
- **Splitting focus post-launch** — we just went live (BC prod 2026-06-23) and are conversion-focused;
  freemium retention pays off *after* volume flows through a converting funnel. Sequence accordingly
  (see the master plan).
