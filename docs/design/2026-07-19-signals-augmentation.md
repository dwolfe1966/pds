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

**Scope:** this is about *acquisition teasers + report presence*. The "every record maps to a member+profile"
freemium/identity north star is downstream and out of scope here (the My Identity column just notes where it connects).

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

**One per-person signals layer** instead of N teaser components each doing their own fetch + flow check.

```
getPersonSignals({ firstName, lastName, state, city, age, gender, stage })
  → { booking, marriageDivorce, capability, /* post-pay: */ sexOffender, ... }
```

- **`stage`** = `'pre-signup' | 'post-pay'`. Pre-signup returns only bucket-A signals (cheap/fast/cached/safe);
  post-pay adds bucket-B. This enforces the invariants in ONE place, not scattered across surfaces.
- **Suppression gate (invariant #5)** — `getPersonSignals` checks the subject against the `suppression`
  endpoint *first* and returns empty (or capability-only) for an opted-out/suppressed subject, so no surface
  can tease a suppressed person. Single choke point, same as WSFY's per-item enforcement.
- **Cache-backed** — reuses `life_events_cache` + `inmates`; one call per person per stage, memoized.
- **Flow config drives emphasis** — a small `FLOW_PRIORITY` table (§6) maps flow → `{ lead, secondary[] }`.
  A shared `<SignalTeaser signals={...} flow={...} />` renders lead + capped "also found." Surfaces pass their
  own `strict`/layout.
- **Collapses**: `InmateBookingTeaser`, `DivorceTeaser`, `DatingTeaser` per-surface flow checks → one component
  + one config. Adding vertical #4 (death, background) = a config row, not new plumbing.

Net effect: presence is computed once (data + stage), emphasis is a config lookup, and the safety/cost
invariants live in `getPersonSignals`'s stage gate rather than in every JSX site.

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
