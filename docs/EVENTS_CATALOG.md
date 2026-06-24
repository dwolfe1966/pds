# IDLookup — Event Tracking Catalog

**Audience:** Jerome (reporting) + anyone configuring GTM/GA4.
**Last updated:** 2026-06-24 (consumer bundle `public.aec403bb.js`).
**Owner note:** this is the source-of-truth list of *what events we emit and where they go*. Keep it in sync when events are added/changed.

---

## 1. The three emission surfaces (who sends what, to where)

| # | Code | Destination(s) | Purpose |
|---|------|----------------|---------|
| **A** | `src/services/trackingService.js` → `track(name, props)` | **(1) BC tracking API** as `CLIENT:<name>` (via `apiWrapper.api.tracking.create`), queryable in admin via `csrWrapper.api.tracking.findUser`. **(2) `window.dataLayer`** as `client_<name>` → GTM → GA4. **(3)** dev-only NDJSON mirror (`localhost:3002`). | Product/funnel telemetry. Rich, high-volume. |
| **B** | `src/services/gtm.js` → `gtmEvent(...)` | `window.dataLayer` → GTM → **GA4 + Google Ads** | **Canonical conversion events.** These are what Google Ads keys on. Keep clean. |
| **C** | `src/services/gtmContext.js` → `push(...)` | `window.dataLayer` → GTM | Page/context events carrying the 27 canonical GTM fields. |

> **Why two dataLayer event namespaces?** Surface **A** pushes events prefixed **`client_`** (e.g. `client_search_step`). Surface **B** pushes the **unprefixed canonical** names (`purchase`, `sign_up`, …). This is deliberate: it stops high-volume funnel telemetry from colliding with — and double-counting — the conversion events, and avoids GA4's reserved `page_view`. **In GTM: build conversion triggers on the unprefixed names only.**

---

## 2. ⚠️ PII boundary (read before wiring GA4)

The dataLayer push from surface **A** is **curated and PII-free by construction**. It sends only:

- `event` (`client_*`), `trackingSessionId`
- `actor` (`visitor` | `member`), `loggedIn` (bool), `userId` (pseudonymous — maps to GA4 `user_id`)
- attribution: `partnerName`, `partnerChannel`, `shn`, `shl`, `shnName`
- event-specific dims (`step`, `search_type`, `variant`, …)

It does **NOT** send `email`, `phone`, `zip`, `firstName`, `lastName`, or any `target*` / `search*` (the searched person). Those live in the GTM canonical state (surface **C**) but are **never** forwarded by surface A.

**Rule for GA4 config:** never map `email`/`phone`/`zip`/name fields into GA4 parameters. Sending PII to GA4 is a Google ToS violation and can get the property suspended.

---

## 3. The `actor` dimension — visitor vs member

Every surface-A event carries `actor` (and `loggedIn`):

- `actor: 'visitor'` — not logged in. Search happened **before signup/payment**.
- `actor: 'member'` — logged in (`accessToken` present). Search happened **after login**.

This is stamped at the source on **every** `CLIENT:*` event (BC stream) and every `client_*` event (GA4 stream). No need to infer from surrounding events.

> We do **not** split out a `subscriber`/paid bucket. Derived paid state (BC `billing.getOrders()`) is not cached client-side, so member-vs-visitor is the dimension we report on. (Decision: 2026-06-24.)

---

## 4. Surface A — `track()` events (BC + `client_*` to GA4)

Each appears in BC as `CLIENT:<name>` and in GA4 as `client_<name>`. All carry the common envelope: `sessionId`/`trackingSessionId`, `timestamp`, `actor`, `loggedIn`, `userId?`, `refer`/attribution.

### Funnel — landing pages (the paid ad units)

| Event | Fired when | Key dims |
|-------|-----------|----------|
| `landing_view` | Landing page mount | `search_type` (name/phone/email/home), `variant` (v1–v6) |
| `search_step` | Each step transition in the multi-step funnel | `step`, `search_type`, `variant` |
| `fcra_agree` | User checks the FCRA agreement + continues | `search_type`, `variant` |
| `search_submit` | Search form submitted | (see gtm.js canonical too) |
| `search_failed` | Search threw / no results path | — |
| `results_view` / `teaser_view` | SRP / teaser rendered | — |
| `result_click` | A result card clicked | — |
| `load_more` / `search_load_more` | "Load more" on SRP | `page` |

**`search_step` step taxonomy** (the `step` value identifies the logical page):

