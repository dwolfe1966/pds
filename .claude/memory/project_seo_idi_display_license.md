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

**✅ 2026-07-17 owner RESOLVED the conflict: IDI DOES offer a data class licensed for SEO/public
display** — the owner has seen the documentation. It's a **paid tier: ~$6,000/month, billable after
go-live.** So the earlier research flag (IDI standard T&C prohibit display) is superseded — there IS
a display-permitted class; the standard-terms prohibition is the DEFAULT, and we have/can-get the
paid display class. The 2026-07-08 caution below is kept for context but is NO LONGER the operating
assumption. Still worth having the exact class scope in hand (which record types display/index) when
we activate the $6k/mo tier.

**(Superseded context, 2026-07-08 research flag):** IDI's *standard* Subscriber T&C (Aug 2024) prohibit
public display/indexing/resale/bulk-automated on 4 clauses (docs/research/idi-data-access.md). That's
the standard tier; the display class above overrides it. idiCORE stays fine for the gated paid report too.

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
