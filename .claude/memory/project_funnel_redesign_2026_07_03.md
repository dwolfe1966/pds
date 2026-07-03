---
name: project_funnel_redesign_2026_07_03
description: "Consumer funnel marketing/design redesign (2026-07-03) — what shipped, what's pending"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

Owner-driven marketing/design pass over the whole consumer signup funnel, 2026-07-03.
Applies [[feedback_funnel_design_principles]] (sell benefits, serve the info-need, consumer
not SaaS, clean IA) + the peoplefinders/Spokeo teardown patterns. All committed to `main`,
**NOT deployed** (owner uploads build/). Not verified against live BC (dev captcha blocks
teaser searches; screenshots done via mock sessionStorage seeding + serve-prod).

**Shipped this session:**
- **Inmate landings** v3 + v3a(blue)/v3b(dark): decluttered (dropped eyebrow/step-1 progress/
  bullets), soft-green brand band '{brand} — Find Anyone, Anytime', benefit bullets + "What
  you'll find" row (v3), "Inmate First/Last Name" labels + e.g. placeholders.
- **New home** at `/home` (HomeV2Page) — search-first, benefit-led, replaces the SaaS "Why
  Choose Us" grid + "create account" CTA. **A/B: `/` (old) still live, `/home` is the new one.**
- **Sales SRP** (SearchResultsPage): AKAs on rows + age fix (adapter read wrong field —
  now ageRange||dobList[0].age); title/subtitle cleanup; "100% secure" banner; "View
  Details" CTA; mobile (hide sort, tighter header).
- **Default SUP = variant A** (NOT variant '1'; IDL-Default + Google partners use detail
  .variant 'a'). Redesigned: vCard-first w/ obfuscated contact rows (MASKED not fabricated —
  real city/state + ••• for street/phone/email we don't have at teaser), compressed category
  cards, light-green form, inline italic field notes, "Get Instant Information on {name}"
  hook, trial+satisfaction bullets. **Shared component `SupTeaserA.js` + 3 palettes
  (GREEN/BLUE/DARK); A/I/J are thin wrappers** — i/j = same design, blue/dark palette.
- **Payment design pass**: person vCard full-width on top; "Secure Checkout"; ZIP inline
  below CVV (no billing dropdown/street); terms de-bolded except cancellation line; minimal
  SUP header (member nav suppressed on /payment via Header.js).

**PENDING / next:**
1. **Deploy** — all uncommitted-to-VPS. Consumer bundle carries everything.
2. **Alternate SUPs** b/c/d/g/k — still old designs; owner may want converted (lower traffic).
3. **#2 payment retry bug** (half-fixed): needs owner CSR lookup of `davidtest-7-2@bytecrtrs.com`
   (exists? plan?) to confirm "failed sale creates user → nonMemberOnly rejects retry" →
   final fix = retry via login+upgrade not fresh nonMember sale. See [[project_conversion_tracking_live]].
4. **Live teaser payload** (owner grabs from DevTools) unlocks: real obfuscated contact data
   + real per-category counts on SUP/SRP, confirms address-history depth + relatives (currently
   masked/omitted; teaser doesn't return them → BC ask candidate).
