---
name: project_funnel_standardization_2026_06_25
description: "Funnel event standardization + the prod-staleness root cause; campaign→LP routing is ours (campaignRegistry), not BC; trackings schema from Big Bot"
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

**ROOT CAUSE of most "funnel bugs" (2026-06-25): PROD IS RUNNING A STALE BUNDLE** (`public.6f44ed50.js`), NOT this session's work. Dev serves the current bundle. The single highest-leverage fix for reporting + UX is to **DEPLOY** `build/` to the prod VPS. Staleness explains: missing "Speak With Us" Contact block, old password rule (capital+special — code is already 8-char-min since bug #28), inmate campaign serving the old single-page LP, and missing v4/v5/phone variant tags. All verified fixed in current code on dev.

**Campaign → landing mapping has TWO layers (don't conflate):**
1. **GROUND TRUTH = BC's Mongo DB** (powers the BC API): `shapecontainers` → `collectionIds` → `shapecollections`. This is authoritative for shN identity/attribution/collection (what Big Bot resolved).
2. **Our `src/services/campaignRegistry.js`** = a LOCAL layer mapping shN token → which React LP *route* renders (`landing.route`), consumed by `App.js HomePageRedirect` to redirect `/?shn=X`. It's a hardcoded parallel copy → **DRIFT RISK**: it can fall out of sync with BC's Mongo. Must be kept in sync with (ideally derived from) the Mongo ground truth whenever new shNs launch — this IS Big Bot's "periodic re-check" concern.

Registry currently correct: inmate `6a22ff83…84b5`(upper)/`6a273f98…aae5`(lower) → `/name/landing/v3`; death `…aae6` → v4; divorce `…aae9` → v6; brand `69a2380b…1fbb` → null (stays home). VERIFIED on prod: `/?shn=<inmate-lower>` → redirects to `/name/landing/v3`, 4-step wizard, `landing_view{name,v3}`. NOTE: my earlier "no BC change needed, it's ours" to Big Bot was too strong — the route choice is ours, but the shN ground truth is BC's Mongo; the inmate fix was a deploy only because the registry already matched. Future: read landing mapping from BC, or keep registry↔Mongo synced.

**trackings schema (ground truth from Big Bot / live DB):** event doc = `data.{type (CLIENT:* name), sessionId, search_type, variant, _from, value.{referer,device,url,method,duration,ip,userAgent,brandId,hostname}, caller}`, `trackingIds.{clientId,sessionId,trackingId,apiId}`, `shConId/shColId/shTimestamp`, `brandId`. Standardization rule: every page's CLIENT:* event must carry a non-empty enumerated `search_type` (name|phone|email|home) + `variant` (vN). Our code: `useLandingTrack` persists funnel entry at landing; `funnelContext()` stamps search_type+variant on EVERY track() event (no empty strings). So funnel path (LP→SRP→signup→payment) carries them once deployed.

**Genuine current bug fixed (commit 1c3d6c3):** generic HomePage fired a spurious `landing_view{home,home}` before redirecting campaigns reached their vertical LP (double-fire). `useLandingTrack` now takes `enabled`; HomePage passes false when `campaign.landing.route` is a redirect. Verified: inmate URL now fires only `{name,v3}`.

**BC-side (not ours, flagged by Big Bot):** (1) event data polluted by VikingCloud security-scanner payloads (XSS/header-injection in type/variant/search_type) — needs a bot/scanner filter at ingest before any funnel dashboard. (2) `signup_complete` = credentials step, NOT the paid sale — do not wire a conversion off it (our code already treats it correctly; conversion = billing.sale / payment_complete). EVENTS_CATALOG.md is the consumer-side source of truth.
