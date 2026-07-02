---
name: project_ab_test_theme_wiring
description: "How the BC A/B split (theme.landing/sup) drives the landing arm + SUP variant, and the boot-redirect timing gate"
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

BC runs the LP/SUP A/B split server-side: `/?shn=<id>` returns `comp.client.theme` =
`{landing, sup, optout, thinmatch, split_type, split_name}`, randomized per request
(Control: `landing:/name/landing/v3a, sup:ver=i`; Challenger: `v3b, ver=j`).

Wiring (commit dfb7bab, 2026-07-01) — we just INTERPRET the theme (BC already does the split):
- `campaignResolver.js extractShapeProps`: `theme.landing`→`landingRoute` (normalizeLandingRoute:
  legacy `/name/landing/3`→`/v3`, whitelist same-origin `/(name|phone|email)/landing/v…` only —
  no open-redirect), `theme.sup`(`ver=i`)→`supVariant` (validated vs MARKETING_VARIANTS),
  `split_type/split_name`→`identity`. **Theme WINS over the registry** for landing+sup (that IS
  the split); optout/thinmatch already did.
- Redirect + SUP selection already consume `campaign.landing.route` + `campaign.detail.variant` —
  no page changes. Landing (v3a/v3b) sets `funnel.theme` (blue/dark) via useLandingTrack; sup
  (i/j) sets the teaser variant. They align because BC sends matched pairs.

**Timing gate** (the one non-obvious part): `HomePageRedirect` fires pre-shape (registry only),
so without a gate it redirects to the static fallback before the async theme arrives.
`CampaignContext._shapeSettled` flips on shape success/fail/2.5s-timeout; the `/` redirect waits
ONLY when the registry entry has `landing.awaitTheme:true` (set solely on the A/B shN
`6a22ff83ca16ad4ef68b84b5`). All other campaigns redirect immediately (no latency regression).

⚠️ **Dev returns the OLD theme** (`/name/landing/3, ver=a` — no A/B config on dev). Verified live:
our code correctly maps it → `/v3` + variant `a` (no regression). To see the v3a/v3b arms live,
BC must have the A/B split configured on the tested environment. Arms proven by unit tests
(`campaignResolver.abtest.test.js`) with the exact theme JSON. Relates to [[project_retire_shn_registry]],
[[reference_bc_shapecompiled_theme]].
