---
name: feedback_funnel_design_principles
description: "Owner's design principles for the signup funnel (landing/results/SUP/payment) — benefit-led, low-friction, consumer-esque"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

Owner's high-level principles for the sales funnel pages (landing `/name/landing/v3`,
search results, SUP `/search/:id`, payment), set 2026-07-03. Apply these to every
funnel change.

1. **We are SELLING on these pages.** Most visitors come with a SPECIFIC INFORMATION
   NEED (find a person / a fact), NOT because they want to sign up for a paid service.
   Design for the need, convert off it.
2. **Communicate in BENEFITS, not features/actions.** "Find out more about your long-lost
   high-school girlfriend" — NOT "create an account." Sell the outcome, never the mechanism.
3. **Be CONSUMER-esque, not SaaS/corporate-sterile.** Warm, human, curiosity-driven — not
   enterprise-clean-and-cold.
4. **Keep the information architecture CLEAN.** One clear action per screen; strip noise
   ("too much space," "busy," "feels like work," "4 things pop" are all rejections).

**Reference model — peoplefinders.com** (owner cited as the pattern to emulate):
- Take the user STRAIGHT into search results; no onboarding until they click a result.
- Onboarding is a **"build → verify → confirm"** staged flow AFTER result-click.
- Detailed teardown lives in `docs/seo/` or a funnel doc once the exploration agent reports.

**Why:** conversion comes from serving the information need first, then converting the
committed user; front-loading account/commitment friction (password, corporate framing,
busy pages) kills the top of the funnel.

**How to apply:** for each funnel change, ask "does this serve the information need and
sell the benefit, or does it ask for commitment too early / add noise?" Related:
[[project_funnel_ux_research]], [[project_ab_test_theme_wiring]], [[feedback_narrow_paywall]].
