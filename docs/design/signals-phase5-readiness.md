# Signals Augmentation — Phase 5 Readiness

**Date:** 2026-07-20 · companion to `2026-07-19-signals-augmentation.md` + `-implementation-plan.md`

---

## 1. The new architecture (one paragraph)

Every record teaser about a person now comes from **one engine** — `getPersonSignals({subject, viewerRelation,
stage, flow, strict, sexOffender})` (`src/services/personSignals.js`). It fetches once (booking via
`/api/incarceration`, marriage/divorce + sex-offender via `/api/life-events`), memoizes per (subject, stage),
and enforces every invariant in one place: sex-offender/criminal are **post-pay only**; sex-offender is
**opt-in + tight-corroborated** (age±1 + gender + state, empty-and-safe); booking pre-signup is display-flag
gated; suppressed subjects yield nothing (stub — see §2). It returns a `{signals, lead, secondary}` shape where
**presence is data-driven** and **emphasis (lead + capped "also found") is flow-driven** via `FLOW_PRIORITY`. A
single `<SignalTeaser>` renders it on the prospect surfaces; the report reads the same engine for post-pay.
**Cost is bounded** by the person-keyed caches + a per-day **Enformion cap** (`ENFORMION_DAILY_CAP`, now set).
Every surface is behind `REACT_APP_SIGNALS_AUGMENT`: **=1 → engine** (universal augment, flow-prioritized);
**≠1 → the original per-flow teasers, untouched** (real rollback).

**Three lenses, one engine:** `prospect→stranger` (teaser), `member→other` (report), `owner→self` (identity
management — downstream). Suppression is the hinge between the acquisition and freemium-identity products.

---

## 2. Subject-level opt-out — PLAN ONLY (do not implement yet)

**Problem:** universal augmentation surfaces records about people who are usually **non-members**. They must be
able to opt out, and a suppressed subject must yield **no signals** on any surface. The engine has the choke
point (`isSuppressed` in `getPersonSignals`) but it's a **stub** today.

**Open question to resolve first:** is a subject-level opt-out store **queryable from the Vercel signals
layer**? The existing `/api/suppression?userId=` is a *member's own* suppressions; teasing a *stranger* needs a
lookup keyed by the **person** (name+state, maybe DOB). If BC's opt-out collection isn't reachable from Vercel,
this is a *build*, not a *wire*.

**Simple plan (whichever store we land on):**
1. **Key** — normalize `norm(first):norm(last):norm(state)` (align with the life-events cache key); optionally
   add a coarse DOB/age bucket to reduce false-positive suppression of same-name people.
2. **Store** — a Neon table `subject_optout(key text PK, created_at)` on the SEO app (mirrors `life_events_cache`),
   OR a read-through to BC's opt-out collection if reachable. Populated by the existing `/opt-out` funnel +
   any BC opt-out feed.
3. **Query** — `getPersonSignals` calls a cached `isSubjectSuppressed(subject)` **before** any provider fetch;
   true → return the empty/suppressed result. Cache the lookup (short TTL) so it's one cheap check per person.
4. **Enforcement** — one place (the engine). Because presence flows through the engine, suppression covers
   *all* surfaces at once (teasers + report). The `owner→self` lens is the flip side — the owner *creates* the
   suppression the teaser *checks*.
5. **Fail-safe direction** — on lookup error, **fail-open for teasers is NOT acceptable** for a compliance
   control; decide fail-closed (hide) vs. log-and-allow with the owner. (Contrast the Enformion cap, which is a
   cost backstop and fails open.)

**Effort:** ~½ day if the store is queryable (wire + cache + test); ~2–3 days if we must build the store +
ingestion. **This is the one true gate on flipping universal (Phase 5).**

---

## 3. Test cases (run before + after the prod flip)

Build with `REACT_APP_SIGNALS_AUGMENT=1 REACT_APP_SIGNALS_BOOKING_PRESIGNUP=1` and the idlookup.me endpoints.
Compare each to the flag-off control. Use **Michael Johnson / NV** (10 divorce + 12 incarceration) and
**James Smith / FL** (6 incarceration + 10 divorce) for rich data; a nonsense name for empty-state.

