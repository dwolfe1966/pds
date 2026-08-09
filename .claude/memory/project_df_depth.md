---
name: project_df_depth
description: Digital Footprint depth — foundational-tier tracking + honest partner-track reframe (2026-08-09)
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Two DF "depth" slices on 2026-08-09 (consumer + minor seo):

**Foundational sources — completed set + trackable.** Was 2 providers (LexisNexis, TransUnion), fire-and-forget links. Now 6: all THREE credit bureaus (TransUnion/Equifax/Experian — a freeze only works at all three, so a partial set was an honesty/correctness bug), LexisNexis, The Work Number (employment/income freeze), ChexSystems (banking). Each lever has a stable `id`; completion is TRACKED as an Exposure Graph node with `surfaceType:'foundational'`, `sourceKey='${provider}:${action}'`, `control_status:'done'`, `controlMethod:'self_reported'` (we can't verify a freeze on the provider's own site — the member self-marks). Progress header "N of M protections in place" + bar. `FOUNDATIONAL_FREEZE_NOTE` leads with the all-three-bureaus rule.
  - GOTCHA fixed: `summarizeNodes` (seo/lib/exposure-graph-db.mjs) now `continue`s on surface_type='foundational' so these self-report nodes don't inflate the Exposed/found counts. Composite sourceKeys ('lexisnexis:freeze') don't collide with registry slugs ('lexisnexis'), so they stay out of `items`/`tracked`/categories.

**Partner track (Rung 5) — honest reframe.** The referral endpoint only STORES interest; there are NO vetted partners yet (owner-gated: partners + revenue terms + legal review). The modal was over-promising "a vetted attorney will reach out." Reframed to two halves: (1) "Start now — free" real official self-serve steps per track (USA.gov expungement, lawhelp.org, annualcreditreport.com, CFPB, IdentityTheft.gov, Google removal), and (2) an honest waitlist — "we'll match you as our vetted network launches," success state "You're on the list" (not "will reach out now"). Added 2 tracks: `identity_theft`, `defamation` (also added to the backend TRACKS allowlist in partner-referral-db.mjs). 🚩 Flagged to owner as a transparency-vs-conversion change (softer CTA). See [[project_identity_management]], [[project_monitoring_loop]], [[feedback_honest_approach_flag]].
