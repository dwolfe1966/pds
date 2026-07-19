# Signals Augmentation — Implementation Plan

**Companion to:** `2026-07-19-signals-augmentation.md` (the design)
**Status:** plan for review
**Principle:** behavior-preserving first, then flip. Every phase ships independently, is flag-guarded, and
leaves the app in a working state. No phase depends on an unmade owner decision (§Gates).

---

## 0. Guardrails (carried from the design's invariants)

- Sex-offender & criminal: **post-pay + corroborated** only — never in the pre-signup bucket.
- **Suppressed/opted-out subject → no signals** (checked in `getPersonSignals`, one choke point).
- Pre-signup bucket = **cheap + fast + cached** providers only.
- Lead + **capped** "also found" (≤3), never a wall.
- Display-permission gate per signal (booking pending written permission).

---

## 1. The core module — `getPersonSignals`

New client service: `src/services/personSignals.js`. Wraps the existing fetches; adds gating, corroboration,
suppression, and shaping. **This is where every invariant lives.**

```
getPersonSignals({ subject:{firstName,lastName,state,city,age,gender},
                   viewerRelation,   // 'prospect' | 'member-other' | 'owner-self'
                   stage,            // 'pre-signup' | 'post-pay'
                   flow })           // 'inmate'|'divorce'|'dating'|'death'|'general'
  → {
      suppressed: false,            // true → all signals empty, surfaces render nothing
      lens: viewerRelation,
      signals: {
        capability:      { available:true },                 // static; safe everywhere
        marriageDivorce: { records:[...], count },           // pre-signup ok (cheap/cached)
        booking:         { records:[...], count, source },   // pre-signup = CACHED only (Q1)
        sexOffender:     { records:[...], count },            // post-pay ONLY + corroborated
        criminal:        {...}, addresses:{...}, ...          // post-pay (from report)
      },
      lead, secondary:[...]         // resolved from FLOW_PRIORITY (or exposure-severity for owner-self)
    }
```

Internals reuse: `fetchLifeEvents` (lifeEventsService), `fetchBookings` + `corroboratePerson` +
`cleanReleaseStatus` (incarcerationService). **Memoize the RAW signals per `(subjectKey, stage)`; resolve
`lead`/`secondary` OUTSIDE the memo** — those are flow-dependent, and the memo key intentionally omits `flow`
(the same person's fetched records don't change because the funnel intent does). Mixing them would either
cache-miss on every flow change or return a stale lead.

### Stage × signal gate (the classification table — this is the thing to ratify)

| Signal | pre-signup | post-pay | Provider | Cost | Cached | Corroborate? | Suppress-gated |
|---|---|---|---|---|---|---|---|
| capability | ✅ | ✅ | static | 0 | — | n/a | n/a |
| marriageDivorce | ✅ | ✅ | Enformion | $0.05 | yes | strict on specific-person surfaces | yes |
| booking | ⚠️ cached-only (Q1) | ✅ live | first-party | ~0 | yes | strict on specific-person surfaces | yes |
| sexOffender | 🚫 | ✅ | NSOPW | ~10s | yes | **always** (age±1+gender+state) | yes |
| criminal/addresses/relatives/property | 🚫 | ✅ | IDI (report) | in report | — | n/a | yes |
| nearby-offenders (location) | 🚫 | ✅ | FamilyWatchdog | in report | — | n/a (location) | n/a |

### Lens gate

- `prospect` → stage forced `pre-signup`; paywalled; suppression **checked**.
- `member-other` → stage `post-pay`; suppression **checked**.
- `owner-self` → stage `post-pay`, NO paywall; suppression **created** (owner controls); emphasis = exposure
  severity. *(Consumed by identity UI — downstream; the service supports the lens now, the UI is not built here.)*

---

## 2. Emphasis config — `FLOW_PRIORITY`

Small table (in `personSignals.js` or `src/config/signalPriority.js`), mirrors design §6:

