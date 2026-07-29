---
name: project_honest_ps_challenger
description: /people-search honest PS challenger — built end-to-end, flag-gated, attributed; A/B for GENERAL PS (not V3 inmate)
metadata:
  type: project
---

**Honest people-search challenger, built end-to-end 2026-07-29.** A SEPARATE flow (not in-place edits to the live paid funnel — owner was nervous about that; V3 + all live flows stay untouched as control).

- **Route:** `/people-search` (`PeopleSearchHonestPage.js`, also `/name/landing/honest`). It's the **general-PS** challenger — owner chose (B) general, NOT V3's inmate traffic. So it's its own arm needing its own traffic, not a V3 split.
- **Hypothesis under test:** *being honest → better conversion + retention.* Owner wants to also test 1–2 OTHER approaches (see below).
- **Isolation:** everything flag-gated so V3 never moves. Landing hands off `/name/loader?flow=general&honest=1`. `honest=1` → loader shows HONEST_PHASES + sets `honestFunnel` sessionStorage → PaymentPage shows the transparent $1→$49.98 disclosure + the "claim & control your profile" identity moment. `flow=general` → SRP shows an honest no-match zero-state (never the fabricated thin-match cards) + real-signal-led teaser.
- **Steps:** 1 landing (honest copy, defensible trust: "real results — no fabricated matches" · "cancel anytime"; NO privacy claim per [[feedback_no_private_search_claim]]) · 2 loader · 3 teaser+honest zero-state · 4 transparent checkout · 5 identity moment.
- **Attribution:** `campaignRegistry` key `honest-ps:*` → partner=Direct, channel=Honest PS, landing→/people-search, zeroState=noRecords. Tag campaign URLs **`?shn=honest-ps`** → GTM `partnerChannel=Honest PS` + BC data.refer → cost-per-trial + trial→paid measurable by source. Placeholder token; swap for a minted BC shConId / per-source (Google/Meta) at launch.
- **Price untouched:** $1 trial → $49.98/mo (brand.js) — presented honestly, not changed.
- **To run:** upload build/ to BC (route live) → point general-PS spend at `?shn=honest-ps` → compare Honest-PS channel vs standard in GA4/BC.
- Files: PeopleSearchHonestPage.js · NameSearchLoaderPage.js (HONEST_PHASES) · SearchResultsPage.js (flow=general zero-state) · PaymentPage.js (honestFunnel) · campaignRegistry.js · funnelSplit.js (control routing unchanged). Audit that drove it: docs/marketing/ps-bc-funnel-audit-2026-07-29.md.
