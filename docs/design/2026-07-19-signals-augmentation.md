# Signals Augmentation — universal enrichment, flow-prioritized

**Status:** proposal for review (owner said "in theory, I love the idea")
**Date:** 2026-07-19
**Author:** Claude (with owner)

---

## TL;DR

**Reframe:** stop gating teasers by *arrival intent*. A person's records are intrinsic to them, not to why
someone searched. **Surface every cheap + safe signal on every surface (presence = data-driven); let the flow
decide the lead + framing (emphasis = flow-driven).** Move from *flow-gated* → *universally augmented,
flow-prioritized.*

**Decide these 4 (details in §8):**
- [ ] **Q1 — Tease loose booking pre-signup at all?** (the real call — a name-match record about a possibly-
  innocent named person, pre-corroboration. Yes with "possible match" framing + display gate, or capability-
  only pre-signup like sex-offender?)
- [ ] **Q2 — Confirm Enformion billing (per-search vs per-match) — HARD GATE** before universal marriage/divorce.
- [ ] **Q3 — Augment the general/background funnel too?** (lifts conversion, changes the "clean search" feel)
- [ ] **Q4 — Async "pop-in" UX** at the conversion moment (skeleton, no layout shift).

**Non-negotiable invariants (§2):** sex-offender & criminal stay post-pay + corroborated; **opted-out /
suppressed subjects suppress the teaser too**; cheap/fast/cached providers only pre-signup; lead + capped
"also found," never a wall of badges.

**Scope:** the signals engine is designed around **three viewer-lenses on one subject-keyed signal set** —
*prospect → stranger* (acquisition teaser), *member → other* (paid report), *owner → self* (identity
management). The identity-owner lens is a first-class **architectural** dimension (§7.1) — the same signals +
inverted framing + an inverted suppression role — but its **UI/product** (identity claiming, freemium tiers)
is downstream and not built in this effort. We design the seam now so we don't re-architect later.

---

## 1. The thesis

Today each acquisition vertical (inmate / divorce / dating) shows **only its own teaser**, gated by the
session `funnelFlow`. That was the right first move, but it conflates two independent things:

- **Presence** — *what data we surface.* A person's records are intrinsic to **them**, not to why someone
  searched. A dating searcher learning the person also has an arrest record and a marriage on file is getting
  *more* value, not off-message noise.
- **Emphasis** — *what leads, and how it's framed.* This is where intent matters: dating leads with the
  safety/relationship angle; a booking record rides along as a supporting "we also found."

**Proposal:** move from **flow-gated** → **universally augmented, flow-prioritized.** Surface every signal
that is cheap + safe to show, on every surface; let the flow decide the *lead + order + framing*, not the
*presence*. Presence is data-driven; emphasis is flow-driven.

Under this lens, the inmate-on-Payment bug we just fixed wasn't "incarceration showed in the dating flow" —
it was "incarceration showed **alone and unprioritized**, so it read as the whole point." The flow-gate patch
is correct under either model; it just becomes "inmate **leads** only in the inmate flow" instead of "inmate
is **hidden** outside it."

---

## 2. Invariants (do NOT relax when we augment more)

1. **Harm / attribution.** Augmenting more never overrides "don't attribute a high-stakes record on a loose
   match." Every signal is classified *teasable-cheap* vs *post-pay-sensitive*. Sex-offender stays post-pay +
   corroborated (age±1 + gender + state), framed "possible match — verify," forever. No exceptions bought by
   "we decided to show more."
2. **Cost + latency budget.** Universal augmentation fires more provider calls on more anonymous traffic. Only
   providers that are **cheap, fast, and cached** may fire *pre-signup universally*. Slow/expensive/browser-tier
   providers are post-pay or on-demand. The person-keyed caches (`life_events_cache`, `inmates`) are what make
   universal pre-signup affordable.
3. **No clutter.** "Show everything" degenerates into a wall of badges. Enforce a **lead + capped "also found"**
   tier. One clear hook per surface; extras are secondary and bounded (e.g. ≤3).