| # | Flow / surface | Expect at flag=1 |
|---|---|---|
| 1 | **Inmate — /name/landing/v3** (details step) | Booking lead (mugshots + charges) + "also found" divorce. **CVR-critical.** |
| 2 | **Inmate — /name/landing/v11** (BvFlow details) | Same as v3 (now engine-backed). **CVR-critical.** |
| 3 | **Divorce — /name/landing/v12** | Marriage/divorce lead (blurred ex-spouse) + "also found" booking |
| 4 | **Dating — /name/landing/v14** | Safety-capability lead + "also found" divorce + booking |
| 5 | **Normal / general funnel** (no vertical) | Strongest present signal leads (was nothing pre-signup) |
| 6 | **SERP** (each flow) | Teaser above results, loose (name+state) |
| 7 | **SUP** (each flow) | Strict — booking/divorce corroborated to the specific person (age±1); same-name stranger dropped |
| 8 | **Payment** (each flow) | Same strict teaser, flow-appropriate |
| 9 | **Report — free member (unpaid)** | Paywalled sections gated as today; teaser/preview only |
| 10 | **Report — paid member (others' profile)** | Booking merged into Criminal; Marriage & Divorce section; SO section ONLY in dating flow, corroborated |
| 11 | **Report — dating flow, paid** | Sex-Offender "Safety Check" section shows corroborated matches (empty-and-safe if none) |
| 12 | **Empty state** (nonsense name) | Nothing renders (no hollow teaser; dating shows capability only) |
| 13 | **Suppressed subject** (once §2 is built) | Nothing renders on any surface |
| 14 | **Rollback** (flag=0) | Byte-identical to today's per-flow teasers |

**Safety checks:** SO never appears pre-signup (surfaces 1–8); a same-name stranger's booking/SO is dropped on
strict surfaces; no PII (spouse/offender names) is unblurred pre-signup.

---

## 4. Backend validation — DONE ✅

Audited every teaser render site: **all route through the engine at flag=1** (each old-teaser file is
`SIGNALS_AUGMENT`-branched with a `<SignalTeaser>`; the report reads `getPersonSignals`).

| Surface | File | Status |
|---|---|---|
| Landing v3 (inmate) | NameSearchLandingV3Page | ✅ branched |
| **Landing v11 (inmate BvFlow)** | NameSearchBvFlowPage | ✅ **fixed 2026-07-20 (was ungated)** |
| Landing v12/v14 (divorce/dating) | VerticalIntentLanding | ✅ branched |
| SERP | SearchResultsPage | ✅ branched |
| SUP | SupTeaserA | ✅ branched (strict) |
| Payment | PaymentPage | ✅ branched (strict) |
| Report (post-pay) | SearchResultDetailPage | ✅ reads getPersonSignals |

✅ **Inmate presentation parity — RESOLVED 2026-07-20 (commit 642423a).** `SignalTeaser`'s booking renderer now
matches `InmateBookingTeaser` exactly (cycling placeholder colors, facility-name preview, tailored "unlock
mugshots, charges, booking dates, facility" line; strict → "Possible … — verify"). Same `/api/incarceration`
data source. v3/v11 at flag=1 render the proven presentation **plus** the "also found" augmentation. Verified
live on the harness.

✅ **Booking pre-signup is now PERMISSIVE BY DEFAULT.** v3/v11 already show booking pre-signup in prod, so the
engine defaults booking-on pre-signup (`REACT_APP_SIGNALS_BOOKING_PRESIGNUP !== '0'`) — flipping `AUGMENT=1`
will NOT regress the inmate teaser. `=0` is the explicit display-permission off-switch. **So the prod flip only
needs `AUGMENT=1`** (booking is already on); do NOT need to remember a second flag.

**Engine is keyed on a name QUERY, not a person ID** — `subject = {name, state, +optional age/gender}`, no
auth/login/extId. Default `viewerRelation='prospect'` (anonymous). Suppression is a no-op stub today →
maximally permissive to start (per owner). The only deliberate restriction is SO=post-pay+corroborated.

---

## 5. After the flip → Phase 6 + next

- **Phase 6:** remove the legacy teasers (`InmateBookingTeaser`/`DivorceTeaser`/`DatingTeaser` render sites +
  the flag-off branches) — only *after* augment is proven in prod (keeps rollback real during the risky window).
- **(a) DEATH flow:** a `death` vertical (v13 landing exists) needs a **death data signal** — no provider wired
  yet (Enformion death/obituary, or SSDI/obit scrape). Add `death` to the engine (a `death` signal +
  `FLOW_PRIORITY.death` lead) once a source is chosen. Build after legacy cleanup.
- **Owner-self identity UI:** the engine supports the lens; the product (claiming, freemium tiers) is downstream.
