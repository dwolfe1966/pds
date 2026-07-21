---
name: feedback_first_party_data_independence
description: "The service must return maximum, best-quality data independent of any downstream provider's status"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Owner principle (2026-07-19): our incarceration/people-data service must **function and return the maximum,
best-quality data independent of the status of any downstream provider** (Enformion/Endato, UCC, etc.). A
provider being down or not-yet-entitled (e.g. Enformion "Criminal Search V2 not enabled" — a KNOWN pending
item, not a bug) must never be framed as "the problem." First-party coverage (state DOC rosters + FL/NC bulk +
the `inmates` roster) is the PRODUCT; external providers are additive bonuses.

**Why:** this is the core moat thesis — [[project_incarceration_data_moat]] and [[project_freemium_identity_community]].
Owning the data (zero marginal cost, display control, SEO) is the differentiator; renting it makes us fragile.

**How to apply:** when diagnosing "no results," lead with first-party COVERAGE gaps (which states/names we
haven't crawled) and how to close them, not downstream-provider errors. Keep provider failures isolated
(Promise.allSettled) so one dead source never degrades the others. Don't gate features on a provider being
enabled. Prioritize expanding first-party state coverage + quality over waiting on any vendor.