4. **Display permission.** A signal is only teasable if we have display rights for that surface (e.g.
   incarceration display permission is still being secured in writing; UCC spec verified). Gate on it.
5. **Opt-out / suppression.** The subject of an augmented teaser is usually a **non-member** who may have opted
   out or been suppressed. A suppressed/opted-out subject **suppresses the teaser signals too** — we never
   tease records about someone who asked not to be shown. This is a hard enforcement point inside
   `getPersonSignals` (§7), reusing the existing `suppression` endpoint + the per-item suppression already
   enforced in WSFY. Cheap to build in now; a compliance fire if bolted on later.

---

## 3. Signals inventory

| Signal | Provider | Cost | Latency | Cached | Display rights | Safety class |
|---|---|---|---|---|---|---|
| **Booking / incarceration** | First-party scrape + `inmates` table | ~free | cache: fast · live: 30–60s (async hydrate) | yes | securing (UCC verified) | attribution-sensitive (name match) |
| **Marriage / divorce** | Enformion divorce ($0.05 live) / marriage (pending Pro) | low | fast | yes (`life_events_cache`) | ok | low-stakes; "possible — verify" |
| **Sex-offender** | NSOPW (browser-tier) | browser call | ~10s | yes | public registry | **HIGH-STAKES** (alias match) |
| **Criminal / court** | IDI (via BC report) | in report | post-pay (report) | — | ok | attribution-sensitive |
| **Addresses / phones / emails / relatives / property** | IDI (via BC report) | in report | post-pay | — | ok | low |
| **Nearby offenders (location)** | FamilyWatchdog (in BC report) | in report | post-pay | — | ok | location-based, not person-attributed |
| **Relatives / past locations / occupation (derived)** | Enformion PersonSearch (`enrich-person`) | low | fast | member row | internal/derived only | never raw — derived labels only |

---

## 4. Teasability classification (the core decision table)

Three buckets. This is the table to argue with.

### A. Pre-signup teasable (cheap + fast + cached + safe framing)
- **Marriage / divorce** — cheap, cached, low-stakes. Blurred spouse/ex name is a legitimate reveal. ✅
- **Booking / incarceration (cached rows only)** — serve the *cached* `inmates` roster pre-signup (fast); the
  live 30–60s scrape is **post-pay / on-demand** only. Gate on display permission. ⚠️ cached-only, **and
  pending the Q1 decision** — this is the one attribution-sensitive signal proposed for the pre-signup bucket.
- **"Capability" tease** — a promise of what the full report covers (safety check, criminal, identity). Not a
  claim about the person; always safe. ✅

### B. Post-pay only (in the paid report)
- **Sex-offender (person-attributed)** — corroborated, "possible match — verify." Never pre-signup. 🚫 pre
- **Criminal / court, addresses, phones, relatives, property** — this *is* the IDI report. Post-pay by nature.
- **Booking (live scrape)** — the fresh 30–60s hydration; cached teaser pre-signup, live detail post-pay.

### C. Never teased raw (internal/derived)
- **PersonSearch enrichment** — feeds WSFY as *derived labels* ("May be family"); raw relatives/cities never
  surfaced. Compliance posture is fixed.

**The one genuinely open call:** should we tease loose booking at all pre-signup? It's attribution-sensitive —
a name match (no age corroboration pre-signup) that surfaces a booking record about a specific, possibly-
innocent named person. The **same logic that killed pre-signup sex-offender applies here** — "a loose match is
an implicit claim about a named person" — just at lower magnitude: booking matches the *actual* name (not SO's
alias), and a booking record ≠ a sex-offense registry entry. (Note: we *do* tease it on the inmate flow today,
but that legacy teaser predates the harm framing that killed pre-signup SO — it isn't evidence it's right, so
decide this on the merits, not on precedent.) Options: (a) tease cached booking pre-signup with strict
"possible match — verify" framing + display-permission gate; (b) treat it like SO — capability-tease pre-signup,
real booking records post-pay only. See §8 Q1.

---

