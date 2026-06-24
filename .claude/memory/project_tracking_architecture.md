---
name: project_tracking_architecture
description: "Consumer event-tracking architecture — three surfaces, actor dimension, client_ dataLayer namespace, PII boundary, catalog location"
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

Consumer tracking has **three emission surfaces** (full inventory in `docs/EVENTS_CATALOG.md` — the source of truth, written for Jerome/reporting; keep in sync when events change):

- **A. `trackingService.track(name, props)`** → BC tracking API as `CLIENT:<name>` + dev NDJSON + (as of 2026-06-24) `window.dataLayer` as `client_<name>` → GTM → GA4.
- **B. `gtm.js` `gtmEvent()`** → dataLayer canonical conversion events (`purchase`, `sign_up`, `login`, `search_submit`, `payment_start`, `select_content`) — what Google Ads keys on.
- **C. `gtmContext.push()`** → dataLayer with the 27 canonical fields (carries identity/target PII).

Key decisions (2026-06-24, commit 4434e0b):
- **`actor` dimension**: every event stamps `actor` ('visitor'|'member') + `loggedIn` + `userId`. Distinguishes pre-signup from post-login searches at the source. NO 'subscriber'/paid bucket — derived paid state (BC `billing.getOrders()`) isn't cached client-side. [[feedback_subscription_state_authority]]
- **`client_` namespace on the GA4 bridge**: surface-A events go to dataLayer prefixed `client_` so funnel telemetry never collides with surface-B conversion events or GA4's reserved `page_view` (would double-count conversions).
- **PII boundary**: the bridge pushes a CURATED object (event/actor/userId/attribution/dims + `trackingSessionId`) directly to dataLayer — deliberately NOT via `gtmContext.push()`, which force-merges email/phone/zip/target*/search* (GA4 ToS / suspension risk). When wiring GA4, never map PII fields.
- **Unique funnel page identity** = `search_type` + `variant` + `step`. `search_step`/`fcra_agree` across all 15 V2–V6 funnels carry `variant`; V1 landings are single-step (covered by `landing_view`).
- **Session join key**: `trackingSessionId` is present on both BC events and `client_*` dataLayer events. GTM has its own UUID `sessionId` (gtmDataLayerState) — two ids by design.

**Variant→conversion attribution (commit 326d974, 2026-06-24)**: DONE for surface A. `persistFunnelEntry()` saves `funnel.variant`/`funnel.searchType` to sessionStorage at landing (useLandingTrack + NameSearchLandingPage); `funnelContext()` auto-stamps them on EVERY track() event (BC + client_* dataLayer + NDJSON). Session-scoped, last-touch. STILL PENDING (needs explicit sign-off — owner is sensitive about modifying GTM conversion-event payloads): surface-B Ads events (`purchase`/`sign_up` in gtm.js) don't carry variant; join via `trackingSessionId`/`userId` until added.

**Owner concern (honor it)**: the GA4 bridge and variant work must be PURELY ADDITIVE to GTM — never modify/rename existing dataLayer events or the 27 canonical variables. The `client_` prefix + curated PII-free payload + reading attribution via getContextSnapshot (same values) satisfy this. Confirm any future change touching surface-B (gtm.js) with the owner first.

**Surface-B variant (commit 106443d)**: gtm.js baseContext() now stamps `funnel_variant`+`funnel_search_type` (distinct prefix, avoids colliding with events' own undefined `search_type`) on ALL surface-B events incl. purchase/sign_up. Ads/GA4 attribute conversions to ad unit, no join.

**GA4 (task #2, in progress 2026-06-24)**: scope = idlookup.ai ONLY for now; measurement ID already exists (owner has the G-). NO code changes needed — app already emits to dataLayer. Full GTM wiring guide written: `docs/GA4_SETUP.md` (container GTM-THCSBJWN; SPA page_view gotcha = ScrollToTop fires virtualPageview on initial load too, so set config tag send_page_view=false + page_view via virtualPageview; DLV map; PII allowlist; DebugView QA). Owner executes the GTM/GA4 console steps (I can't access their consoles). Other brands (peoplesearcher GTM-PBFRPKNX, inmatefinderhub GTM-TF6NWS79) repeat later. Google Ads gtag AW-18044069648 still disabled in index.html.
