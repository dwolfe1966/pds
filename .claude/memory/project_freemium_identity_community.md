---
name: project_freemium_identity_community
description: North-star strategic pivot — transactional people-search → freemium identity community (see-others-by-exposure + manage-your-own-profile-anywhere)
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

**Strategic direction (owner 2026-07-16).** Transition the product model FROM "I am searching for a
report" (transactional people-search) TO "I am part of a **freemium community**" where a member can:
1. **See detailed profiles of anyone** — gated by **what that person exposes** (reciprocal-exposure,
   social-network-style visibility, not a flat paywall).
2. **Manage their own profile + who sees what** — their identity as the product.
3. **Anywhere, not just idlookup.ai** — control exposure across the whole web (brokers, social,
   Google), not only our own DB.

This is a NORTH STAR / business-model reframe, not a single feature. Not yet scoped into phases.

## Three pillars (and what already steps toward each)
1. **See others (consumption).** Freemium profile viewing gated by the subject's exposure settings.
   Builds on the modular Others-Profile + two-fidelity modules ([[project_modular_profile]]) and the
   crawlable public profiles ([[project_seo_individual_profiles]]). Shift from paid-report-unlock →
   freemium tiers (free sees limited, more if you participate/pay).
2. **Manage self (control).** Profile-as-product: Protect/Promote, who-sees-what, "manage don't
   delete," Transparency + Control pillars — [[project_modular_profile]], [[project_identity_management]]
   (3-state my-identity, exposure score, per-item suppression enforced in WSFY).
3. **Anywhere (cross-platform).** Manage exposure across data brokers / social / Google, not just our
   record — monitoring + opt-out orchestration. This is a NEW capability class (competes with
   DeleteMe / Kanary); largely unbuilt. WSFY ([[project_wsfy_self_build]]) is the "who's looking"
   social signal that makes managing exposure feel urgent.

Unifying frame for the lifecycle work in [[project_growth_plan_2026_07_11]].

## The hard questions (resolve before committing to a roadmap)
- **THE CRUX — the two-class data problem.** Our DB is ~hundreds of millions of **broker/IDI-sourced
  records of people who never joined**. "See anyone depending on what they expose" only has meaning
  for the thin layer of *members* who set exposure. Non-members have no settings → their data is
  default-exposed (broker-sourced) unless they opt out. So the "community" is a small member layer
  over a large **non-consenting base**. How reciprocity + defaults + opt-out work for non-members is
  THE central design (and ethical/legal) question. Ties to [[project_seo_idi_display_license]] +
  opt-out.
- **Business model shift.** Transactional/trial-report revenue → freemium subscription. Conversion
  mechanics, tiering, and report-pull COGS economics all change (report COGS is an open question in
  [[project_growth_plan_2026_07_11]]).
- **Reciprocity mechanic.** "Expose to see" (LinkedIn-style: you see more if you have a profile) vs
  pure paywall — what unlocks what, and does exposing your own data grant you more visibility of
  others?
- **Cross-platform is a whole product.** Broker opt-out orchestration + web monitoring = per-broker
  integrations + operational cost. Build vs partner (white-label a DeleteMe-style engine?).
- **Legal / FCRA / privacy surface.** A freemium "see anyone" community + cross-platform management
  materially expands the regulatory surface vs a one-off report. Needs counsel before scale.

## Status
North star. Capture only — no build scoped yet. Owner to decide whether to formalize a phased
roadmap. Revisit the current threads (modular profile, identity mgmt, WSFY, SEO Others-Profiles)
through this lens — they're the first steps of it.
