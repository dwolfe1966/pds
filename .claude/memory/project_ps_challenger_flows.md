---
name: project_ps_challenger_flows
description: Three isolated PS challenger flows (honest/proof/self) — each a distinct testable hypothesis; funnelVariant slot drives all treatments
metadata:
  type: project
---

**People-search challenger portfolio — three isolated, flag-gated A/B flows, each a DIFFERENT hypothesis.** Built as separate routes (owner nervous about editing live V3/control; all standard funnels untouched). Supersedes the single-flow note in [[project_honest_ps_challenger]].

The three hypotheses (owner brainstorm, 2026-07-29):
- **A · Honest** (`/people-search`, `PeopleSearchHonestPage`) — *honesty → trust → conversion + retention*. Built first (see [[project_honest_ps_challenger]]). Metric: trial→paid, refund rate.
- **B · Proof-First** (`/proof-check`, `ProofCheckPage`) — *concrete evidence beats promises/fear*. Reveal ONE real, checkable finding in the clear BEFORE the paywall; checkout sells "unlock the rest". Weaponizes our first-party moat (booking/life-events) competitors can't match. Metric: SRP→pay CTR, refund rate.
- **C · Search-Yourself** (`/my-exposure`, `MyExposurePage`) — *self-exposure anxiety + an ongoing job → RETENTION*. The only one that changes WHAT is sold: a standing service (claim + who's-searching monitoring), not a one-time peek. On-ramps [[project_wsfy_self_build]] + [[project_identity_management]]. Metric: month-2/3 retention + LTV (ignore day-1 CVR).

**Shared plumbing (the key refactor):** one `funnelVariant` sessionStorage slot ('honest'|'proof'|'self'|'') set at the **loader chokepoint** (`funnelFlow.js` `setVariant`/`getVariant`; NameSearchLoaderPage sets it from `?variant=`). Single slot = choosing one implicitly clears the others (no sibling-boolean leak — the bug that bit the old `honestFunnel` flag). Folded the old `honestFunnel` boolean into it (safe: honest challenger not yet uploaded to BC). Loader back-compat: honest landing's `?honest=1` maps to variant=honest.
- **Search core is identical for all three** — every landing does the SAME proven hand-off `navigate('/name/loader?...&flow=general&variant=X')`. `flow=general` (NOT a new flow value — that would fall SignalTeaser's `capabilityCopy` back to dating copy silently). Only the display VARIANT differs. No price change (all $1→$49.98).
- **Loader** (`PHASES_BY_VARIANT`/`POINTS_BY_VARIANT`): per-variant scan copy.
- **SRP** (`SearchResultsPage`): `flow=general` zero-state = honest "no confirmed match" (never fabricated thin-match). Proof passes `proof={getVariant()==='proof'}` to `SignalTeaser` → `ProofPanel` reveals ONE real record's details in the clear (booking facility/status/year, or marriage/divorce date), degrades to null (→ standard SRP) when no real record — NEVER fabricates. **CRITICAL:** SRP teaser is NON-strict → records are NAME(+state)-matched, NOT corroborated to the person. So ProofPanel asserts about the *record under the name* ("a real record is on file under this name" — true), badge "Real record · match unconfirmed", and asks the searcher to confirm identity. NEVER "{name} has a record" (defamation posture for a same-name stranger). Advisor caught this; a green build won't.
- **C SRP gap (known):** Flow C is delivered via landing + loader + payment only. Its SRP shows the STANDARD general teaser — the brainstorm's "own records + WSFY tease on SRP" is NOT built yet. Defensible first cut; flag to owner.
- **Payment** (`PaymentPage`): `getVariant()` → `honestFunnel`/`proofFunnel`/`selfFunnel`. All three show the identical plain price disclosure above the CTA; proof/self add a variant lead line. Self + honest show the post-pay identity/claim moment. **C sells claim + who's-searching only — NOT takedown/suppression** (WSFY Hide enforcement is a stub, [[project_identity_control_owner_voice]]); no privacy claim ([[feedback_no_private_search_claim]]).

**Attribution:** `campaignRegistry` keys `proof-first:*` (→/proof-check, channel 'Proof First') and `self-check:*` (→/my-exposure, channel 'Self Check'); honest is `honest-ps:*`. PLACEHOLDER shNs — swap for minted BC shConIds at launch. Tag URLs `?shn=proof-first` / `?shn=self-check` / `?shn=honest-ps`.

**Status:** built + `npm run build` clean (2026-07-29); NOT yet uploaded to BC. To run: upload build/ → point spend at each `?shn=` → compare channels in GA4/BC. Files: MyExposurePage.js · ProofCheckPage.js · SignalTeaser.js (ProofPanel + `proof` prop) · NameSearchLoaderPage.js · PaymentPage.js · SearchResultsPage.js · funnelFlow.js · campaignRegistry.js · App.js.
