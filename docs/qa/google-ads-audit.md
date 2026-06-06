# Google Ads / conversion-tracking audit (consumer site)

Audit of the Google Ads setup promoting the consumer site, across three layers:
website code → GTM container → Google Ads account.

## Layer 1 — Website / code  *(audited 2026-06-06)*

**✅ Conversion events wired** (`src/services/gtm.js` + callers): `search_submit`
(name/phone/email loaders), `teaser_view` (SUP), `select_content` (ResultCard),
`payment_start` + `purchase` (PaymentPage `:495`, VariantB `:234`), `sign_up`
(useSignup). `gclid` captured first-touch (`captureReferralParams`, sessionStorage
`referralParams`) and attached to EVERY dataLayer push via `baseContext()`.
`purchase` carries `value` / `currency` / `items`.

**🔴 FIXED (c936086) — GTM was double-loaded.** Per-brand snippet in
`public/index.html` (hostname → container) AND `initGtm()` via
`REACT_APP_GTM_ID=GTM-WV7N6WWP` (the DEV container). Net: dev loaded WV7N6WWP
twice; prod fired prod `THCSBJWN` + dev `WV7N6WWP` → duplicated / cross-polluted
Ads conversions. Fixed: index.html is now the sole loader; `initGtm()` is a no-op;
`REACT_APP_GTM_ID` removed from `.env.production`.

**🟡 OPEN — `purchase` has no `transaction_id`.** `gtmPurchase` sends value/currency/
items but no order id, so Google Ads can't dedupe conversions per order
(refresh/retry can double-count). Recommend passing the BC `orderId` as
`transaction_id` (PaymentPage already has `verifiedOrder`). Pairs with the GTM
conversion-tag dedup setting (Layer 2) — do them together.

**Per-brand GTM containers** (public/index.html): idlookup.ai → `GTM-THCSBJWN`,
dev.www.idlookup.ai → `GTM-WV7N6WWP`, peoplesearcher.ai → `GTM-PBFRPKNX`,
inmatefinderhub.com → `GTM-TF6NWS79`.

## Layer 2 — GTM container *(need export)*
The Google Ads conversion tags/triggers live in the container, not the code.
**Export:** GTM → Admin → **Export Container** → pick the **published version** of
`GTM-THCSBJWN` (prod) → save the JSON (drop at `docs/ads/gtm-THCSBJWN.json`).
**I'll check:** Google Ads Conversion Tracking + Conversion Linker tags present;
which dataLayer events trigger `purchase`/`sign_up`; conversion ID + label correct;
value/currency mapped from the dataLayer; `transaction_id` wired for dedup;
enhanced conversions (hashed email/phone) configured; no duplicate/test tags.

## Layer 3 — Google Ads account *(need exports)*
**Export / note these:**
1. **Settings → Account → Auto-tagging** ON/OFF (must be ON so `gclid` lands).
2. **Goals → Conversions** — export the conversion actions table (name, category,
   source, **attribution model**, count, value, status, include-in-"Conversions").
3. **Campaigns** — export campaigns + ad groups (status, budget, bid strategy,
   **Final URL** / tracking template — confirm ads land on `/name/landing/v3?shn=
   6a22ff83…` carrying `?shn=` + gclid).
4. **Keywords** (the inmate-search terms) — export for the inmate campaign(s).
5. (Optional) Account overview / change history.
**I'll check:** auto-tagging on; one purchase + one signup conversion action, right
category/attribution, no duplicates; final URLs carry `?shn=` so the funnel resolves
the partner; tracking template doesn't strip gclid; keyword↔landing alignment.

## Layer 2 — GTM container `GTM-THCSBJWN` *(audited 2026-06-06, workspace 3)*
2 tags: **Adwords Conversion Linker** (All Pages + History Change) ✅ and **Adwords
Pixel Signup Conversion** (id `18044069648`, label `6CztCM_GgZUcEJDOipxD`).

