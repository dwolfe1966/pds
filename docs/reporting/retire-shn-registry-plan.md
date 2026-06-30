# Retire the local shn registry — plan + findings (HELD 2026-06-30)

**Status: HELD** (owner deferred 2026-06-30). Resume by filing the BC ask + the safe prep below.

**Goal:** retire `src/services/campaignRegistry.js` (hand-maintained shn→config map = drift risk)
and drive everything from **BC's shape** (`getShapeCompiled`). The registry should *mirror BC*, not
be a local list. This is the durable fix for the attribution drift discussed in
`docs/reporting/shn-attribution-lookup.md` ("Project #3").

## Current architecture
- `campaignResolver.resolveCampaign(shn, shl, { shape })` resolves from the registry, then merges
  BC's shape via `extractShapeProps` — **BC overrides** the registry for partner/brand/optout/zeroState.
- Shape fetched via `apiWrapper.getShapeCompiled()` → read-only `GET /api/shape/compiled?shn=…&cascade=true`;
  `getShComp(key)` reads `values[key]`. clientId/apiId are throwaway random hex (not secrets).
- Consumers of `useCampaign()`: `App.js` (HomePageRedirect), `CampaignContext`, and many sales pages
  (results / detail variants / payment / home).

## What BC's shape provides (probed 2026-06-30 with shn `6a273f983ee3447608a3aae5`)
| Registry field | BC shape source | Status |
|---|---|---|
| `brand` | `comp.brand.name` = "IDLookup.AI" (`comp.brand.id` = "idlookup") | ✅ BC has it (map to "IDL" if short code wanted) |
| `optOut` | `comp.client.theme.optout` = "yes" | ✅ already read |
| `search.zeroState` (thinMatch) | `comp.client.theme.thinmatch` = "yes" | ✅ already read |
| `landing.route` | `comp.client.theme.landing` = `/name/landing/3` | ✅ BC has it — needs `/3`→`/v3` transform |
| `detail.variant` | `comp.client.theme.sup` = "ver=a" | ✅ BC has it — parse `ver=a`→`a` |
| **`partner`** | `comp.tracking.partner.name` | ⚠️ key declared but **EMPTY** for the shn — BC not populating |
| **`channel`** | `comp.tracking.partner.channel` | ⚠️ key declared but **EMPTY** |
| **`shnName`** | none (only machine strings `containerDesc`="shN : IDL google inmate lower", `containerName`="shn.idlookup.lookup.google.inamte.lower" — note BC's "inamte" typo) | ⚠️ no clean display-name field |

`comp.client.theme` is exactly `{ landing, sup, optout, thinmatch }`. ~120 declared comp keys total;
only the brand/client subset is populated for this shn.

## The blocker
The registry's *unique* value today is the **populated attribution** (partner/channel/shnName) — which
is exactly the data the Jerome attribution thread was about. BC's shape has the partner/channel **fields
but they're blank**, and there's no display-name field. **So deleting the registry today zeroes out
attribution.** Can't fully retire until BC supplies it.

## Plan (sequenced)
1. **BC ask (unblocker, cheap):** populate `comp.tracking.partner.{name,channel}` per-shn in the shN
   sheet (keys already exist) + add a campaign **display-name** field (or we derive `shnName` from
   `containerDesc`). → route through `bc-asks-register`.
2. **Safe prep (no attribution risk — can do anytime):** in `campaignResolver.extractShapeProps`
   add `landing` (`/name/landing/{N}` → `/name/landing/v{N}`) + `sup` (`ver=a` → `a`) transforms so
   config is driven from the shape; **remove the dead fallbacks** `comp.partner.name` /
   `comp.connection.name` (neither exists in BC's schema — only `comp.tracking.partner.name`).
3. **When BC populates partner/channel** → delete the per-shn registry entries; the registry collapses
   to a thin `default` fallback + the transforms. That's the retirement.

## Gotchas
- **Keep the `default` fallback** in the registry (used when the shape fetch fails) — don't fully delete; routing safety.
- Landing format gap (`/3` vs `/v3`) — the transform is mandatory before routing off the shape.
- Sensitive campaign code — **one change at a time** (see memory `feedback_search_contextkey`). The registry is currently the safe fallback.
- Full shape surface dump: `.claude/agent-memory/bc-iife-investigator/reference_shape_compiled_surface.md`.
