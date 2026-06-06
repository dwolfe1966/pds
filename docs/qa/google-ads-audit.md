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

## Status
- Layer 1: audited; double-load fixed; `transaction_id` open.
- Layer 2/3: awaiting exports (GTM container JSON + Ads exports). Drop under `docs/ads/`.
