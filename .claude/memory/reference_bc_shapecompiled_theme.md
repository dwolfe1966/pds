---
name: reference_bc_shapecompiled_theme
description: BC hosts per-shN config (landing/sup/optout/thinmatch) in getShapeCompiled under comp.client.theme
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7cf476e3-95d5-4760-901e-3e85bff7c6de
---

BC's `getShapeCompiled()` (`GET /api/shape/compiled?shn=<token>&cascade=true`) is the
source of truth for per-shN config — "all shN info in BC's database." Confirmed live
2026-06-09 via `scripts/probe-shapecompiled.js` (intercepts the call CampaignContext
already fires; ShapeCompiled API isn't reachable as `window.ApiWrapper.api.shape`
directly — intercept the network response instead).

The shN **theme** (same object as the shN sheet) is delivered as a JSON value under
component key **`comp.client.theme`**:
```json
{ "landing": "/name/landing/3", "sup": "ver=a", "optout": "yes", "thinmatch": "yes" }
```
Read via `shape.getShComp('comp.client.theme')` (type 'json' — may arrive parsed or as a
raw string; handle both). Other useful comps: `comp.brand.name`, `comp.brand.domain`,
`comp.brand.gtm`, `comp.tracking.partner.name`/`.channel`, `comp.client.privacy`,
`comp.client.signup.nameSearch.terms`, `comp.client.paths.{account,dashboard}`. The
response also has top-level `shConId`/`shColId`/`brandId`/`containerName`/`requestCity`.

**Wired (commit 81b26f8):** `campaignResolver.extractShapeProps` parses
`comp.client.theme` → `optOut` (optout==='yes') and `zeroState` (thinmatch==='yes' ?
'thinMatch' : 'noRecords'), which **override the local registry** (BC = source of truth).
Drives: (a) thin-match zero-state on the 3 SRP pages (already consume
`campaign.search.zeroState`), (b) `campaign.optOut` for the payment-page opt-out section.
**Critical fix shipped with it:** the resolver cache was keyed only by (shn,shl), so the
shape-enriched re-resolve got the stale pre-shape cached result — ALL BC enrichment was
silently dropped. Cache key now includes '#shape'.

Caveats: BC's `landing` is `/name/landing/3` but our routes are `/name/landing/v3` — do
NOT drive routing off it without a 3→v3 map (kept on registry). Thin-match also appears
per-search as `response.raws[0].transient.sequenceOption.thinMatch`
([[reference_bc_contactmessage_email_link]] sibling discovery) — that's the search-outcome
signal; `comp.client.theme.thinmatch` is the campaign-level config used for the decision.
ShapeCompiled `keys` also reveal BC hosts its OWN email campaigns
(`comp.campaign.email.{guest,signup,member,cancel,...}.series`) — relevant if email moves
fully to BC. **Consumers (wired):** `campaign.optOut` has ONE effect (owner clarified 2026-06-09) —
it toggles JUST the consent **checkbox + the "By clicking…" SUP pricing-disclosure
paragraph** under the "*Terms of Use and Pricing Information" heading on PaymentPage
(`requireTermsCheckbox = campaign?.optOut !== false`; heading + FCRA note always show).
It does NOT add any opt-out link to the search/detail funnel — the `OptOutNotice` that
commit fd6f701 (2026-06-05) put at the top of SRP/detail was a MISREAD; removed +
component deleted 2026-06-09. The data-removal/opt-out link lives ONLY in the site
**Footer** (`/opt-out`, `/suppression-list`), always, not gated. thinmatch →
SRP `zeroState` decision (ThinMatchPreview vs ZeroResultsPanel).

**Owner decision 2026-06-09 (REVERSES the 2026-06-08 strict-default):** organic/no-shn
traffic gets BOTH the thinmatch promo AND the optout/SUP messaging. So BC's theme drives
both flags for ALL traffic (no strict guard), and the registry DEFAULT is now the 'on'
state (zeroState 'thinMatch', optOut true) as the safe fallback. An shN with
thinmatch:'no'/optout:'no' overrides to 'noRecords' / hidden. Bundle ee4a5795.

Open: FCRA disclaimer currently sits inside the optout-gated block (hides with
optout:'no') — split out if it must always show. Inmates Upper (6a22ff83) resolved to
the DEFAULT container in one probe (cached?) — confirm it has its own config. Live
end-to-end (real affiliate optout:'no' token through checkout) is captcha-gated to fully
verify; logic is unit-tested.