| `search_type` | Step sequence |
|---------------|---------------|
| `name` | `searching-one` → `location` → `searching-two` → `details` → `confirm` → `final-search` |
| `phone` | `searching-one` → `location` → `confirm` → `final-search` |
| `email` | `searching-one` → `context` → `confirm` → `final-search` |

> **Unique page identity** = `search_type` + `variant` + `step`. E.g. `{search_type:'name', variant:'v3', step:'location'}` is exactly one logical page in one ad-unit variant. `v1` landings are single-step (no `search_step`); they emit `landing_view` then hand off downstream.

### Signup / payment / account

| Event | Fired when |
|-------|-----------|
| `signup_start` / `signup_complete` / `signup_error` | Signup funnel |
| `payment_start` / `payment_complete` / `payment_error` | Checkout |
| `login` / `login_error` / `logout` | Auth |
| `subscription_keep` / `subscription_cancel` | Manage-subscription |
| `cancel_lightbox_view` | Cancel-flow lightbox shown |

### Member dashboard

| Event | Fired when |
|-------|-----------|
| `dashboard_view` | Dashboard mount |
| `dashboard_cta_click`, `dashboard_upgrade_click`, `dashboard_report_open`, `dashboard_pdf_download`, `dashboard_inline_search_submit` | Dashboard interactions |
| `report_view` | Report detail viewed |
| `watchers_view`, `watchers_tab_change`, `watchers_csv_export` | Watchers feature |
| `page_view` | Generic page view (surface A; GA4 sees it as `client_page_view`, NOT the reserved `page_view`) |

---

## 5. Surface B — `gtm.js` canonical conversion events (GA4 + Google Ads)

Unprefixed; these are the **conversion events**. Build Ads conversions / GA4 key events on these.

| Event | Maps to | Fired when |
|-------|---------|-----------|
| `virtualPageview` | GA4 page_view (SPA route change) | Every route change |
| `search_submit` | — | Search submitted |
| `teaser_view` | — | Teaser/SRP shown |
| `payment_start` | begin_checkout | Checkout entered |
| `purchase` | **purchase (conversion)** | `billing.sale` success |
| `sign_up` | **sign_up (conversion)** | Account created |
| `login` | login | Login success |
| `select_content` | select_content | Result selected |

Each carries the 27 canonical GTM fields (incl. `orderId`, `transactionAmount`, `transactionCurrency`, partner/shn). **Note:** this surface DOES carry identity/target fields in the dataLayer state — do not blanket-forward all dataLayer variables to GA4; forward an explicit safe allowlist.

---

## 6. Session / join keys

| Key | Set by | Scope | Notes |
|-----|--------|-------|-------|
| `trackingSessionId` | trackingService (`sessionStorage.trackingSessionId`) | tab session | Primary join key. Present on BC events **and** on `client_*` dataLayer events. |
| `sessionId` (UUID) | gtmContext (`sessionStorage.gtmDataLayerState.sessionId`) | tab session | GTM/GA4-side id on surface B/C events. |
| `userId` | from `localStorage.user` when logged in | — | Pseudonymous; GA4 `user_id`. |

To join BC telemetry ↔ GA4 funnel events, use **`trackingSessionId`** (shared on both). To join to conversions (surface B), bridge via `userId` / `orderId`.

---

## 7. Known gaps / roadmap (for reporting design)

1. **`variant` → conversion attribution: DONE for surface A, PENDING for surface B.**
   - The landing entry point (`search_type` + `variant`) is persisted to sessionStorage at landing (`funnel.variant` / `funnel.searchType`) and **auto-stamped on every surface-A `track()` event** — including `signup_complete` / `payment_complete` / `dashboard_*`. So `client_*` GA4 events and BC events now carry the ad-unit variant end-to-end. Session-scoped, last-touch (latest landing wins).
   - **Still pending:** the surface-B Google Ads conversion events (`purchase`, `sign_up`) do **not** carry `variant` yet — that requires adding it to the `gtm.js` push payload (a deliberate, explicit change to the conversion-event shape; not done without sign-off). Until then, attribute Ads conversions to variant by joining surface-B `purchase` ↔ surface-A `client_payment_complete` on `trackingSessionId`/`userId`.
2. **GA4 property not yet created.** The `client_*` stream is flowing to `window.dataLayer` now, but there is no GA4 destination wired in GTM yet (task in progress). Google Ads gtag (`AW-18044069648`) is currently disabled.
3. **Two session ids** (see §6) — unify post-launch if it simplifies Jerome's joins.
