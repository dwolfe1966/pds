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

## Two attribution fields in the DB — an ID + a derived label (not two truths)

`shConId/shColId` and `data.tracking.partner` are **not two competing attributions** — they're
an **ID** and a **derived label**, same root (the shn from the URL):
- **`shConId` / `shColId`** = BC's canonical campaign/collection **IDs** — the **source of truth**
  (the key). BC's cohort engine keys on `shColId`.
- **`data.tracking.partner.{name,channel}`** = our front-end's **resolved label** (Internal/Default,
  Google/Search…), computed from the shn via the registry and attached at checkout — a
  **denormalized convenience copy**, downstream of `shConId`.

The risk of storing both: the label is a cached derivation that can **drift** from the key if the
front-end registry lags BC. Right model — **one source of truth, label resolved from it:**
- Key everything on **`shConId/shColId`**; resolve partner/channel/shnName **from** it via the
  registry at read time. When the two disagree, **`shConId` wins.**
- Project #3 (registry mirrors BC) collapses this: once the label always derives from the ID via
  BC's mapping, the two fields **can't disagree** — one key + one resolution table.

## Session vs payer attribution — which should reports use?

Not two attribution *models* — the **same first-touch session attribution read from two places:**
- **Session** = source captured when the visitor lands (shn → partner/channel/gclid), carried on
  every event incl. the purchase → what **GTM/GA4/Ads** see.
- **Payer** = that same session attribution **snapshotted onto the payment doc** at checkout
  (`data.tracking.partner` + shConId/shColId).

**Payer does NOT override primary attribution** — it's a copy of the session's first-touch value
written at the sale. In a normal single-session conversion, **session == payer.**

They diverge only on: **cascades/decliner-recovery**, **multi-session/multi-day** repeat visits, or
**registry drift**.

**Recommendation:**
- **Acquisition funnel + eCPA/ROAS → SESSION attribution** — it must reconcile with Google Ads + GA4,
  which attribute on session/click (Ads bills per gclid and credits that click). Running the funnel
  off "payer" risks crediting a cascade/internal row instead of the Google campaign that paid for
  the click → eCPA won't tie out.
- **Cohort / retention (M1.x) → order `shColId`** (BC's cohort engine keys on it).
- In the normal case these are the same value, so it's moot. Treat any session-vs-payer *difference*
  in the sheet as a signal (cascade / multi-touch / drift), not two competing truths.

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