```
FLOW_PRIORITY = {
  inmate:  { lead:'booking',        secondary:['marriageDivorce'] },
  divorce: { lead:'marriageDivorce',secondary:['booking'] },
  dating:  { lead:'capability',     secondary:['marriageDivorce','booking'] },  // SO post-pay only
  death:   { lead:'marriageDivorce',secondary:[] },
  general: { lead:'__strongest__',  secondary:['__rest__'] },
}
OWNER_SELF_ORDER = by exposure severity: sexOffender > criminal > booking > marriageDivorce > addresses > ...
```

---

## 3. Shared component — `<SignalTeaser>`

New: `src/components/SignalTeaser.js`. Consumes a `getPersonSignals` result; renders the resolved `lead`
prominently + capped `secondary` as "also found." Reuses the existing per-signal presentational bits
(DivorceTeaser/DatingTeaser/InmateBookingTeaser bodies become render branches, not fetchers). Props:
`{ signals, lead, secondary, strict, layout, accent, dark }`.

The three existing teasers are **kept as presentational sub-renderers** during migration (no fetch), then
folded in once all surfaces are ported.

---

## 4. Phased rollout

Each phase = one PR, flag-guarded, behavior-identical unless the flag flips.

**Phase 0 — engine, no UI change.** Build `getPersonSignals` + `FLOW_PRIORITY` + unit tests. Ship dark.
*Verify:* unit tests (gating, corroboration, suppression, memoization). *Risk:* none (unused).

**Phase 1 — SERP behind parity flag.** Replace SERP's per-flow teaser blocks with `<SignalTeaser>` fed by
`getPersonSignals(stage:'pre-signup', viewerRelation:'prospect')`. With `REACT_APP_SIGNALS_AUGMENT=0` it
resolves to *exactly today's* single-flow output (parity). *Verify:* side-by-side each flow (inmate/divorce/
dating) matches current bundle; then flip flag on a staging build → augment+prioritize. *Risk:* low, isolated.

**Phase 2 — SUP + Payment (port, do NOT retire yet).** Route both through `<SignalTeaser>` behind the flag,
but **keep the old per-surface teaser blocks in place** (dead under the flag). Retiring them here would break
rollback — see Phase 6 + §9. *Verify:* each flow's SUP + Payment shows lead+secondary at flag=1; at flag=0,
behavior matches today. *Risk:* medium (conversion surfaces) → same flag.

**Phase 3 — Landing details step.** Port `VerticalIntentLanding` teaser gate to `<SignalTeaser>`.
*Verify:* v3/v12/v14 details step parity → augment. *Risk:* low.

**Phase 4 — post-pay stage.** Add `stage:'post-pay'` path; align the report (`SearchResultDetailPage` already
composes marriageDivorce + corroborated SO) to read from `getPersonSignals` instead of ad-hoc fetches.
*Verify:* report parity (Makenna Berry etc.); SO still empty-and-safe. *Risk:* medium (report is live).

**Phase 5 — flip universal + general funnel.** Turn `REACT_APP_SIGNALS_AUGMENT=1` in prod; enable the
`general` flow lead. **Blocked on Gates Q2 + suppression subject-keying (below).** *Verify:* **projected** cost
estimate first (cache-miss rate × provider price on real name-traffic distribution) as a pre-flip gate — not
just the post-flip dashboard, since a per-search biller can run up a bill on long-tail-name anonymous traffic
before observability catches it — then cost dashboard + opt-out/complaint rate watch for 1 week. *Risk:*
highest → gated, staged, reversible by flag (old teasers still live, see §9).

**Phase 6 — retire old teasers (cleanup, only after augment is proven in prod).** Once `AUGMENT=1` has run in
prod and held (cost + complaint metrics stable for the watch window), delete the now-dead per-surface teaser
blocks and fold the three legacy teasers fully into `<SignalTeaser>`. This is the ONLY phase that removes the
known-good fallback — deliberately last, after the risk has passed. *Risk:* low (already unused at that point).

**Future (NOT this effort):** `owner-self` lens UI (identity management), death data signal.

---

