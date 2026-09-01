---
name: feedback_presentation_hub
description: Package presentation info as linked single-page web presentations (artifacts) under one master hub
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a30cdc08-f0c0-401c-a086-f4170eba2f74
---

Owner wants **all presentation information accessible as single-page web-page presentations (Artifacts)** — not just docs. Maintain a **master hub page** with a summary + links to every detailed presentation.

**Why:** the owner presents from these (team + CEO reviews); a single navigable hub + per-topic pages is how they want to consume/share strategy.
**How to apply:**
- Master growth hub artifact = `scratchpad/op-master.html` → https://claude.ai/code/artifact/97714d84-02c6-4463-929e-92168f48b6a5 (summary + status + nav cards linking each detail page). Republish the same file path to keep the URL stable; add new roadmap pages to it.
- Detail pages (each its own artifact): Paid `op-paid.html` (69ca95ae), Paid-migration `op-paid-migration.html` (d6fe65ad), Affiliate `op-affiliate.html` (91e1ed7f), SEO-90day `op-seo.html` (aca70bab), Team-review+SEO-architecture `op-roadmap-review.html` (9a6bccd0), Gantt timelines `op-gantt.html` (7b8959f5), RACI owners `op-raci.html` (32443fc4), Rollup `op-rollup.html` (947f51f9).
- Gantt uses weeks-from-kickoff (relative) axis + ◆ milestones; RACI is its owner appendix (roles not names, per redaction) — keep the plain Gantt owner-free (owner said so).
- New substantive strategy/analysis → also make a single-page presentation + link it from the master.
- ⚠️ Artifacts are PRIVATE by default — for team viewing the owner must share each linked page, not just the master. Remind when relevant.
- Apply the redaction rules ([[feedback_deliverable_redaction]]) + no absolute dates on roadmaps to every presentation. Repo `docs/growth/*.md` stays the text source-of-truth behind the presentations.