**🔴 P0 — the conversion will never fire.** The conversion tag triggers ONLY on a
PAGEVIEW of `//www.idlookup.ai/pixelforsignup?type=pixel` (partner-gated). **The site
has no `/pixelforsignup` page** (grep: 0 matches) — the React app stays in the SPA and
pushes `purchase`/`sign_up` dataLayer events instead, which NO tag listens to. Code and
container were built to different specs. *Data layer DOES align otherwise:* gtmContext
pushes the canonical keys the tag reads (`transactionAmount`, `transactionCurrency`,
`partnerName`, `partnerChannel`, `sessionId`, `orderId`). **Fix (recommend):** re-point
the conversion tag to a CUSTOM_EVENT trigger on the `sign_up` (and/or `purchase`)
dataLayer event — the code already emits it with the canonical fields. (Alternative:
build a real `/pixelforsignup` confirmation page — more work, matches the as-built tag.)

**🟡 conversion gating** — fires only for partnerName/channel ∈ {Google/Search,
Internal/Cascade Decliner, Internal/Cascade Exit}. Google Inmates Upper (Google/Search)
is covered; default/other traffic won't convert (confirm intentional). A generic
"Sales Confirmation" trigger exists but isn't attached to the tag.

**🟡 orderId = `{{Variable - Session ID}}`** for dedup — should be the BC orderId
(gtmContext exposes `orderId`); session id can span 0/many orders.

**🟡 no GA4 tag** in this container (only the 2 Adwords tags) — the code's GA4-style
events (`purchase`, `view`, etc.) aren't measured here. Confirm GA4 lives elsewhere.

## Layer 3 — Google Ads account *(audited 2026-06-06 — 8 campaigns, all Paused = pre-launch ✓)*

**🔴 P0 — final URLs carry NO `?shn=`.** Zero ads pass a shN token, so the partner
funnel (landing v3 / SUP variant / opt-out / partner attribution for `6a22ff83…`)
never activates. The "Inmate Search - Upper Quadrant" campaign (= Google Inmates Upper)
must put `?shn=6a22ff83ca16ad4ef68b84b5` on its final URL (or a tracking template).

**🔴 P0 — campaigns point to domains OUTSIDE our funnel + GTM:**
`www.inmatessearcher.com` and `www.privaterecords.net` are NOT in the GTM per-brand
map (idlookup.ai / peoplesearcher.ai / inmatefinderhub.com) and aren't the funnel we
built — so that paid traffic has **no tracking and no shN funnel**. Affected:
"Inmates (PR - IS) Lower/Upper HHI", "LE - Death/Divorce". Decide: repoint to
idlookup.ai, or are these separate (legacy) sites?

**🟡 P1 — dev domain in final URLs.** "Campaign #1" and "Inmate Search - Upper
Quadrant" use `dev.www.idlookup.ai` — must be `www.idlookup.ai` (prod) before unpause.

**Campaign → domain map:**
- Campaign #1 → dev.www.idlookup.ai
- Inmate Search - Upper Quadrant → dev + www.idlookup.ai
- Inmates (PR - IS) Lower HHI → idlookup.ai + **inmatessearcher.com**
- Inmates (PR - IS) Upper HHI → idlookup.ai + **inmatessearcher.com + privaterecords.net**
- LE - Death/Divorce (Upper/Lower) → idlookup.ai + **privaterecords.net**

(Auto-tagging ON / conversion-actions list weren't in this campaign-structure export —
confirm auto-tagging is ON in Settings, and that a Signup conversion action exists and
is tied to id `18044069648` / label `6CztCM_GgZUcEJDOipxD`.)

## Status
- Layer 1: ✅ audited; double-load FIXED (c936086); `transaction_id` open.
- Layer 2: ✅ audited — P0 conversion-trigger mismatch (pixelforsignup vs dataLayer event).
- Layer 3: ✅ audited — P0 no `?shn=` in final URLs + off-funnel domains; P1 dev URLs.

