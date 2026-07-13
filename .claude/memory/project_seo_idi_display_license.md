---
name: project_seo_idi_display_license
description: IDI/BC data IS licensed for public display + search-engine indexing (with opt-out) — SEO data layer is BC/IDI
metadata: 
  node_type: memory
  type: project
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

**Owner confirmed 2026-07-04 (as a known fact): we have LICENSED IDI's data for
PUBLIC DISPLAY and SEARCH-ENGINE INDEXING** of certain classes of **public
records** per profile, with **user opt-out from the index**. This resolves the
launch-gating compliance question for the [[project_seo_concept_decisions]] play.

**⚠️ 2026-07-08 research flag — VERIFY the written grant before building on this.**
Deep research (docs/research/idi-data-access.md) confirmed that IDI's *standard*
Subscriber T&C (Aug 2024) PROHIBIT public display, indexing, resale, and bulk automated
use on **4 independent clauses** — the exact opposite of the grant above. So the
owner's "licensed for public display" can only be a **bespoke custom Subscriber
Agreement** that overrides the standard terms. **Get the exact written display /
indexing / redistribution clause in hand and confirm its scope** (which record classes?
indexing? bulk ingestion?) — it may be narrower than assumed. If no such written grant
exists, a public IDI-based directory is **blocked** (breaches ≥4 clauses; upstream data
suppliers are named third-party beneficiaries who can enforce directly) and the SEO
layer must use **self-compiled public records / a display-licensed feed / Enformion**
instead. idiCORE stays fine for the **gated, paid, logged-in report** flow.

**Implication:** BC/IDI IS the public-display data source for the SEO profile
pages — we do NOT need a separately display-licensed provider (Enformion/Endato)
for the shown attributes. Full report stays gated behind the paywall (its normal
use). Opt-out already = concept decision #7 (removes profile + listings + sitemaps).

**Correction this overrides:** research flagged that LexisNexis Accurint /
TransUnion TLOxp (MyLife's old tools) are FCRA/GLBA/DPPA-gated and forbid public
display/enumeration — TRUE, but irrelevant to us because our IDI license already
permits display. Modern people-search display layer = self-serve identity APIs
(Enformion/Endato); we only need those (or voter files) for the ENUMERATION gap,
not for display rights.

**The one data problem left:** BC/IDI can't ENUMERATE (no bulk list) and refuses
common names (`TooManyMatches`, see [[reference_bc_teaser_response_shape]]). So the
only remaining data question is a supplemental ENUMERATION source for common-name
head terms — deferrable past the "prove indexing works" phase. Skeleton (Census
surnames × SSA first names × gazetteer) is public-domain, unaffected. Full research:
docs/seo/us-name-directory-research.md.
