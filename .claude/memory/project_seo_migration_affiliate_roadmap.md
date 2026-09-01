---
name: project_seo_migration_affiliate_roadmap
description: Growth roadmaps (Aug 2026) — SEO, Paid marketing, Affiliate (3 full docs + index in docs/growth/)
metadata: 
  node_type: memory
  type: project
  originSessionId: a30cdc08-f0c0-401c-a086-f4170eba2f74
---

From the 2026-08-25 growth review. THREE full roadmaps + index in `docs/growth/` (team + BC architecture review by Kwan; keep options open, non-adversarial — see [[project_org_dynamic_nic_team]]):
- `roadmap-paid-marketing.md` — paid search, LIVE. ⚠️ Do NOT say "engine"/"scales" — economics are proven at compet, NOT yet at PDS (owner 2026-08-27, see [[feedback_deliverable_redaction]]). Real compet numbers: PS Free $11.61 CPA/8.15% CVR (best ad group `Find Free` $7.68), Crim Rec $17/1.45× value/cost, LE-death $16/1.78×. Replicate profitable ad units from compet + inmates-upper/people-search-upper (upper-HHI). Landings `idlookup.ai/name/landing/v11?shns=1`; plan in docs/ads/idl-general-intent-campaign-plan.md.
- `roadmap-affiliate.md` — reusable platform (capture→persist→convert→postback→report); Fluent/MobileMarketing/Dimitri as instances.
- `roadmap-seo.md` — full SEO; **migration is ONE workstream, NOT a given**. Hybrid: prune thin → first-party differentiation (inmate lead) → authority/editorial (docs/seo/seo-recovery-brainstorm.md).
- `roadmap-index.md` — cross-cutting A1 hosting decision (Kwan) + P0 security + ladder.

**Track A — SEO → idlookup.ai.** TWO separate decisions (the scoping doc `docs/seo/idlookup-ai-people-migration-scoping.md` only covered the 2nd):
- **DECIDED 2026-08-27 (team onboard): move SEO to idlookup.ai** via a **path-based router** — requests with `/people` → the SEO app; everything else → the existing IDL app. All traffic on one domain, inheriting idlookup.ai authority. (Supersedes the earlier open A1 hosting / A2 subdomain-vs-subpath debate.)
- **SEO ideas from review (2026-08-27):** (a) fold **stored teaser results from already-completed searches** into name/location pages — ⚠️ validate usage-rights for teaser data outside a signup/pay wall before building; (b) shift rendering from on-demand ISR → **pre-generated static (SSG)**.
- Move CURATED set only (hub+states+cities+counties+~980 unique name pages); NOT the ~41k thin pages. Keep idlookup.me as 301 redirector. See [[project_seo_indexing_incident]].

**Track B — affiliates (port from compet).** Built already: shN/shL capture (campaignResolver/campaignRegistry) + attribution persists to BC `data.refer`/`commerceorders.refer` (order-level confirmed). NEW: server-side postback (fire off confirmed-sale signal GA4/Ads uses — never client pixel; port Fluent's compet pattern), widen refer passthrough to carry arbitrary partner sub-IDs, CasA/CasD mapping, landings.
- **Fluent (Incent):** incentivized/low-intent; direct-to-SUP NEW landing; monthly report; wall-placement creative; postback returns their URL params.
- **MobileMarketing (App):** reuse `/name/landing/v2`; daily Google Sheet report; capture SHNs/SHLs/custom IDs → persist to BC; postback.
- **CasA/CasD = INTERNAL pay-eligibility gate on BC's backend (owner-authoritative 2026-08).** NOT partner-facing, NOT a user offer-waterfall (my earlier "port a cascade flow" reading was WRONG). Logic: we provision a trial "in the door" even when the card fails for certain reasons (e.g. ISF), attempt capture at subscription conversion, and **pay partners ONLY on captured payment = CasA**; **CasD = cascade decliner** (never captured) → no payout. Same billing capture signal we already classify (`sale`/`fulfilled` vs `D{n}.{x}` — [[project_csr_billing_classification]]). **Postback is BC-emitted** on capture, echoing the persisted `refer_*`. Our side: sub-ID passthrough (Phase 0 ✅) + hand BC each partner's postback URL/macros. Never mention CasA/CasD to partners. Legacy GTM evidence: `docs/ads/GTM-THCSBJWN_workspace3.json` (Channel="Cascade Decliner/Exit", pixel /pixelforsignup) + `casD%` KPI.
- **Phase 0 SHIPPED (commit 4c6aab4):** affiliate sub-IDs round-trip via generic **`refer_*`** passthrough — BC ingests ONLY refer_-prefixed params onto `commerceorders.refer` (prefix stripped). Partner links pass sub-IDs as `refer_<name>` (→ /name/landing/v2 or /phone/landing/v2); captured in gtm.js, emitted in trackingService.buildReferQueryString (order) + buildRefer (tracking). **shn/shl DELIBERATELY excluded** (forcing them into refer broke BC tracking.partner automation = the 8/06 partner/channel blackout — see [[feedback_search_contextkey]]). Onboarding+questionnaire: docs/growth/affiliate-partner-onboarding-questionnaire.md. Remaining: live real-purchase verify.
