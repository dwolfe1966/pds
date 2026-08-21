# HomeFacts Entry Experience — Permutations & Assessment

_2026-08-21. Purpose: enumerate the full design space for the page HomeFacts links into, assess each
permutation, and pick a rotation set to A/B test. Decision doc — nothing here is built yet except v3/v4._

---

## 1. The visitor (mental model)

Source page: `homefacts.com/offender-detail/CA…/Abel-Ulloa-Garcia.html` (see `docs/homefacts/Image 8-21-26…jpeg`).
HomeFacts already gave them, **for free**: name, **last-known address**, DOB, physical description (sex/eyes/
height/hair/weight), aliases, "Registered Sex Offender," and a nearby-offenders list. The button they clicked is
literally **"VIEW CRIMINAL RECORD."**

Their expectation on arrival:
> *"I'm viewing this offender. I want his criminal record. I clicked 'view criminal record.' The next page should
> be MORE about **him** — his record, a map, a photo."*

**Why we convert at ~0 today:** we show *less* than HomeFacts already showed, lock all of it, frame it as a vague
"full profile," and (v3) open with a captcha. No new payoff, no "criminal record," broken continuity → bounce.

**The three tests every strong permutation must pass:**
1. **Continuity** — feels like clicking *deeper* into that offender's file, not landing on a different site.
2. **Intent** — pays off **"criminal record"** literally.
3. **New value** — shows something HomeFacts *didn't* (map, photo/booking check, more addresses/relatives), so
   unlocking is the obvious next step rather than paying for what they already saw.

**Constraint we can't forget (compliance):** we corroborate/​frame offender status as *"possible — verify"* from
first-party signals; the hard criminal/offender detail reveals **post-pay from the licensed source**. We continue
HomeFacts' context but do not re-assert registry status as fact. FCRA disclaimer stays.

**Data we actually receive** from the outbound link: `firstName, lastName, city, state, type` (+ `shn`). We do
**not** get the offender ID, DOB, address, or photo — those must come from our own resolution (BC teaser / first-
party) or reveal post-pay. Maps we can draw instantly from `city, state`.

---

## 2. Design dimensions (the permutation space)

Every experience is a point in this space. "As many permutations as possible" = combinations of these axes.

| # | Dimension | Options |
|---|-----------|---------|
| D1 | **Resolve timing** (drives the captcha) | (a) auto-fire on mount `=v3` · (b) shell-first, resolve on tap `=v4` · (c) **no search on landing** — resolve at payment / first-party |
| D2 | **Lead framing** | Criminal record · Full profile/dossier · Safety/proximity ("near you?") · Neutral public record |
| D3 | **Hero visual** | Interactive **map** · Photo / booking-photo check · Offender-flag banner · Record-count teaser |
| D4 | **Free payoff vs HomeFacts** | Map of area · More addresses/relatives counts · Offense category / registry corroboration · Alias expansion |
| D5 | **Offer** | $1 trial → subscription (current) · One-time report price · Free email-account first, then pay |
| D6 | **CTA copy** | "View criminal record" (mirror the button) · "See full record" · "Unlock report" · "Continue →" |
| D7 | **Match UX** | Best-guess single · "Is this them?" + other matches · No resolution (pure params) |
| D8 | **Continuity cue** | "Continuing from HomeFacts" banner · Visual mirror of HomeFacts layout · None |

The biggest levers, in order of expected impact: **D1 (captcha/friction) › D2+D4 (intent + new value) › D5 (offer) › D8 (continuity) › D6/D3 › D7**.

---

## 3. Named permutations

| ID | Name | D1 timing | D2 lead | D3 hero | D5 offer | One-liner |
|----|------|-----------|---------|---------|----------|-----------|
| **P1** | v3 (bad control) | auto-fire | full profile | flag | trial | Current auto-fire; **captcha on arrival**. Known ~0. |
| **P2** | v4 (current) | shell→tap | offender flag | flag | trial | Shell-first, CTA up top. Better first paint; still "less than HomeFacts, locked." |
| **P3** | **Criminal-Record File** (A) | shell→tap | **criminal record** | **map** | trial | Titled like his record; map + registry echo + criminal teaser + "we found more addresses/relatives than HomeFacts." |
| **P4** | **Instant Map** (C) | **no search** | criminal record | **map** | trial | Zero captcha ever; params + map + record teaser → straight to unlock; resolve at payment. |
| **P5** | **Dossier** (B) | shell→tap | criminal-first | photo+map | trial | v4 enhanced with photo/booking slot + map + full breadth counts. |
| **P6** | **Proximity / Safety** | no search | safety ("near you?") | map+radius | trial | Reframes to family-safety; "see how close, get alerts." |
| **P7** | **Mirror HomeFacts** | shell→tap | criminal record | photo box | trial | Visually continues HomeFacts (photo box, reg-details table, "VIEW CRIMINAL RECORD" button) → our record teaser. Max continuity. |
| **P8** | **One-time offer** | (any) | criminal record | map | **one-time** | Same page as P3/P4 but a single-report price, not a subscription trap. Tests offer, not layout. |
| **P9** | **Free-account gate** | shell→tap | criminal record | map | **free acct → pay** | Show map + partial record free, capture email for a free peek, then pay for full. Two-step. |
| **P10** | **Record document** | no search | criminal record | redacted doc | trial | Land on a redacted "Criminal Record" document preview (rows blurred) → unlock. Skips the identity profile entirely. |

