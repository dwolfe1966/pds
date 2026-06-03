# BC ask — Make the shN partner shape resolvable + readable (Shn framework)

**Raised:** 2026-06-03
**Bug refs:** subset of #77 (Q4 + Q6) — the two items that block a *BC-driven* partner config.
**Context:** We're building the "Shn" partner-customization framework on idlookup.ai.
Inbound links carry `?shn=<partnerId>` (`shConId`) and optionally `?shl=<pageId>`
(`shColId`). We pass these to the IIFE at init (`getInstance({ initialShParams: { shn, shl, cascade: true } })`)
and read the resolved config via `getShapeCompiled()` / `getShComp(...)`.

Design principle: **BC is the source of truth.** We want partner *identity* and
*offer/pricing* to come from BC's shape per visitor, and keep only a thin local
file for the one thing BC can't drive client-side (which React landing route
renders). Two gaps block that today.

## Copy-paste summary

> We're driving partner customization off the shape. Two blockers:
>
> **1. Partners aren't modeled in the shape tree (#77-Q6).** `shl.partner.TODO`
> has **0 children**, so `getShapeCompiled()` returns the **default** shape no
> matter what `shn` we pass — BC can't differentiate partners yet. We need real
> partner nodes created (with an onboarding path) so the shape, offer, and
> pricing cascade resolve per `shn`. Until then, the only thing that can vary by
> partner is our local registry.
>
> **2. The shape doesn't expose human partner/channel names (#77-Q4).** Today we
> can read `getShComp('comp.brand.name')` and the shConId/shColId ids, but not
> the **shN name**, **partner name**, or **channel**. We need those on the shape
> (e.g. `comp.shn.name`, `comp.partner.name`, `comp.channel.name`, or a documented
> equivalent) so every event/conversion can be labeled by partner + channel for
> reporting — without us hardcoding a name map.

## What we already consume (works today)
- `getShapeCompiled()` → `getShComp('comp.brand.name')` (brand name) and
  `shConId`/`shColId` ids (`src/services/gtmContext.js:setBcAttributionFromShape`).
- `offer.findByShmName({ shmName })` → `transient.priceInfo.s0/s1` — now wired
  into the checkout price display per offer (`src/hooks/useOfferPricing.js`), so
  **per-partner pricing is BC-driven the moment a partner has its own offer.**

## Exactly what we need from BC

**Q6 — model the partners (the big one):**
- Create real partner nodes under `shl.partner.*` (or wherever partners live) so
  a given `shConId` resolves a partner-specific shape.
- Confirm the **onboarding path**: how/when a new partner node is created, and
  what `shn` value we hand to the partner for their links.
- Confirm the shape cascade then resolves a partner-specific **offer/shmName**
  (so `findByShmName` returns that partner's price) and **landing hints** if any.

**Q4 — expose names on the shape:**
- Add the resolved **shN name**, **partner name**, and **channel** to the
  ShapeCompiled output (readable via `getShComp` or a documented field).
- Confirm the comp keys we should read.

## Mapping to our spreadsheet (what each partner needs)
| shN row | Needs from BC |
|---|---|
| 1 IDL Default | nothing — default shape |
| 2 Cascade Decliner ($0 pass) | shN-based **payment-acceptance / cascade** behavior |
| 3 Cascade Exit ($1 pass) | shN-based **payment-acceptance / cascade** behavior |
| 4 Google Inmates HHI Hi | partner node + offer; **Hi/Lo = different payment types / risk** |
| 5 Google Inmates HHI Lo | partner node + offer; (lower risk tolerance) |

The cascade (#2/#3) and Hi-vs-Lo payment-risk differences are **BC-side payment
behavior**, keyed on `shn` — please confirm BC adjusts payment acceptance by `shn`.

## Until BC ships the above
We bridge with a **thin local registry** keyed by the `shn` string: it supplies
the landing route always, and supplies offer/identity per-shN only until the
shape does. As partner nodes come online, those local entries shrink to just the
landing route.
