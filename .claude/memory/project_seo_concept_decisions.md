---
name: project_seo_concept_decisions
description: SEO concept model + the 7 locked owner decisions (2026-07-02) for the programmatic-SEO build
metadata: 
  node_type: memory
  type: project
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

Owner's strategy (ran it at MyLife/Spokeo): expose profile pages for all US people so Google
indexes them and they win long-tail "{first} {last} + {attribute}" searches (e.g. "David Wolfe
Napster Inc"). Concept model: base nodes = profile pages (exposed vs. obfuscated attributes),
strung into multiple directory dimensions (name, location, school, employer, …), pointing into
the signup funnel. Core framing the owner endorsed: **exposed attributes = search surface
(defines the winnable query universe); obfuscated = conversion tease** — an attribute only
ranks if it's visible text on the profile page.

**Decisions locked 2026-07-02** (full record in `docs/seo/implementation-plan.md` §0):
1. One profile page per BC record (entity resolution later); **mint our own stable public IDs**
   over BC record IDs — URL churn at scale is unrecoverable.
2. Mimic Spokeo's exposed/gated split initially, **including PII-in-JSON-LD by default**,
   contingent on pre-launch legal validation.
3. School/employer data exists in source; coverage unknown → probe BC early.
4. Launch dimensions = name + location; school/employer parallel-track, not a gate.
5. Staged rollout (high-demand segments first), not full-universe day one.
6. List pages are first-class ranking surfaces — location hubs get real content (news, stats,
   meetups, commerce; "Newton, MA" example). Differentiator vs. Spokeo's thin geo hubs.
7. Opt-out removes person from the ENTIRE directory surface; legal validation before launch.

Docs: `docs/seo/implementation-plan.md` (architecture: separate Next.js SSR+ISR app split
from the Parcel SPA by reverse proxy) + `docs/seo/competitive-teardown.md` (Spokeo fully
reverse-engineered, verbatim JSON-LD/FAQ evidence). No code yet; next = BC coverage probe
(name-aggregation, relatives-with-URLs, counts, school/employer) + Phase 0 proof-of-crawl.
Related: [[project_bc_integration_boundary]], [[feedback_expose_all_report_data]].
