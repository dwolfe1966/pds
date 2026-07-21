---
name: project_signals_augmentation
description: "Signals-augmentation design — universal enrichment, flow-prioritized, 3 viewer-lenses; the getPersonSignals architecture + phased plan"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Design direction (owner "in theory, I love the idea", 2026-07-19): stop gating record teasers by *arrival flow*. A person's records are intrinsic to them, not to why someone searched. **Presence = data-driven (surface every cheap+safe signal everywhere); emphasis = flow-driven (flow picks lead+framing).** Flow-gated → **universally augmented, flow-prioritized**. Reframes the inmate-teaser flow-gate fix (commit 4c32005) from "hide inmate outside its flow" → "inmate LEADS only in its flow".

**Three viewer-lenses on ONE subject-keyed signal set** (the key architectural insight):
- `prospect → stranger` = acquisition teaser ("unlock"), paywalled, suppression CHECKED
- `member → other` = paid report, suppression CHECKED
- `owner → self` = identity management ("here's what's exposed about YOU — suppress it"), NO paywall (freemium hook), suppression CREATED
Same signal computation; only gating/framing/suppression-role differ. **Suppression is the hinge between the acquisition product and the freemium-identity product** ([[project_freemium_identity_community]], [[feedback_map_records_to_members]]) — the owner creates the suppression the teaser checks, so building the suppression gate now = building the enforcement half of identity-management. owner-self lens is a first-class ARCHITECTURAL dimension but its UI is downstream (blocked on two-class data problem = non-member subjects).

**Architecture:** `getPersonSignals({subject, viewerRelation, stage, flow})` — one subject-keyed, cache-backed service where ALL invariants live (stage gate, suppression check, corroboration). Memoize RAW signals per (subject, stage); resolve lead/secondary OUTSIDE the memo (flow-dependent). Feeds a shared `<SignalTeaser>`. Collapses InmateBookingTeaser/DivorceTeaser/DatingTeaser into one component + FLOW_PRIORITY config.

**Invariants:** SO+criminal post-pay+corroborated only; suppressed subject → no signals; cheap/fast/cached providers only pre-signup; lead + capped(≤3) secondary; display-permission gate.

**Plan:** 6 flag-guarded phases, behavior-preserving first (`REACT_APP_SIGNALS_AUGMENT` 0=today's per-flow parity). Phase 0 engine → 1 SERP → 2 SUP+Payment (port, DON'T retire) → 3 landing → 4 post-pay/report → 5 flip universal+general (gated) → 6 retire old teasers (only after augment proven in prod, so rollback stays REAL, not emulated).

**Owner decisions/gates (unresolved):** Q1 tease loose booking pre-signup at all? (same "loose match=implicit claim" logic that killed pre-signup SO applies, lower stakes); Q2 Enformion billing per-search-vs-per-match = HARD GATE on universal marriage/divorce (+ projected cost estimate before flip); Q3 augment general funnel?; Q4 async pop-in UX; **subject-opt-out lookup may be a BUILD not a wire** (verify a subject-level opt-out store is queryable from the Vercel signals layer — else universal augment = teasing people with no way to have opted out).

Docs: `docs/design/2026-07-19-signals-augmentation.md` (design) + `docs/design/2026-07-19-signals-implementation-plan.md` (plan).

**Decisions RESOLVED 2026-07-19:** Q1=yes (tease booking pre-signup, display-gated), Q2=**daily Enformion cap** (not billing-verify), Q3=yes (augment general funnel), Q4=yes (async pop-in), Verify=yes (subject-opt-out).

