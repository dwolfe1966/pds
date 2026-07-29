# Honest Funnel — Build Spec (Name Search)

The buildable spec behind the *Honest* side of the two-ways prototype. Every persuasion mechanic that actually converts (confirm-identity, momentum loader, real teaser, trust signals) — with none of the deception that draws the FTC. **Trust is the differentiator, not a tax on conversion.**

**Companion artifacts:** the competitor teardown + the honest/dark interactive funnel (both published). **Companion docs:** `competitive-analysis-people-search-2026-07-28.md`.

---

## Non-negotiable guarantees (the anti-dark-pattern contract)

These are the promises the whole funnel is built to keep — and the marketing wedge:
1. **Price shown before you search** — never hidden until sunk-cost.
2. **The loader shows real progress on real data** — no fabricated delay, no fake "scanning millions."
3. **The teaser matches the delivery** — we show real first-party findings; the full report contains exactly what the teaser promised, nothing hyped or hidden.
4. **Never imply a record that isn't there** — no "[Name] may have arrests," no fabricated case numbers. First-party data independence ([[feedback_first_party_data_independence]]).
5. **No trial trap** — a one-time report option exists; any subscription emails before every charge and cancels in one click ([[feedback_subscription_state_authority]], BC billing = source of truth).
6. **Real suppression** — "Hide" actually removes the item for everyone (member_suppression enforced in WSFY), not a fake "Remove" ([[project_identity_control_owner_voice]]).
7. **FCRA notice in the flow**, near the decision — not buried in the footer.

---

## Step-by-step

### 1 · Entry / landing
- **Headline:** "Find the facts about someone — from records you can trust."
- **Subhead:** "Contact info, addresses, and public records — sourced and current."
- **Search box:** Name (+ optional city/state). Tabs: Name · Phone · Email · Address.
- **Price bar (above the fold):** "Full report **$4.99**, or unlimited **$19/mo** — cancel in one click, we email before every charge."
- **Trust row:** honest first-party signal ("real results — no fabricated matches"), "cancel anytime — no surprise subscriptions," security badge. **⚠️ NEVER claim searches are private/confidential/"they're never notified" — WSFY (Who's-Searching-For-You) surfaces searchers TO the subject; the claim contradicts our own product.**
- **Events:** `landing_view {search_type, variant}`, `search_submit`.
- **vs dark:** no fear headline, no pulsing "act now" CTA, price present.

### 2 · Confirm identity
- **Copy:** "We found 3 people named John Smith. Which one?"
- **Rows:** real disambiguators — age, city, relatives — so they pick the *right* person (also raises match confidence + commitment).
- **Events:** `refine_view {match_count}`, `identity_confirmed {index}`.
- **vs dark:** rows are neutral. No "Records? ⚠" guilt-tagging before any data exists (the FTC-sanctioned move).

### 3 · The momentum loader (the real data-pull sequence)
The loader is honest *because* it narrates the actual backend calls, with real counts, and finishes when they finish (~1–2s), not on a timer.

| Order | Real source / call | On-screen line | Typical result |
|---|---|---|---|
| 1 | Address history (Enformion / IDI) | "Address history" | "5 cities" |
| 2 | Phone & email (enrichment) | "Phone & email" | "3 found" |
| 3 | **Booking records — FIRST-PARTY** (`rosterByNameState`, our inmate DB) | "Booking records" | "2 on file" |
| 4 | Marriage & divorce (`findLifeEvents`) | "Marriage & divorce" | "1 record" |

- Each line checks off with its **actual** count as the call returns; a thin/empty result shows "none found" honestly (never faked to "records found").
- Progress bar reflects calls completed / total, not a fixed animation. Copy: "Done in 1.3s · real sources, no waiting theater."
- **Events:** `loader_start`, `loader_source_done {source, count}`, `search_complete {total_records, ms}`.
- **vs dark:** no "graphic content" pop-ups (up to 5 in Instant Checkmate), no scrolling faces, no fake 15-min crawl.

### 4 · The teaser
- **Header:** real name + age + city + "last updated this week."
- **Findings list (real, first-party-forward):**
  - "**2 booking records** found — Harris County (from our own data)" ← the moat, lead with it
  - "5 known addresses across TX & LA"
  - "3 phone numbers · 2 emails"
  - "Marriage record · possible relatives"
- **Footer line:** "Here's exactly what's in the full report — nothing hidden or hyped."
- **Events:** `teaser_view {has_booking, record_count}`, `unlock_click`.
- **vs dark:** we don't blur *everything* behind "ARREST/CRIMINAL/case#" labels implying records that may not exist. We show what's real and gate the rest honestly.

### 5 · The paywall / checkout
- **Primary:** "John D. Smith — full report — **$4.99**." One charge, no subscription.
- **Optional:** "Prefer unlimited? **$19/mo**" — clearly optional, no pre-check.
- **Terms (plain, in-view):** "One charge of **$4.99**. No subscription, no auto-renew. If you choose monthly, we **email before every charge** and you cancel in one click."
- **Reassurance:** "Secure checkout · cancel anytime." (Do NOT use "you're never shown to the person you searched" — contradicts WSFY.)
- **FCRA:** short, near the CTA — "Not a consumer reporting agency; don't use for employment, tenant, or credit decisions."
- **Events:** `checkout_view {plan}`, `purchase {plan, amount}`.
- **vs dark:** no "$1" anchor hiding $34.99/mo, no fake countdown, **no pre-checked add-ons**, no cancel-by-phone.

---

## Price tests to run (the honest levers)
Instrument these as clean A/Bs — the honest model still has real conversion knobs:
1. **One-time price:** $4.99 vs $6.99 vs $2.99 (does a lower single-report price lift first purchase + downstream sub?).
2. **Anchor order:** lead with one-time ($4.99) vs lead with monthly ($19/mo) — which frames better.
3. **Monthly price:** $19 vs $24 vs $29 (we're *under* the competitor $25–36 band — test how far).
4. **Trial vs no-trial:** an honest "$1 first report, then nothing unless you choose monthly" vs straight $4.99 — test whether an honest low-anchor lifts conversion *without* the auto-renew trap.
5. **Booking-lead teaser:** teaser that leads with our first-party booking records vs generic address/contact — does the moat data convert better?

## Metrics that matter
`search_submit → identity_confirmed → search_complete → teaser_view → unlock_click → purchase`. Watch: teaser→unlock rate (is real data as compelling as blurred fear?), one-time→monthly upgrade rate, and **refund/chargeback + cancel rate** (our honest model should crush the category here — that delta is the marketable proof).

---

## The two funnels
- **Honest (this spec)** — the real build. Ship it, A/B the price levers above.
- **Dark** — the illustrative anti-pattern in the two-ways prototype for team education + the competitive story. **Not a build target** (it's the exact conduct that cost TruthFinder + Instant Checkmate $5.8M to the FTC and earned PeopleFinders a BBB "F"). If we ever want to test *aggression*, do it inside the honest guardrails (stronger copy, urgency that's true), never with fabricated records or hidden auto-renew.
