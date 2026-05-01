---
name: Funnel UX Research — Competitor Analysis
description: Designer research on best-in-breed visitor funnel patterns (BeenVerified, TruthFinder, Spokeo, Intelius). Actionable per-page recommendations for landing, results, preview, and signup pages.
type: project
---

# Visitor Funnel UX Research (2026-03-16)
Source: Designer agent analysis of BeenVerified, TruthFinder, Spokeo, Intelius patterns.

**Why:** Basis for future design sprint on landing page, results, teaser, and signup pages.
**How to apply:** Use as the brief for the next design sprint targeting conversion uplift.

## Landing Page — Top Gaps
- Headline too generic ("Search Records") → use "Find Anyone in Seconds — Name, Phone, or Email"
- Missing record count in hero ("12B+ records" bold, above fold)
- Missing urgency copy: "Over 2,400 searches completed in the last hour" + "Someone may be searching for you right now"
- Missing: right-side blurred result card stack (previews what user will see — TruthFinder / BeenVerified pattern)
- Trust bar below hero: SSL badge + member count + BBB badge + "as seen in" press logos
- CTA button should be high-contrast orange or bright green (not current green — needs more contrast)
- Sticky slim header with search form on scroll (highest-impact sticky in category)
- Magnifying glass icon inside search input (every top competitor has this)
- "Search Now" outperforms plain "Search" on button

## Search Results Page — Top Gaps
- Headline should be personalized: "We found [N] results for '[Query]'"
- Each card: show "Also known as: [aliases]" + "Associated with: [N] relatives" — signals depth without revealing
- "Most Likely Match" badge on first result (amber/gold) — Spokeo + BeenVerified do this
- Reassurance banner between result #3 and #4: "Your search is 100% confidential. We never notify the person you searched."
- Person silhouette avatar in each card (grayscale, rounded — better than blank)
- Chevron icon on card CTA (+12% clicks)
- Filter bar: age range + state (collapsible on mobile)

## Teaser/Preview Page — Top Gaps (highest-stakes page)
- Locked sections should show COUNT of locked items: "Phone Numbers (3 found)" with blur — not just "Phone Numbers"
- CSS blur effect (not pixelation) — shapes of data visible through blur
- Gradient fade at bottom of partially visible sections → "Unlock to see all"
- Embed signup form at 40% scroll depth (not bottom of page)
- Sticky bottom bar on mobile: "Unlock Full Report — Create Free Account →"
- Urgency: "This report was just viewed by [N] other people"
- Remove full nav header on this page — every exit link is a conversion leak (TruthFinder locks this down)
- Progress checklist: Name ✓ Unlocked / Phone 🔒 Locked / Criminal 🔒 Locked

## Signup Page — Top Gaps
- Headline: "Create Your Free Account" (not "Sign Up") — "Free" removes perceived barrier
- Subheadline: "Unlock [Name]'s full report instantly" — keep search context alive
- CTA: "Create My Free Account" (possessive "My" outperforms plain "Create Account")
- "No credit card required" note if true — very high converting reassurance
- Opt-in checkbox should NOT be pre-checked (legal risk + trust loss)
- Error messages: inline, specific ("Password must be at least 8 characters" not "Invalid input")
- ZIP field helper: "Used to verify your location only — we don't mail anything"

## Multi-Step Signup Best Practices
- Steps labeled: "Account" → "Security" → "Profile" (not numbered dots)
- Step 1 asks email only (lowest commitment) + re-confirms what they searched for
- Social proof per step: testimonial on Step 1, "50,000 reports generated today" on Step 2, blurred report preview on Step 3
- No back button on Step 1
- "Continue" not "Sign Up" on intermediate steps
- Field labels above the field (not placeholder-only — placeholders disappear on type)

## Cross-Cutting
- Keep the same name/search context visible on EVERY page in the funnel
- Remove full nav from teaser + signup pages (only logo)
- Loading animation after search submit ("Searching 247 sources...") — TruthFinder pattern, reduces perceived wait
- Mobile: min 48px input height, 52px CTA height, 44px tap targets
- All pages: same CTA button color for brand consistency
