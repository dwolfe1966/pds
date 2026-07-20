---
name: project_seo_recovery
description: SEO is floundering — recovery brainstorm; pivot from generic people-directory pages to first-party data verticals + authority
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Owner 2026-07-20: SEO "floundering," wants to recover + grow organic traffic. Brainstorm in `docs/seo/seo-recovery-brainstorm.md`.

**Diagnosis:** the SEO app (idlookup.me, Next.js+Neon) is 100% GENERIC people-directory pages (`/people/[state]/[city]/[name]/[id]` + a duplicate `/profiles/...` tree) — the most saturated, thinnest, least-differentiated content in the space. New domain = ~0 authority; can't out-rank Spokeo/TruePeopleSearch on their own page type. 360k thin pages → the 7/13 helpful-content impressions collapse ([[project_seo_indexing_incident]]). Meanwhile the first-party data moat (`lib/`: incarceration, sexOffender, life-events, person-search) powers NO SEO page.

**Thesis:** recovery on a new domain = FEWER, DIFFERENTIATED pages + AUTHORITY, not more pages.

**Recommended hybrid (works regardless of pivot-vs-fix appetite — owner didn't answer that yet):**
- **A. Stop the bleed:** prune/noindex the thin long-tail; collapse the duplicate /people vs /profiles trees (301 one); evaluate domain consolidation (idlookup.me vs idlookup.ai/people path-split).
- **B. Differentiate survivors with first-party data:** augment pages with our records; **lead vertical = INMATE** (facility rosters, "inmates named X in [state]", DOC hubs) — unique data + proven 7.15%-CVR intent + pipelines already exist (`stateInmates.mjs`, `inmatesDb`), just not rendering pages. NOT Turnstile-gated (unlike BC teaser) → renderable server-side.
- **C. Build authority (the real bottleneck):** editorial how-to content ("how to find an inmate in [state]", "remove your info from data brokers") — earns links, lower competition, funnels to tools.
- **STOP:** expanding generic name×state pages.

**Owner selected goal:** "Recover + grow organic traffic." **Open:** appetite (pivot to verticals vs fix+differentiate current). Suggested first step = pruning + a small inmate/facility pilot from existing stateInmates data + 2-3 cornerstone how-to articles; measure 4-6 wks.

Death-teaser aside (answered 2026-07-20): BC teaser search returns NO deceased flag (counts+booleans only, no death). Cheap unlock = BC ask to add `deathCount`/`isDeceased` to the teaser identity (they already project criminalCount etc.) — try before licensing ObituaryMonitor. See [[project_signals_augmentation]] + `docs/research/death-data-recon.md`.
