# GA4 — Build Checklist (get conversions into GA4)

**Container:** `GTM-THCSBJWN` (idlookup.ai). **GA4 property:** `G-P5GFMP05TS`.
**Why:** audit found GA4 gets `page_view` only — no event tags exist, so `purchase`/`sign_up`/funnel never reach GA4. This builds them. **No code changes** — the app already pushes everything to the dataLayer.

> Do **Phase 1 first** — it's the whole point (conversions in GA). Phases 2–3 are the funnel/polish.

---

## PHASE 1 — The conversion (`purchase` → GA4) ← do this first

### 1a. Data Layer Variables  (GTM → Variables → New → "Data Layer Variable")
Create these (name them `DLV - <x>`, **Data Layer Variable Name** = the value):

| Variable | Data Layer Variable Name |
|---|---|
| `DLV - value` | `value` |
| `DLV - currency` | `currency` |
| `DLV - orderId` | `orderId` |
| `DLV - items` | `items` |

### 1b. Trigger  (GTM → Triggers → New → "Custom Event")
- Name: `CE - purchase`
- Event name: `purchase`  (exact, regex OFF)

### 1c. Tag  (GTM → Tags → New → "Google Analytics: GA4 Event")
- Name: `GA4 - purchase`
- **Measurement ID:** `G-P5GFMP05TS`  (type it in the tag; you don't need a separate config tag)
- **Event Name:** `purchase`
- **Event Parameters:**
  - `transaction_id` = `{{DLV - orderId}}`
  - `value` = `{{DLV - value}}`
  - `currency` = `{{DLV - currency}}`
  - `items` = `{{DLV - items}}`
- **Trigger:** `CE - purchase`

### 1d. Mark it a Key Event  (GA4 Admin, NOT GTM)
GA4 → Admin → **Key events** → mark **`purchase`**. (In GA4, "conversion" = "key event".) Without this, GA4 records the event but won't show it as a conversion.

### 1e. QA before publishing
1. GTM → **Preview**, open the site.
2. Walk a real (or $1 test) purchase to the success screen.
3. In GTM Preview, confirm **`GA4 - purchase` fired** on the `purchase` event, with `transaction_id`/`value`/`currency` populated (not undefined).
4. GA4 → Admin → **DebugView** (or Reports → Realtime): confirm the `purchase` event arrives with the value.
5. **PII check:** make sure no `email`/`phone`/name params are on the event.

✅ After Phase 1 + publish, conversions show in GA4 (allow up to ~24h for non-realtime reports).

---

## PHASE 2 — Other conversions + funnel

### 2a. `GA4 - sign_up`
- Trigger: `CE - sign_up` (Custom Event = `sign_up`).
- GA4 Event tag, Measurement ID `G-P5GFMP05TS`, event name `sign_up`, param `method` = `{{DLV - method}}` (DLV name `method`).
- Mark `sign_up` a Key Event in GA4 Admin.

### 2b. Funnel events (the `client_*` stream) — one catch-all
- Enable the built-in **`{{Event}}`** variable (Variables → Configure → check `Event`).
- Trigger: `CE - client funnel` = Custom Event, event name `client_.*`, **Use regex matching ON**.
- Tag: GA4 Event, Measurement ID `G-P5GFMP05TS`, **Event Name = `{{Event}}`**, params: `search_type`={{DLV - search_type}}, `variant`={{DLV - variant}}, `step`={{DLV - step}}, `actor`={{DLV - actor}}, `step_duration_ms`={{DLV - step_duration_ms}}, `reason`={{DLV - reason}} (create those DLVs). Trigger: `CE - client funnel`.
- This lands the whole funnel (`client_landing_view`, `client_search_step`, `client_validation_error`, …) in GA4 for funnel exploration.

---

## PHASE 3 — SPA page_view (so funnel-step routes count)

⚠️ **Double-count caution.** GA4 currently gets the *initial* `page_view` automatically (via the Google tag's GA4 link). Our SPA fires `virtualPageview` on every route change **including the first**. So if you add a `page_view`-on-`virtualPageview` tag without disabling the auto one, the first pageview double-counts.

Recommended: add a dedicated **GA4 Configuration / Google Tag** for `G-P5GFMP05TS` with **`send_page_view = false`**, then a **`GA4 - page_view`** event tag triggered by `CE - virtualPageview` (Custom Event = `virtualPageview`), param `page_path` = `{{DLV - pagePath}}`. That gives exactly one page_view per route. (If you'd rather not touch the existing Google-tag page_view, skip the page_view event tag and accept that only the first pageview is counted — conversions in Phase 1 are unaffected.)

---

## Publish
GTM → **Submit** → version "GA4 events: purchase + funnel" → **Publish**.

## Notes
- Conversion **value**: GA4 uses our `value` (the real trial price) — good. (Separately, the *Google Ads* `__awct` tag reads `transactionAmount`/default $1 — a different fix; see the Ads workflow.)
- Full reference + the variable-to-param map: `docs/GA4_SETUP.md` and `docs/EVENTS_CATALOG.md`.
