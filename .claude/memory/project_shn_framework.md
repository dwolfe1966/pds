---
name: shn-partner-attribution-framework
description: "How the shN partner-customization + attribution system is built — registry, resolver, tracking data.refer, BC-driven pricing, and what's still pending."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2a7937d0-2c0b-462e-b57c-c5bc0b3fde3f
---

Partner customization keyed on the inbound `?shn=<token>` (and optional `?shl=`).
Goal: lighter than weinform.org (the two ex-weinform teammates' old 26-brand
config tool) — "customize to a point," no heavy config UI. Built 2026-06-03.

**Architecture = BC is source of truth; thin local bridge for what BC can't do.**
- **Identity** (partner/brand/channel) → from BC `getShapeCompiled()`/`getShComp`
  (today exposes brand + shConId/shColId; channel/partner-name pending = #77-Q4).
- **Pricing per offer** → BC `offer.findByShmName({shmName})` → `transient.priceInfo.s0/s1`.
  Wired into checkout display via `src/hooks/useOfferPricing.js` (gated on
  `campaign.offer.shmName`; default keeps the TRX-approved brand display).
- **Payment acceptance / cascade / risk** → BC-side, keyed on shn (sheet rows 2/3
  cascade $0/$1 pass; 4/5 Google-Inmates HHI Hi/Lo = payment-type/risk differences).
- **Local registry** (`src/services/campaignRegistry.js`) = ONLY landing route +
  interim identity/offer per shn, shrinking as BC models partners.

**Key files:**
- `src/context/CampaignContext.js` — captures shn/shl (first-touch, URL-stripped),
  persists resolved identity to sessionStorage (`attribution.shnName/partner/channel`).
- `src/services/campaignResolver.js` — fallback chain `shn:shl → shn:* → *:shl →
  default`; merges identity (BC shape OVERRIDES local).
- `src/services/campaignRegistry.js` — entries keyed `<shn>:*`. **Keys are
  PLACEHOLDERS (1:*..5:* from the spreadsheet rows) — real shN values are LONG
  STRINGS (BC shConId ObjectIds, e.g. 69a2380b53ecf9b049d01fbb), still to be
  swapped in. Resolver is key-agnostic, so it's a 1-line-per-entry swap.**
  Rows 4/5 (Google Inmates) → `landing.route: '/name/landing/v3'` (inmate funnel).
- `src/services/trackingService.js` — `buildRefer()` stamps shn/shl/shnName/
  partner/channel + source/gclid/fbclid into BC `tracking.create` `data.refer` on
  EVERY event. Retries on cold-start failure.

**Attribution measurement (the #77 workaround that WORKS today):** every event +
conversion (`signup_complete`+userId, `payment_complete`+orderId+amount) carries
`data.refer` into BC's tracking store, queryable via `csrWrapper.api.tracking
.findUser` — no dependency on the non-persisting `commerceorders.refer`.

**Inmate funnel:** `/name/landing/v3` (NameSearchLandingV3Page, "Find an Inmate"
theme). Its search was made reliable by handing off to `/name/loader` (was inline
api.searchPeople that failed silently). See [[feedback_silent_referenceerror]].

**Pending:** (1) the real long-string shN values for the 5 partners (owner to
provide → swap into registry keys). (2) BC asks in `docs/BC_SHN_PARTNER_SHAPE.md`
(#77-Q6 model partners, #77-Q4 expose names) to fully shift identity/offer to BC.
Spreadsheet source: shN / shN Name / Brand / Partner / Channel / Purpose.
