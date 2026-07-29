# PS / BC Paid-Funnel Audit — Punch List (2026-07-29)

Stage-by-stage audit of the People-Search + Background-Check paid funnels, ranked by paid-traffic ROI (trial starts + trial→paid *quality*), judged against the competitive teardown + honest-funnel spec. Read-only findings; no changes applied yet.

## Meta-finding (reframes everything)
**100% of paid search lands on `NameSearchLandingV3Page` (inmate), not the honest page** (`funnelSplit.js:62-72`, owner 2026-07-25). The honest treatments we built **already exist but are gated behind flags V3 never sets** — so they're **dark for paid traffic**:
- Honest loader copy → gated on `?honest=1`
- Prominent recurring-price restatement → gated on `honestFunnel` sessionStorage
- Post-purchase "claim & control your profile" identity moment → same gate

⇒ Three high-value fixes are just **"port the display-only honest treatment onto the V3 paid path"** — all S-effort, all zero-risk to the fragile search/contextKey core.

## ⚠️ Two compliance landmines (FTC $5.8M pattern; violate our own "never fabricate" rule)
- **[BLOCKER] Fabricated thin-match cards** (`previewCards.js:84-128`, `ThinMatchPreview.js`): on a zero/thin result, we render cards using the **real searched name** but **invented** relatives ("Mary Johnson"), ages, cities, phone/email counts, and a blurred fake number — under **"We found people named [Real Name] in [State]."** This is the *default* zero-state on live paid inmate + homefacts campaigns. Fabricating relatives/attributes is exactly what our first-party-independence rule forbids. **Fix: honest "no confirmed match" copy or unmistakably-generic samples. Needs legal pass.**
- **[FLAG — owner-approved copy] Sex-offender "possible record" assertion** (`personSignals.js:35,117`, `SignalTeaser.js`): for `/records/sex-offender`, the teaser shows **"⚠️ Possible offender record for [Real Name] — unlock to verify"** for *any* named person with zero underlying data (SO records are post-pay). Auditor flags this as the verbatim TruthFinder/Instant-Checkmate "[Name] may have arrests" pattern. **NOTE: this is owner-approved copy (2026-07-23, "framed to verify NOT assert").** Decision needed: keep as-is, or soften to pure capability ("Check [Name] against sex-offender & criminal records"). (Stale code comment claims it "ships dark" — it's live.)

## Top 10 (paid-ROI ranked)
1. **Remove the two fake 5s "Searching…" interstitials** on V3 + VerticalIntentLanding (`NameSearchLandingV3Page.js:120-129`) — 10s fabricated dead-air on 100% of paid; FTC fake-loader pattern; real loading already happens honestly at `/name/loader`. **S**
2. **Fix fabricated thin-match cards** (blocker above). **M · legal**
3. **Stop asserting SO "possible record" with no data** (flag above). **S · legal/owner**
4. **Surface the recurring $49.98/mo honestly on the paid paywall** — ungate the plain-price restatement (`PaymentPage.js:1318-1327`); today paid gets the *least* transparent paywall. **S · compliance**
5. **Route the paid loader through `HONEST_PHASES`** (kill "247 million records" theater; honest copy already exists). **S**
6. **Port trust stack + subhead into the V3 hero** (`NameSearchLandingV3Page.js:196-200` is a bare H1) — first-party count, private-search, security badge. **S-M**
7. **Lead with the booking moat earlier** in the V3 funnel (currently buried 3 steps + 10 fake seconds deep). **M**
8. **Show the "claim & control your profile" identity moment to all buyers** (currently dark to paid). **S**
9. **Fix the inflated/inconsistent "12B+ records" count** (`ZeroResultsPanel.js:85`) → one honest first-party number. **S**
10. **Add a self-serve / one-click cancel path referenced at checkout** (currently "call us") — click-to-cancel compliance + our honest-cancel wedge. **M-L**

## Good as-is (keep)
Real `api.searchPeople` loader with genuine progress + error-carries-subject; has-results SERP leads with real booking records ("data sourced from publicly available records"); FCRA consent in-flow at confirm; thorough payment error/decline classification; solid post-purchase success screen.

## Needs a live human pass (no browser egress here)
Mobile rendering (V3 wizard, SRP, PaymentPage mobile CTA bar); whether homefacts/SO paid traffic is currently flowing; **legal review of #2, #3, and the $1→$49.98 negative-option disclosure/cancel structure.**

## Price-model note
Honest-spec assumes $4.99 one-time / $19 mo; live is **$1 → $49.98/mo auto-renew, no one-time SKU** (`brand.js:40-42`) — which *is* the trial-trap structure. Not changing price (per instruction), but this makes #4 (disclosure) and #10 (cancel) **compliance-critical, not polish.**