_(P1/P2 already built. P3=A, P4=C, P5=B from the earlier pick.)_

---

## 4. Assessment

Scored **1–5** (5 = best). "New value" = shows more than HomeFacts. "Friction" = fewer steps/no captcha (higher = less friction). "Build" = cheaper/faster (higher = less work). "Compliance" = lower risk (higher = safer).

| ID | Continuity | Intent-match | New value | Friction | Offer fit | Compliance | Build | **Verdict** |
|----|:--:|:--:|:--:|:--:|:--:|:--:|:--:|-------------|
| P1 v3 | 3 | 2 | 1 | **1** | 2 | 4 | ✓done | Retire — captcha kills it. |
| P2 v4 | 3 | 2 | 2 | 3 | 2 | 4 | ✓done | Keep as control only. |
| **P3 Criminal-Record File** | 4 | **5** | **4** | 3 | 2 | 3 | 3 | **Top pick.** Nails intent + new value + continuity. |
| **P4 Instant Map** | 4 | 4 | 3 | **5** | 2 | 3 | 3 | **Top pick.** Removes captcha entirely; fastest. Risk: thinner pre-pay proof. |
| P5 Dossier | 3 | 3 | 4 | 3 | 2 | 3 | 2 | Good, but closest to v4; photo often "not provided." |
| P6 Proximity/Safety | 3 | 3 | 3 | 4 | 3 | 3 | 3 | Strong secondary angle; different buyer emotion. |
| **P7 Mirror HomeFacts** | **5** | 4 | 3 | 3 | 2 | **2** | 2 | Highest continuity; **highest compliance risk** (re-serving registry look). Test carefully. |
| P8 One-time offer | — | — | — | 4 | **5** | 4 | 2 | **Orthogonal** — layer onto the winning layout; tests the paywall, not the page. |
| P9 Free-account gate | 3 | 3 | 4 | 2 | 4 | 3 | 3 | Captures the lead even on non-buyers; adds a step. |
| P10 Record document | 3 | **5** | 3 | 4 | 2 | 3 | 3 | Bold intent-match; feels like the record itself. |

### Cross-cutting reads
- **D1 timing is the dominant variable.** P1 proves auto-fire (captcha-on-arrival) is fatal. P4/P6/P10 (no-search) remove it entirely; P3/P5/P7 defer it to a tap. Any winner is (b) or (c), never (a).
- **"New value vs HomeFacts" is the conversion fuel.** The map (D3) is the cheapest, highest-impact new-value element — we can draw it instantly from `city,state` with the Leaflet/OSM we already have. Every serious contender includes it.
- **Offer (D5) is orthogonal to layout.** Don't confound it. Pick a layout first, then A/B the offer (P8/P9) on the winner.
- **Compliance gradient:** framing "possible offender record — verify" (P3/P4) is safe; visually *mirroring* HomeFacts' hard "Registered Sex Offender" assertion (P7) is the riskiest — worth testing but with the verify framing intact.

---

## 5. Recommended rotation (first test)

Keep the test clean: **one variable (layout), 3–4 arms, map in all serious arms, same offer across arms.**

- **Control:** P2 (v4) — what's live-ish now.
- **Arm 1:** **P3 Criminal-Record File** — intent + new value + map (deferred captcha).
- **Arm 2:** **P4 Instant Map** — same value, **no captcha ever** (isolates the friction lever vs P3).
- _(Optional Arm 3:_ **P7 Mirror HomeFacts** _— max continuity, if we accept the compliance review.)_

P3 vs P4 is the key experiment: **does removing the captcha entirely (P4) beat a richer resolved page that costs a tap+captcha (P3)?** That single comparison tells us how much the friction vs. proof tradeoff is worth. Then layer the **offer test (P8 one-time vs trial)** onto whichever wins.

**Sequencing:** stand up the funnel-event logging (§6) FIRST so every arm is measured from day one; then build the 3 arms; then rotate.

---

## 6. Measurement — our own funnel log (idlookup.me)

GA4 service-account access is blocked by the Workspace org policy (see `project_metrics_harness`). Rather than
wait, push funnel events **asynchronously to our own activity-log table in the idlookup.me Neon DB** and query it
directly. This is owner-controlled data with per-variant granularity — exactly what an A/B needs.

- **Table** `funnel_events` (Neon): `id, ts, session_id, anon_id, event, variant, shn, partner, path, params jsonb, referrer, ua, ip_hash`.
- **Endpoint** (Vercel serverless on idlookup.me): `POST /api/track` → validate + insert. CORS allow `idlookup.ai`.
- **Client** (idlookup.ai): a tiny `logActivity(event, data)` using `navigator.sendBeacon` / `fetch(keepalive)` —
  fire-and-forget, never blocks render. Hook it alongside the existing `track()` in `trackingService.js` so it
  mirrors the canonical funnel events (`landing_view, search_step, teaser_view, serp_result_onboarding, purchase`)
  plus `variant`.
- **Analysis:** query `funnel_events` by `variant` → landings → shell-view → resolve → unlock-tap → purchase. A
  simple funnel-by-variant view (or a `/admin` read) closes the loop.

This also becomes the general activity log for the whole funnel, not just HomeFacts.
