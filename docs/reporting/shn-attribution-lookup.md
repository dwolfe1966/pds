# shN attribution — provenance + shConId lookup

**For:** BC reporting (Hana / Big Bot). **Date:** 2026-06-29.

## Provenance: partner/channel are derived from shn (front-end), not independent of it

On the `commercepayments` doc, `data.tracking.partner.{name,channel}` and `shConId/shColId`
are **separate fields** (neither computes the other at the DB level — Big Bot is correct there).
But at the **source**, partner/channel are **derived from shn** on our front end:

```
shn (URL) → campaignRegistry resolves shConId → identity{partner, channel, shnName}
          → sessionStorage(attribution.*) → data.refer.{partner,channel}
          → BC stores it at data.tracking.partner.{name,channel}
```
(+ a `utm_source` fallback when no registry entry matches the shn.)

**Implication:** partner/channel are only as good as the front-end registry at click time, and
that registry is a local layer that can **drift from BC's ground truth**. So:
- **`shConId/shColId` is the authoritative attribution axis** (BC writes it).
- **partner/channel is a derived label** — registry-dependent, drift-prone.
- For reporting: key off `shConId/shColId`, resolve partner/channel/shnName from the registry,
  and treat `data.tracking.partner` as a convenience copy that can drift.
- The real `shnName` is the registry's `identity.shnName` (resolved from shConId) — **NOT**
  `data.tracking.partner.name` (which is just the partner: Internal/Google).

## shConId → identity lookup (front-end registry, current 2026-06-29)

| shConId | shnName | partner | channel | brand | funnel | landing |
|---|---|---|---|---|---|---|
| `69a2380b53ecf9b049d01fbb` | IDL Default | Internal | Default | IDL | — (default) | `/` (no redirect) |
| `6a22ff83ca16ad4ef68b84b5` | Google Inmates Upper | Google | Search | IDL | Inmates | `/name/landing/v3` |
| `6a273f983ee3447608a3aae5` | Google Inmates Lower | Google | Search | IDL | Inmates | `/name/landing/v3` |
| `6a273f983ee3447608a3aae6` | Google Death Upper | Google | Search | IDL | Death | `/name/landing/v4` |
| `6a273f983ee3447608a3aae7` | Google Death Lower | Google | Search | IDL | Death | `/name/landing/v4` |
| `6a273f983ee3447608a3aae8` | Google Divorce Upper | Google | Search | IDL | Divorce | `/name/landing/v6` |
| `6a273f983ee3447608a3aae9` | Google Divorce Lower | Google | Search | IDL | Divorce | `/name/landing/v6` |

Notes:
- **Upper/Lower pairs are identical UX** — they differ only by Google ad position (bid/reporting).
  Group Upper+Lower per funnel for campaign-level rollups.
- All 6 paid campaigns are **Google / Search / IDL**; only funnel + Upper/Lower differ.
- `IDL Default` = internal/no-partner traffic (stays on home).

## ⚠️ The registry should mirror BC, not be hand-maintained
This table is the **front-end registry's current state**. It should be **a mapping of what BC
returns when we retrieve shN information** — i.e., derived from BC's shn lookup, not a static
local file. That's Project #3 (read attribution config from BC, retire the local registry). Until
then this is the right lookup *today*, but **if BC's shn→campaign mapping diverges, BC wins** and
we update the registry to match. `shConId/shColId` stays the trustworthy axis throughout.

Source: `src/services/campaignRegistry.js`, `src/context/CampaignContext.js`, `src/services/trackingService.js`.
