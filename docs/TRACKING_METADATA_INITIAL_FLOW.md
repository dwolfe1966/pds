# Tracking Metadata — Initial Flow (Landing → Onboarding → Search → Signup → Pay)

**Purpose:** for the BC reporting discussion. Part 1 = what we send on each BC tracking call today. Part 2 = parameters we do *not* send today but may want, for analysis. Companion to `docs/EVENTS_CATALOG.md` (full taxonomy + `trackings` schema).

**Two send paths** (this doc is about the **BC** one):
- **BC tracking** — `trackingService.track()` → `apiWrapper.api.tracking.create({ type: "CLIENT:<name>", ... })`. Lands in the `trackings` collection. ← *this doc*
- GA4/Ads — a parallel `window.dataLayer` push (`gtm.js`); not covered here.

---

## Part 1 — What we send today

### 1a. The universal envelope (on EVERY BC `track()` call)

| Field | Source | Notes |
|---|---|---|
| `type` | event name | `CLIENT:<name>` (e.g. `CLIENT:landing_view`) |
| `sessionId` / `trackingSessionId` | client, per-tab | join key |
| `timestamp` | client | ISO 8601 |
| `actor` | client | `visitor` \| `member` — pre-signup vs post-login |
| `loggedIn` | client | bool |
| `userId` | client | only once authenticated (pseudonymous) |
| `search_type` | client (funnel entry) | enum `name\|phone\|email\|home` — stamped on every event from the landing |
| `variant` | client (funnel entry) | `vN` — the ad-unit LP the visitor arrived on |
| `refer` | client (first-touch) | attribution object — see 1b |

