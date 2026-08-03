---
name: project_org_dynamic_nic_team
description: "Org/political dynamic — David = CEO of new co; Jerome & Kwan (old-co CEO/CTO) undercut him as \"marketer/FED\"; Tim conflicted; artifacts must be immaculate"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Political dynamic behind the HomeFacts/NIC push and cross-team work (owner shared 2026-08-01):

- **Tim Chin** (investor, former NIC CEO) made **David (owner) CEO of the new company** (People Data Systems / IDLookup), with **Jerome (former CEO of the old company)** and **Kwan (former CTO of the old company, = "BC"/backend)** as team members. Status inversion → friction.
- **Functional domains:** **Kwan = engineering (CTO)** — the core backend/platform. **Jerome = operations, business intelligence, finance & strategy** (NOT engineering). Route pilot/deal questions accordingly: engineering-lift → Kwan; conversion attribution, revenue-share accounting, deal economics → Jerome. David = CEO across BOTH platforms; he built the Growth platform end-to-end AND the application layer on top of Core — do NOT frame him as "Growth only" or cede the whole Core to the team (invites Tim to box him as "the Growth guy").
- **Jerome & Kwan want to frame David as a "marketer / front-end developer"** — but never say it in front of Tim. They criticize his "sloppiness / inattention to detail." David's read: that's really a **difference in what counts as "good enough" and effort/outcome ratios** (David = ship-fast pragmatic MVP; they = craft/rigor/polish).
- **Tatiana** (team member) was the most vocal that HomeFacts is "just a test" for us — a core-only/maintain-the-legacy mindset. David's counter: the legacy business the core reflects has been in **slow decline**, so a growth mindset (both core + growth platforms) isn't optional.
- **Tim says he supports David but is conflicted** — values the old team's rigor AND David's velocity.
- The original frontend/backend split (David does FE with AI, Kwan builds backend) came from **Kwan convincing Tim that AI wasn't ready** (~company founding). David wanted to build entirely with AI agents.
- **BC is being positioned (by Jerome/Kwan) as an independent, general-purpose platform** that could support apps beyond IDLookup.ai + other data-broker businesses. Kwan is building **general platform primitives, less concerned with growth / IDL-specific use cases**. David's strongest, cleanest argument for building IDL's growth stack with agents = **mission/incentive misalignment**, not personal conflict: a general-platform roadmap by design won't prioritize IDL's growth velocity, so coupling IDL's growth to BC is an org/architecture mistake — decoupling helps BOTH (platform isn't bottlenecked by one app; IDL isn't gated by platform-generality work). Their position also contains a usable tension: **can't be both "independent general platform" AND "David must build only FE on our platform"** — if BC is independent, IDL is a *customer*, and a customer's CEO builds the customer's differentiated product. Line to hold: **decouple, not divorce** — IDL still uses BC for shared transactional primitives (auth/billing/idLookup); IDL builds its growth/vertical/acquisition layer independently. HomeFacts (needed ~0 BC work) = Exhibit A of the pattern.

**How to apply (working guidelines):**
- **Anything that represents David to Tim (or customers) must be immaculate** — a sloppy artifact literally proves the critics' point. Precision IS the rebuttal. I (Claude) should QA/proofread before anything ships to Tim; deny them "sloppy" examples. See [[feedback_bc_same_company_language]].
- **Lead with "not just front-end" evidence** — working software + hard backend artifacts (24-table Postgres, crawlers, budget ledgers, cron) that a marketer/FED could not produce. Build inventory artifact does this (idlookup.me: 284 solo commits/30 days, 28 backend services, 38 pipelines).
- **Move the scoreboard to outcomes + velocity** (David's turf), not craft-detail (their turf, subjective).
- **Don't attack Jerome/Kwan** — cool, precise, evidence-forward; put unspinnable working software in front of Tim (they undercut privately, so substance in front of Tim is the asymmetric win). Turn Kwan into a **witness** ("this needs little backend work"), not a gatekeeper. See [[project_bc_org_relationship]], [[feedback_innovate_dont_wait_for_bc]].
