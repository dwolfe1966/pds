# GA4 Setup — idlookup.ai (GTM container `GTM-THCSBJWN`)

**Scope (2026-06-24):** idlookup.ai only. GA4 property + measurement ID already exist (you have the `G-XXXXXXXXXX`). Other brands (peoplesearcher.ai, inmatefinderhub.com) later — repeat this in their containers with their own G- id.

**No code changes needed.** The app already pushes everything to `window.dataLayer`. This is 100% GTM + GA4 console config. See `docs/EVENTS_CATALOG.md` for the full event/param inventory this guide wires up.

> Replace `G-XXXXXXXXXX` below with idlookup.ai's measurement ID.

---

## 0. The one gotcha — SPA page_view (read first)

`src/components/ScrollToTop.js` fires a `virtualPageview` dataLayer event on **every** route change **including the first load**. If you also let the GA4 config tag send its automatic page_view, the first pageview is **double-counted**.

**Fix:** turn OFF the config tag's automatic page_view, and send `page_view` exclusively from a GA4 Event tag triggered on `virtualPageview` (step 3C). Result: exactly one page_view per route.

---

## 1. dataLayer variables to create (GTM → Variables → New → Data Layer Variable)

Create one DLV per row (name it `DLV - <key>`, Data Layer Variable Name = the key).

| Key | Used by | Notes |
|-----|---------|-------|
| `pagePath` | page_view | route path |
| `value` | purchase | numeric revenue |
| `currency` | purchase | e.g. USD |
| `items` | purchase | GA4 items array |
| `orderId` | purchase | → GA4 `transaction_id` |
| `offer_key` | purchase / payment_start | plan id |
| `method` | sign_up / login | e.g. email |
| `funnel_variant` | **all surface-B** | ad-unit variant (v1–v6) — conversion attribution |
| `funnel_search_type` | **all surface-B** | name/phone/email — conversion attribution |
| `user_status` | all surface-B | member/guest |
| `result_count` | search_submit / teaser_view | |
| `content_type`, `content_id` | select_content | |
| `actor` | all `client_*` | visitor/member |
| `variant`, `search_type`, `step` | `client_*` funnel | unique page identity |
| `partnerName`, `partnerChannel`, `shn`, `shl`, `shnName` | both streams | partner attribution |
| `userId` | both streams | → GA4 `user_id` (pseudonymous, OK) |
| `trackingSessionId` | both streams | BC↔GA4 join key |

> ⚠️ **Do NOT create or forward** `email`, `phone`, `zip`, `firstName`, `lastName`, or any `target*` / `search*` (the searched person). They exist in the dataLayer state (surface C) but must never reach GA4 — Google ToS / suspension risk. Only map the allowlist above.

---

## 2. Triggers (GTM → Triggers → New → Custom Event)

| Trigger name | Event name (regex off unless noted) |
|---|---|
| `CE - virtualPageview` | `virtualPageview` |
| `CE - purchase` | `purchase` |
| `CE - sign_up` | `sign_up` |
| `CE - login` | `login` |
| `CE - search_submit` | `search_submit` |
| `CE - payment_start` | `payment_start` |
| `CE - select_content` | `select_content` |
| `CE - teaser_view` | `teaser_view` |
| `CE - client funnel (all)` | `client_.*` — **check "Use regex matching"** |

---

## 3. Tags (GTM → Tags → New)

### 3A. GA4 Configuration — "Google Tag"
- Tag type: **Google Tag**, Tag ID = `G-XXXXXXXXXX`
- Trigger: **Initialization - All Pages**
- Configuration settings:
  - `send_page_view` = **false** (the gotcha fix — we send page_view via 3C)
  - (optional) `user_id` = `{{DLV - userId}}` for cross-device stitching
- Shared event parameters (so every GA4 hit carries attribution):
  - `funnel_variant` = `{{DLV - funnel_variant}}`
  - `funnel_search_type` = `{{DLV - funnel_search_type}}`
  - `partner_name` = `{{DLV - partnerName}}`, `partner_channel` = `{{DLV - partnerChannel}}`
  - `shn` = `{{DLV - shn}}` (and shl/shnName if you want them on every hit)

### 3B. page_view  (GA4 Event)
- Type: **GA4 Event**, Config tag: the Google Tag above (or set Measurement ID directly)
- Event name: `page_view`
- Parameter: `page_path` = `{{DLV - pagePath}}`
- Trigger: `CE - virtualPageview`

### 3C. Conversion events (GA4 Event) — one tag each

| Tag | Event name | Key params | Trigger |
|---|---|---|---|
| GA4 - purchase | `purchase` | `transaction_id`={{DLV - orderId}}, `value`={{DLV - value}}, `currency`={{DLV - currency}}, `items`={{DLV - items}}, `funnel_variant`, `funnel_search_type` | `CE - purchase` |
| GA4 - sign_up | `sign_up` | `method`={{DLV - method}}, `funnel_variant`, `funnel_search_type` | `CE - sign_up` |
| GA4 - login | `login` | `method` | `CE - login` |
| GA4 - search_submit | `search` | `search_type`, `result_count` | `CE - search_submit` |
| GA4 - begin_checkout | `begin_checkout` | `offer_key`, `funnel_variant` | `CE - payment_start` |
| GA4 - select_content | `select_content` | `content_type`, `content_id` | `CE - select_content` |

### 3D. Funnel telemetry (GA4 Event) — single catch-all
- Type: GA4 Event
- Event name: `{{Event}}` (GTM built-in variable = the dataLayer event name, e.g. `client_search_step`)
- Params: `actor`={{DLV - actor}}, `variant`={{DLV - variant}}, `search_type`={{DLV - search_type}}, `step`={{DLV - step}}, `tracking_session_id`={{DLV - trackingSessionId}}
- Trigger: `CE - client funnel (all)`
- (Enable the `{{Event}}` built-in variable under Variables → Configure.)

---

## 4. Mark Key Events (conversions) — GA4 console
GA4 → Admin → **Key events** → mark `purchase` and `sign_up` (and `begin_checkout` if you want it). These become the optimization targets you can import into Google Ads.

---

## 5. QA before publishing (GTM Preview + GA4 DebugView)
1. GTM → **Preview**, enter `https://www.idlookup.ai/name/landing/v3` (or any funnel).
2. Walk a full funnel: land → steps → signup → payment.
3. In GTM Preview, confirm each event fires its tag and the params resolve (not `undefined`).
4. GA4 → Admin → **DebugView**: confirm `page_view`, `client_search_step` (with `variant`/`actor`), `sign_up`/`purchase` (with `funnel_variant`/`funnel_search_type`).
5. **PII check:** inspect a few hits in DebugView — confirm NO `email`/`phone`/`zip`/name params are present. If any appear, you mapped a forbidden variable — remove it.

## 6. Publish
GTM → **Submit** → version name "GA4 idlookup.ai go-live" → Publish.

---

## Notes
- This wires idlookup's container only. peoplesearcher.ai (`GTM-PBFRPKNX`) and inmatefinderhub.com (`GTM-TF6NWS79`) need the same build with their own G- ids when you're ready.
- Google Ads conversion gtag (`AW-18044069648`) is currently disabled in `index.html` — separate from GA4. Re-enable / re-point per the ads-conversion plan when ready.
- `client_*` events are intentionally separate from the canonical conversion events so funnel telemetry never inflates conversion counts.