**BC enriches server-side** (from your schema, we don't set these): `_from`, `value.{referer, device, url, method, duration, ip, userAgent, brandId, hostname}`, `caller`, `trackingIds.{clientId, sessionId, trackingId, apiId}`, `shConId / shColId / shTimestamp`, `brandId`.

### 1b. Attribution (`refer.*`) — first-touch, on every event

`source` (from `utm_source`), `gclid`, `fbclid`, `msclkid`, `utm_medium`, `utm_campaign`, **`utm_term`** (keyword), **`utm_content`** (creative), `refer_partnerId`, `refer_afid`, `refer_abc`, `shn`, `shl`, `shnName`, `partner`, `channel`.

### 1c. Per-event properties (initial flow)

| Stage | Event (`CLIENT:*`) | Extra properties (on top of the envelope) | Notes |
|---|---|---|---|
| **Landing** | `landing_view` | `search_type`, `variant` | one per LP view |
| **Onboarding (wizard)** | `search_step` | `step`, `search_type`, `variant`, **`step_duration_ms`** | `step` ∈ `searching-one, location, searching-two, details, context, confirm, final-search`. `step_duration_ms` = time on the previous step (added centrally). |
| | `fcra_agree` | `search_type`, `variant` | FCRA checkbox accepted |
| | `validation_error` | `reason`, `step` (+envelope) | drop-off cause: `reason` ∈ `fcra_not_agreed, state_required, name_required, invalid_phone, invalid_email`. **Note:** first-step empty-field gates (name/phone/email) are caught by native HTML5 `required`/disabled buttons before JS runs, so those rarely emit; the button-type gates (`fcra_not_agreed`, `state_required`) do emit reliably. |
| **Search** | `search_submit` | `type` (=search_type), `resultCount` | fired from the loader after results return |
| | `search_failed` | `type`, `errorMessage` | error path |
| **Results / Teaser (SRP)** | `results_view` | `search_type`, **`query`** ⚠️PII, `state` | `query` = the raw searched value (name/phone/email) |
| | `teaser_view` | `personId` | teaser identity shown |
| | `result_click` | `resultId`, **`personName`** ⚠️PII, `searchType`, `source` | `personName` masked on phone SRP, full name elsewhere |
| | `load_more` / `search_load_more` | `page` / `resultsSoFar` | pagination |
| **Signup** | `signup_complete` | `source`, `search_type`, `userId` | credentials accepted — **NOT the sale** |
| **Pay** | `payment_complete` | `plan`, `source` | |
| | `payment_error` | `errorType`, `errorMessage`, `errorStatus` | |

**Correction:** `signup_start` (SignupPage) and `payment_start` (PaymentPage) **ARE** sent on the BC path (in `useEffect`s) — earlier draft said otherwise.

**Remaining gap:** `results_view`/`teaser_view` don't carry `resultCount` (only `search_submit` does).

### Implemented 2026-06-26 (the "why" instrumentation)
- `utm_term` + `utm_content` now captured in `refer` (keyword/creative-level analysis).
- `step_duration_ms` on every `search_step` (time-on-step → friction).
- `validation_error{reason, step}` at the reachable funnel gates (`fcra_not_agreed`, `state_required` reliably; first-step `required`/disabled gates are native-handled).
- `password_too_short` / `invalid_email` validation_errors on signup.

---

## Part 2 — Parameters we don't send today, but may want

Ranked roughly by analytical value. ⚠️ = PII / privacy care needed.

### A. Funnel velocity & friction (highest value for CRO)
| Candidate | Why it's useful |
|---|---|
| `step_duration_ms` (per `search_step`) | time spent on each wizard step → pinpoint the slow/friction steps. (BC has a `value.duration` but not explicit per-step entry→exit.) |
| `time_to_first_input_ms` (on landing) | landing → first keystroke → distinguishes "bounced" from "engaged but abandoned." |
| `step_index` / `total_steps` | clean "3 of 4" progress dimension without inferring from `step` names. |
| `scroll_depth_pct` (landing) | LP engagement / above-the-fold effectiveness. |

### B. Drop-off diagnosis (the *why* behind abandonment)
| Candidate | Why |
|---|---|
| `validation_error` event w/ `reason` (e.g. `fcra_not_agreed`, `password_too_short`, `invalid_email`, `state_required`) | tells you *why* people stall at a step, not just that they did. |
| `back_navigation` / `step_revisit` | confusion / second-guessing signal. |
| `abandon` (on page exit) w/ `last_step` | where exactly they leave the funnel. |
| `retry_count` | repeated failed attempts (search/payment). |

### C. Search context (mostly non-PII derivations)
| Candidate | Why |
|---|---|
| `result_count` on `results_view`/`teaser_view` | "0 results" vs "many" drives the next-step behavior; today only on `search_submit`. |
| `result_rank` / `clicked_position` on `result_click` | CTR by position → ranking quality. |
| `zero_state` / `thin_match` flag | which payoff the user saw (full SRP vs thin-match) — drives the paywall/pricing path. |
| `query_shape` (non-PII): `has_middle_name`, `has_city`, `query_length`, `state` | analyze input completeness **without** storing the raw PII query. (Could replace the PII `query`/`personName` fields above with these.) |
| `searches_in_session` | multi-search behavior / intent strength. |

### D. Offer & monetization
| Candidate | Why |
|---|---|
| `offer_key` / `price_shown` / `plan` on `payment_start` + at teaser | which offer/price the user was shown → enables price A/B analysis. |
| `payment_method_type` (card brand only, never PAN) | checkout success by method. |
| `trial_terms_shown` | which trial framing converted. |

### E. Acquisition / attribution (cheap wins — extend `refer`)
| Candidate | Why |
|---|---|
| **`utm_term`** | **the keyword.** Jerome's own example URL had `utm_term=arrest+records` — we capture `utm_source/medium/campaign` but **drop `utm_term`**, so we can't do keyword-level conversion analysis today. High-value, near-zero effort. |
| **`utm_content`** | ad-creative / A-B at the ad level. Same gap as `utm_term`. |
| `landing_url` / full `referrer` | exact entry point + organic referrer. |
| `device_type` bucket (mobile/tablet/desktop) | explicit device split (BC has raw `userAgent`/`device`; a clean bucket is easier to group). |
| `new_vs_returning` | cohort the funnel by first-time vs repeat visitor. |

### F. Identity / experimentation
| Candidate | Why |
|---|---|
| `ab_test_id` + `ab_variant` (beyond LP `variant`) | if multiple concurrent experiments run, distinguish them from the ad-unit variant. |
| partner sub-IDs at finer grain | already have `refer_partnerId/afid/abc`; confirm they cover sub-publisher needs. |

---

## Recommendations (quick wins to raise first)
1. **Capture `utm_term` + `utm_content`** in `refer` — trivial change, unlocks keyword/creative-level analysis. (Biggest value-to-effort.)
2. **Add `signup_start` + `payment_start` on the BC path** — closes the two biggest funnel-measurement gaps (credentials-abandon, checkout-abandon).
3. **Add `step_duration_ms` + `validation_error{reason}`** — turns the funnel from "where do they drop" into "why."
4. **Swap the PII `query`/`personName` fields for non-PII `query_shape`** unless BC specifically needs the raw value for matching/audit (it already has it server-side).