## 5. Gates / dependencies (must clear before the phase that needs them)

| Gate | Blocks | Owner action |
|---|---|---|
| **Q1** — tease loose booking pre-signup at all? | booking in pre-signup bucket (Phase 1+) | decide (design §8 Q1) |
| **Q2** — Enformion billing (per-search vs per-match) | universal marriage/divorce (Phase 5) | verify with Enformion |
| **Q3** — augment general funnel? | Phase 5 `general` lead | decide |
| **Q4** — async pop-in UX | all teaser phases | confirm skeleton pattern |
| **Display permission** — booking | booking teaser (any) | secure in writing (in progress) |
| **Suppression subject-keying** | invariant #5 enforcement (Phase 5) | **may be a BUILD, not a wire — verify first.** `/api/suppression?userId=` is a MEMBER's own suppressions; teasing a STRANGER needs a *subject-level* opt-out lookup (person identity). Push one level deeper than "which store": does a subject-level opt-out store **exist and is it queryable from the idlookup.me signals layer at all**? BC has an opt-out collection, but if it's not reachable from the Vercel engine, "universal augmentation" = teasing records about people with **no mechanism to have opted out** (the compliance fire). If not queryable, this gate is "build a subject-opt-out lookup" — a much bigger rock. Resolve BEFORE committing a Phase 5 timeline. |

---

## 6. Feature flags / kill switches

- `REACT_APP_SIGNALS_AUGMENT` — master (0 = per-flow parity / today's behavior; 1 = universal augment).
- `REACT_APP_SIGNALS_BOOKING_PRESIGNUP` — booking in pre-signup bucket (defaults off until Q1 + permission).
- `REACT_APP_SIGNALS_MD_PRESIGNUP` — marriage/divorce pre-signup universal (defaults off until Q2).
- All default to **today's behavior** so a merge never changes prod until a flag flips.

---

## 7. Testing

- **Unit** (`personSignals.test.js`): stage gate drops SO/criminal pre-signup; suppression → empty; booking
  pre-signup = cached-only; corroboration rejects age-missing (empty-and-safe); FLOW_PRIORITY resolution;
  `general` "strongest" selection.
- **Parity** (Phase 1–4) — **behavioral, not byte-identical.** Routing through a memoized `getPersonSignals`
  changes fetch batching, timing, and async fill order, so the DOM will not match today exactly. Parity means:
  *same records surfaced, same framing/copy, same flow lead, same empty-and-safe cases.* Test that — not a DOM
  diff — or you'll chase false diffs and over-trust an exactness the refactor can't deliver. (And through
  Phase 5 the original components are still present as the true fallback, so parity is a confidence check, not
  the safety net.)
- **Manual E2E**: each flow landing → SERP → SUP → Payment → report; confirm lead+secondary, no leak, SO
  post-pay only, async pop-in.
- **Safety**: a suppressed subject shows nothing on every surface; a same-name stranger's SO/booking is
  dropped by corroboration.

## 8. Observability

- Provider-call counter per signal (cost tracking) — watch Enformion volume after Phase 5.
- Conversion per flow (does augment lift or dilute?).
- **Opt-out / complaint rate** — the creepiness canary (design §10). If it rises with augmentation, pull back.

## 9. Rollback

Through Phase 5, the old per-surface teaser blocks are **still in the code** (dead under the flag) — so
`AUGMENT=0` runs the *original known-good code path*, not the new engine emulating it. That is a real fallback,
not an emulated one. This is why Phase 2 ports but does **not** retire, and retirement is deferred to Phase 6
*after* augment is proven in prod. No data migration, so a flag flip is instant and total. Once Phase 6 removes
the old blocks, the fallback becomes "engine at flag=0" (behavioral parity, not the original code) — acceptable
only because augment has by then been validated in prod.

## 10. Explicitly out of scope (this effort)

- `owner-self` identity-management UI (the freemium product) — architecture supports the lens; UI is downstream.
- Death vertical data signal.
- Two-class data resolution (non-member subject claiming) — north-star crux, separate track.
