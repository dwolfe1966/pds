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

**Attribution measurement:** every event + conversion (`signup_complete`+userId,
`payment_complete`+orderId+amount) carries `data.refer` into BC's tracking store,
queryable via `csrWrapper.api.tracking.findUser`.
**UPDATE 2026-06-04:** `commerceorders.refer` DOES persist (BC confirmed). It was
`{}` on every order because `billing.sale`'s `queryString` was built from the
stripped `/payment` URL, not first-touch. Fixed: `trackingService.buildReferQueryString()`
(refer_* from `referralParams`) now feeds the sale `queryString` →
`commerceorders.refer` (consumer `999bf839`, pending deploy). gclid/utm still ride
`data.refer` only. Verify post-deploy: land `?refer_partnerId=TEST` → $1 trial →
order.refer populates AND sale succeeds.

**Inmate funnel:** `/name/landing/v3` (NameSearchLandingV3Page, "Find an Inmate"
theme). Its search was made reliable by handing off to `/name/loader` (was inline
api.searchPeople that failed silently). See [[feedback_silent_referenceerror]].

**REFRESHED SHEET 2026-06-08 (commit debe2e3, bundle public.c387fd5c.js):** new
7-partner sheet (cascade rows GONE). Columns: shN / shN Name / Brand / Partner /
Channel / Purpose / theme(JSON). theme→registry map: landing "/"→route null |
"name/landing/3"→v3 (inmate) | "/4"→v4 (death) | "/6"→v6 (divorce); sup "ver=a"→
detail.variant 'a'; optout "yes"→optOut true; thinmatch "yes"→zeroState 'thinMatch'.
- **ALL 7 sheet tokens now wired (2026-06-09, consumer bundle `e9bad569`).**
  Already live: `69a2380b53ecf9b049d01fbb` = IDL Default (landing "/" = no redirect);
  `6a22ff83ca16ad4ef68b84b5` = Google Inmates Upper (v3).
  **UX defaults REVERSED 2026-06-09:** organic/no-shn now gets the thinmatch promo +
  optout/SUP messaging (registry default zeroState 'thinMatch', optOut true; BC theme
  drives both). This supersedes the 2026-06-08 "universal default strict" decision.
  See [[reference_bc_shapecompiled_theme]].
  Swapped in 2026-06-09 (owner provided minted IDs): `…aae5` Inmates Lower (v3),
  `…aae6` Death Upper (v4), `…aae7` Death Lower (v4), `…aae8` Divorce Upper (v6),
  `…aae9` Divorce Lower (v6). Upper/Lower pairs share landing+config (differ only by
  ad position). PENDING_*:* placeholders removed.
- **Dropped** dead row-number placeholders (1:*/2:*/3:*/5:*) + cascade rows.
- **Fixed v4 (death) + v6 (divorce) funnel search** same session: both still used the
  silent-fail inline `api.searchPeople` (→ `/name/search-result?error=true`); ported
  the v3 `/name/loader` handoff. v3/v4/v6 now all reliable; v2/v5 NOT (still inline).

**ROOT CAUSE 2026-06-15 — BC CTO: "your client loads only DEFAULT shN; load the correct
shN."** The minted IDs the owner provided (incl. `6a22ff83ca16ad4ef68b84b5` Google Inmates
Upper) do NOT resolve to their partner node in BC — BC falls back to its default shN, so
`order.shColId` + `commercepayments…partner` come out internal/default (the "partner
regression" Jerome/the analyst saw). Confirms our own 06-09 probe (6a22ff83 → DEFAULT
container) — it was NOT a cache artifact. Our client mechanics are fine: index.js writes
`attribution.shn` to sessionStorage before `getInstance`, which passes it as
`initialShParams` (24-hex passes `isBcObjectId`). So the failure is at the BC boundary:
either the value is wrong (authoritative shN is in the CTO sheet
`1R7fE5Jp4TNt14BlwsbTqpxpUwNh1BxihGhfXqn0qNpQ` row 12 / B12:G12 — compare vs URL `6a22ff83`)
**RESOLVED — client bug, fixed `apiWrapper.js` (bundle `public.e70d1364.js`, deploy
pending).** Owner confirmed `6a22ff83` IS correct (default = `69a2380b53ecf9b049d01fbb`).
CTO: we weren't calling a BC method to SET the shN after reading the URL. We passed
`initialShParams` at `getInstance` — but **getInstance is a SINGLETON**, so if the instance
already exists (IIFE auto-init on load / earlier call) our config is IGNORED → BC stays on
default shN → orders resolve internal/default. **Fix = call
`wrapper.api.shape.setShapeParams({shn,shl,cascade})`** (BC HowTo 2026-05-13, the documented
post-init shape setter) right after getInstance, guarded + fire-and-forget. KEY LESSON:
`initialShParams` ≠ guaranteed shN switch; always `setShapeParams` to be sure. Needs live
$1-sale verify: `order.shConId==6a22ff83` & partner=google. See
`docs/BC_COMMERCE_ATTRIBUTION_GAPS.md`. [[project_ads_conversion_2026_06_07]]

**Still pending:** BC asks in `docs/BC_SHN_PARTNER_SHAPE.md` (#77-Q6 model partners,
#77-Q4 expose names) to fully shift identity/offer to BC. (All 7 sheet tokens are
wired; consumer bundle needs deploy to ship them.)