## 5. Surface × signal matrix

Surfaces: **Landing** (details step) · **SERP** (result card) · **SUP** (single-profile teaser) ·
**Payment** · **Report** (post-pay) · **My Identity** (member's own).

| Signal | Landing | SERP | SUP | Payment | Report | My Identity |
|---|---|---|---|---|---|---|
| Marriage/divorce | tease | tease | tease (strict) | tease (strict) | full section | full section |
| Booking (cached) | tease* | tease* | tease* (strict) | tease* (strict) | merged into criminal | merged into criminal |
| Capability | tease | — | — | — | — | — |
| Sex-offender | — | — | — | — | corroborated section (dating) | location "near you" |
| Criminal/addresses/etc. | — | — | — | — | full | full |

`*` = gated on display permission + "possible match" framing. "strict" = corroborated to the specific person
(age±1 + gender) since a specific profile is in view.

---

## 6. Lead-by-flow matrix (emphasis, not gating)

Every flow shows the **same available signals**; flow decides the **lead** and the order. "Also found" is the
capped secondary tier. "—" = not suppressed, just not promoted.

| Flow | Lead hook | Also found (secondary) | Post-pay headline |
|---|---|---|---|
| **inmate** | Booking record | marriage/divorce | Booking + criminal |
| **divorce** | Marriage/divorce | booking | Relationship + records |
| **dating** | Safety capability + relationship | booking | Safety check (SO corroborated) + identity |
| **death** | (obituary/death — not yet a data signal) | marriage/divorce | Records |
| **background / general** | Strongest available signal (booking > criminal > marriage) | the rest | Full report |

Key change vs today: **general / background** flows finally get augmentation (currently they show nothing pre-
signup). The lead is "strongest available signal," not a fixed vertical.

---

## 7. Proposed architecture

**One subject-keyed signals layer** instead of N teaser components each doing their own fetch + flow check.
Signals are keyed to the *person* (the subject), not to a surface or a viewer — the same booking record is one
record whether a prospect teases it, a member buys it, or the person themselves manages it.

```
getPersonSignals({ subject, viewerRelation, stage, flow })
  → { booking, marriageDivorce, capability, /* post-pay: */ sexOffender, criminal, ... }
```

### 7.1 Two independent axes: stage AND viewer-lens

- **`stage`** = `'pre-signup' | 'post-pay'` — controls WHICH signals are computed (bucket-A cheap/fast/cached
  vs. bucket-B). Enforces the cost/harm invariants in ONE place, not scattered across surfaces.
- **`viewerRelation`** = `'prospect' | 'member-other' | 'owner-self'` — controls HOW the same signal set is
  gated, framed, and how suppression behaves. The signal *computation* is identical across lenses; only
  presentation + gating differ:

  | Lens | Framing | Paywall | Suppression role | Emphasis driver |
  |---|---|---|---|---|
  | **prospect → stranger** | "look what we found — unlock" | yes (pre-signup tease) | **checked** | funnel flow (§6) |
  | **member → other** | full record, inform | post-pay | **checked** | funnel flow (§6) |
  | **owner → self** | "here's what's exposed about **you** — manage/suppress" | **no** (seeing your own exposure is the freemium hook) | **created** | highest-exposure-first |

  This is why the identity-owner side is a first-class *architectural* dimension, not a fourth teaser surface:
  it consumes the same subject-keyed signals with inverted framing and an inverted suppression role.

- **Suppression is the hinge between the two products (invariant #5).** `getPersonSignals` checks the subject
  against the `suppression` endpoint *first* and returns empty (or capability-only) for a suppressed subject.
  The identity owner (`owner-self` lens) is the one who *creates* that suppression; the teaser (`prospect` /
  `member-other`) is the one that *checks* it. Same mechanism, opposite ends — so building the suppression gate
  now is building the enforcement half of the future identity-management feature. Single choke point, same as
  WSFY's per-item enforcement.

### 7.2 Rendering

- **Cache-backed** — reuses `life_events_cache` + `inmates`; one call per (subject, stage), memoized.
- **Emphasis config** — `FLOW_PRIORITY` (§6) maps `flow → { lead, secondary[] }` for the prospect/member
  lenses; the `owner-self` lens orders by **exposure severity** instead (what's most visible/damaging about
  you first).
- **Shared presentation** — `<SignalTeaser signals lens flow />` renders lead + capped "also found" for the
  acquisition lenses; the identity surfaces (`MyProfileModular` / My Identity) render the same signals in
  manage/suppress framing. Both consume one `getPersonSignals` result.
- **Collapses**: `InmateBookingTeaser`, `DivorceTeaser`, `DatingTeaser` per-surface flow checks → one component
  + one config. Adding vertical #4 (death, background) = a config row, not new plumbing.

### 7.3 The two-class data problem (why owner-self is downstream)

The `owner-self` lens's subject is often a **non-member** whose record we hold as a broker — the north-star
crux ([[project_freemium_identity_community]]). The architecture *accommodates* it now (subject-keyed signals +
lens dimension + suppression hinge), but the *product* (identity claiming, verified ownership, freemium tiers)
is downstream. We design the seam now so we don't re-architect later; we don't build the identity UI in this
effort.

Net effect: presence is computed once (subject + stage), gating/framing is a lens + flow lookup, and the
safety/cost/suppression invariants live in `getPersonSignals` rather than in every JSX site — serving both the
acquisition product and the freemium identity product from one spine.

---

## 8. Open questions for the owner

1. **Booking pre-signup (the real decision):** keep teasing cached booking records pre-signup *universally*
   with "possible match" framing (higher conversion, some attribution surface), OR capability-tease pre-signup
   and show real booking only post-pay (safer, lower pull)? Recommendation: **keep cached booking teasable**
   with strict "possible match — verify" framing + display-permission gate, because stakes are far below SO and
   we already do it for the inmate flow. But it's your call.
2. **Cost ceiling — HARD GATE, not a nice-to-know:** universal marriage/divorce means an Enformion call
   (cached) on more anonymous SERP/landing traffic. Confirming the Enformion **billing model** (per-search vs
   per-match — still unverified) is a **blocking dependency** on the rollout step that turns marriage/divorce on
   for all flows (§9 step 5) — not just a question. If it bills per-search, universal pre-signup on anonymous
   traffic is the exact cost-blowup risk; per-match, cache makes it cheap. Do not flip that step until verified.
3. **General/background augmentation:** do we want the general funnel (home search, no vertical) to start
   surfacing signals pre-signup? It lifts conversion but changes the "clean search" feel. Recommend yes, capped.
4. **Latency UX:** signals fill in async (booking live path, any slow provider). Confirm the teaser "pops in"
   gracefully (skeleton → content) rather than layout-shifting at the conversion moment.

## 9. Migration path (incremental, low-risk)

1. Build `getPersonSignals` (pre-signup stage) wrapping the existing life-events + incarceration fetches +
   cache. No UI change.
2. Introduce `<SignalTeaser>` + `FLOW_PRIORITY`; port the SERP first (lowest risk), behind the existing flow
   values so behavior is identical, then flip to "augment + prioritize."
3. Port SUP + Payment (retire the per-surface flow checks we just added).
4. Add post-pay stage to `getPersonSignals`; the report already composes these — align it last.
5. Turn on universal marriage/divorce + general/background augmentation once §8 Q2 (Enformion billing — hard
   gate) and Q3 are decided. Do not flip this step before Q2 is verified.

## 10. Risks

- **Cost creep** — mitigated by cache + billing-model verification (Q2) + "cheap/fast/cached only" pre-signup rule.
- **Over-surfacing sensitive data** — mitigated by the stage gate (SO/criminal never in pre-signup bucket).
- **Clutter / diluted hook** — mitigated by lead + capped secondary.
- **Perceived creepiness** — showing "everything we found" pre-signup can feel invasive; the capability tease +
  blurred reveal balances pull vs. restraint. Watch conversion *and* complaint/opt-out rate.