**Phase 0 DONE (commit b079c08, shipped dark):**
- `src/services/personSignals.js` — `getPersonSignals({subject,viewerRelation,stage,flow})` engine; all invariants in one place (stage gate, post-pay SO corroboration, booking display-flag, FLOW_PRIORITY emphasis, owner-self severity, suppression stub). 10 unit tests (`src/tests/personSignals.test.js`). NOT imported anywhere yet → not in bundle.
- `seo/lib/enformionBudget.mjs` — `tryConsumeEnformion` daily cap wired into divorce/marriage search. **OWNER TODO: set `ENFORMION_DAILY_CAP` env on Vercel to activate** (unset = no cap = today's behavior). Auto-deployed.
- Jest fix: mocked react-leaflet/leaflet (ESM broke modularProfile suite after the address-map import). Full suite 365 pass.

Flags (default off = today's behavior): `REACT_APP_SIGNALS_AUGMENT`, `REACT_APP_SIGNALS_BOOKING_PRESIGNUP`.

**Phase 1 DONE (commit 8dc49c9):** `src/components/SignalTeaser.js` (engine-driven; atomic renderers capability/marriageDivorce/booking; lead + capped secondary; async pop-in; safe-by-default). SERP (`SearchResultsPage`) flag-branched: `REACT_APP_SIGNALS_AUGMENT=1` → SignalTeaser (all flows incl. general); =0 (default) → original per-flow teasers UNCHANGED (real rollback). Deploy candidate `public.2b1d3b89.js` (flag off = parity). To trial augment: rebuild with `REACT_APP_SIGNALS_AUGMENT=1`. Jest: no RTL, engine's 10 tests cover logic; Phase 1 verify = flip flag on staging + eyeball each flow.

**Phase 2 DONE (commit 081464d):** engine gained `strict` mode (shapeSignals corroborates booking age±1 + caps marriage/divorce for specific-person surfaces). SUP (`SupTeaserA`) + Payment (`PaymentPage`) flag-branched → strict SignalTeaser at flag=1, original per-flow strict teasers at flag=0. 12 engine tests. Deploy candidate `public.db975e2a.js` (flag off).

**Phase 3 DONE (commit c24d3ae):** landing details ported — `VerticalIntentLanding` (v12/v14) + `NameSearchLandingV3Page` (v3 inmate) flag-branched → SignalTeaser (loose) at flag=1, original teasers at flag=0. Deploy candidate `public.7fcf6fa4.js` (flag off). Verified live on local (dev harness `/dev/signal-teaser` + flagged :3000): divorce/dating/inmate/general all render augment correctly with real idlookup.me data (Michael Johnson NV = 10 divorce + 12 incarceration; James Smith FL = 6 incarceration + 10 divorce). Owner likes the direction.

**Phase 4 DONE (commit bc8c33a):** report (`SearchResultDetailPage`) flag-branched → flag=1 reads post-pay signals from ONE `getPersonSignals` call (member-other lens; SO only in dating flow via new `sexOffender` opt-in param); flag=0 = original two ad-hoc fetches. Engine gained `sexOffender` opt-in (post-pay ~10s NSOPW lookup, off by default; defensive SO-exposure gate on wantSO; owner-self lens always implies wantSO — your own registry exposure, no wrong-person harm). Booking→row mapping extracted to shared `mapBookingRow`. 13 engine tests, suite 368 green. Deploy candidate `public.db70b2c6.js` (flag off).

**Build hygiene (commit b84bcc1):** `scripts/clean-build.js` wipes build/ + build-admin/ before each build (Parcel doesn't clean --dist-dir; 266 stale bundles had accrued). Wired into `npm run build` + `build:admin`.

**Local test:** flagged dev = `REACT_APP_SIGNALS_AUGMENT=1 REACT_APP_SIGNALS_BOOKING_PRESIGNUP=1 REACT_APP_LIFE_EVENTS_URL=https://idlookup.me/api/life-events REACT_APP_INCARCERATION_URL=https://idlookup.me/api/incarceration npm start` → `/dev/signal-teaser` harness. localhost:3010 also CORS-allowed now.

**Engine keying + permissiveness (owner 2026-07-20):** `getPersonSignals` is keyed on a name QUERY (`subject={name,state,+optional age/gender}`), NEVER a person ID/extId/login. Default `viewerRelation='prospect'` (anonymous searcher = the common case). Suppression = no-op stub → maximally permissive to start. Booking pre-signup is PERMISSIVE BY DEFAULT (`REACT_APP_SIGNALS_BOOKING_PRESIGNUP !== '0'`) because v3/v11 already show booking pre-signup in prod — so the flip only needs `AUGMENT=1` (no second flag to remember). SO stays post-pay+corroborated.

**Booking parity DONE (commit 642423a):** SignalTeaser Booking renderer matches InmateBookingTeaser exactly (cycling placeholder colors, facility preview, tailored 'unlock mugshots/charges/booking dates/facility' line, strict 'Possible…verify'). v3+v11 CVR-safe (proven 7.15% inmate channel). Verified live. Readiness doc `docs/design/signals-phase5-readiness.md` (architecture, subject-opt-out PLAN, 14 test cases, backend validation ✅).

**v11 was ported 2026-07-20 (commit 350c542)** — it was ungated (would've bypassed engine); now flag-branched like v3.

**Opt-out (owner clarification 2026-07-20):** record-level opt-out is ALREADY BUILT — a person locates their record and it's removed (BC-blocked) so it won't show in SEARCH RESULTS (person-ID basis). Teasers show LOOSE AGGREGATE by name+state ("10 divorce records for John Smith, AZ") — not clearly identifiable to the opted-out individual → **subject-opt-out on teasers is OK for now** (owner's call). Divorce/dating teasers blur names ✓. FAST-FOLLOW nuance: the inmate booking teaser shows real MUGSHOTS (clearly identifiable) BUT it's already live in prod (v3/v11) + public-record from our FIRST-PARTY incarceration scrape (outside BC opt-out scope) → status quo, no new exposure. Fast-follow should decide if the first-party incarceration roster honors its own opt-out.

**STAGING/PROD FLIP READY (2026-07-20):** AUGMENT=1 bundle built = **`public.f2d37d74.js`** (flag inlined ✓, secret scan clean, booking permissive default, endpoints → idlookup.me via .env.production LEAD_CAPTURE_URL). This is the augment candidate to upload to BC staging → run the 14 test cases → prod. The flag is BUILD-TIME (Parcel inlines it) → rollback = redeploy a flag-OFF bundle (any `npm run build` without the env var, e.g. earlier `public.db70b2c6.js`). Test priorities: #1/#2 inmate v3/v11 (7.15% CVR), #14 flag-off rollback.

**LIVE ON PROD (owner deployed `public.f2d37d74.js` to www.idlookup.ai 2026-07-20).** Validated via Playwright on prod: **v3 + v11 inmate** teasers render engine SignalTeaser with FULL booking parity (mugshots + charges + facilities + tailored unlock) + "also found: 10 divorce" augmentation — CVR-critical channel confirmed working. Captcha does NOT block (teaser is at details step, pre-BC-search, fetches idlookup.me).
**BUG found + fixed on prod test:** v13 (death) had NO death signal → fell back to general augment → showed INCARCERATION mugshots to a death searcher (off-message). Fixed (commit fcc3321): gate VerticalIntentLanding flag=1 teaser on `cfg.teaser` (only divorce/dating augment; death shows nothing until its signal built). **Corrected augment bundle = `public.5d3d1d7c.js` — owner should redeploy to replace f2d37d74.**

`public.5d3d1d7c.js` was LIVE on prod (validated v3/v11/v12/v14 teasers + v13-silent via Playwright).

**Phase 6 DONE (commit 74d54e6) — legacy teaser infra RETIRED.** Deleted InmateBookingTeaser/DivorceTeaser/DatingTeaser/InmateBookingSection. Stripped SIGNALS_AUGMENT ternary + old imports from all 6 funnel surfaces + report (getPersonSignals is now the sole path). Engine `augmentOn()` flipped to default-ON (`!== '0'`) — augment is committed; flag is now just a kill-switch (`=0` → lead-only). Plain `npm run build` = augment bundle. 368 tests. **Deploy candidate `public.127ebedc.js` (owner should deploy to replace 5d3d1d7c — same behavior, just cleaned).**

**Resilient zero-result handling** = DEFERRED to [[project_backlog]] (owner un-gated Phase 6 2026-07-20). IDI TooManyMatches + volatility (down 7/8–7/12); plan in `docs/reporting/toomanymatches-diagnosis.md` (BC error-code ask + smart retry + first-party fallback + Enformion-direct option).

**DEATH vertical (started 2026-07-20):** recon done (`docs/research/death-data-recon.md`) — SSDI OUT (gated+stale); Enformion has NO death product; FindAGrave/Legacy scrape = ToS/legal risk (Ancestry litigious); **licensed obituary API = pragmatic primary** (like divorce→Enformion). Split: teaser vendor (pending owner) + IDI post-pay report (built now).
- **BUILT (commit d7b24cd): free IDI post-pay death report section.** extractAll `deaths` enriched (defensive DMF fields); MyProfileModular 'Death Record & Obituary' module (prominent, renders ONLY when a death record exists — safe-by-default); ProfileView death line richer. ⚠️ **IDI deathList shape UNCONFIRMED** (field map flags it) — verify field names against a real DECEASED-person report + adjust extractAll. Deploy candidate `public.10a092e0.js`.
- **PENDING owner decision:** approve a death/obituary teaser vendor — ObituaryMonitor (~$449/mo flat, verification+link) or AIS Death Data (richer, get quote). That unlocks the v13 TEASER (build shape in recon doc: deathSearch provider → engine `death` signal + FLOW_PRIORITY.death → SignalTeaser Death renderer → v13 DEATH_CFG flow/teaser).

**Also NEXT:** deploy `public.127ebedc.js` (Phase 6 cleanup) / latest `public.10a092e0.js`. Owner-self identity lens still downstream. GATED on: (1) owner sets `ENFORMION_DAILY_CAP` on Vercel, (2) subject-level opt-out lookup verified queryable from the Vercel signals layer (may be a build — the suppression choke point in getPersonSignals is still a stub), (3) projected cost estimate pre-flip. Then Phase 6 retire old teasers (after augment proven in prod).
All prospect-lens pre-signup surfaces ported (landing+SERP+SUP+Payment) + post-pay report (member-other). Only owner-self UI remains (downstream, not a migration phase).
Still-open Phase 5 prereq: subject-level opt-out lookup (may be a build — verify queryable from Vercel signals layer).
