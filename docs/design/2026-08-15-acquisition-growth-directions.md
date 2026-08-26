# IDLookup.ai — Customer Acquisition: Growth Directions

**Date:** 2026-08-15
**Context:** Brainstorm on "how do we get more customers to idlookup.ai."
**Owner's stated constraint:** **traffic** (not conversion) is the bottleneck right now.

---

## Frame: acquisition = Traffic × Conversion

More customers = more arrivals × better conversion. We have distinct **traffic engines** with
very different economics. Our unfair advantages sit in the partner and product-led engines, yet
most past effort has gone to on-page/funnel (conversion) work — that's the gap.

| Engine | Economics | Our position |
|---|---|---|
| **A. Partner / warm** | Cheap, in-family, already flowing | **Underexploited** (HomeFacts/NIC) |
| **B. Product-led / viral** | Compounding, near-zero CAC, uniquely ours | **Mostly unbuilt** |
| **C. Paid** (Google/Meta) | Instantly scalable, rented | Gated on CAC/LTV (unknown) |
| **D. Earned / organic** | Slow, durable | SEO struggling; data-PR untried |

Given traffic is the constraint, ideas split into **sources** (raise the top of funnel) vs
**multipliers** (make each visitor spawn more). Lead with a source; layer multipliers on top.

---

## Engine A — Partner / warm traffic *(highest ROI right now)*

1. **Scale HomeFacts placements.** ~135k visits/mo + the person/offender traffic HomeFacts currently
   brokers to TruthFinder/Intelius — convert it to our owned funnel. More placements, more intents.
2. **Other NIC properties + a real affiliate program.** The people-search space runs on affiliates;
   stand up rev-share and *be* the destination others send to.
3. **Embeddable widgets.** A drop-in "search this person / who's searching for you" widget partner
   sites embed — turns their pageviews into our top-of-funnel. *(← owner pick)*

## Engine B — Product-led & viral *(compounding, our moat)*

4. **Searched-become-searchers loop (WSFY as acquisition).** Every search of "John Smith" makes John
   Smith a prospect: "N people looked you up — see who." Turns our own search volume into a
   compounding acquisition list. Structurally impossible for one-sided competitors.
5. **Free "Exposure Score" lead magnet.** A low-friction "see how exposed YOU are" front door that
   creates the anxiety that converts — the free "see YOU" model as the *front door*. *(← owner pick)*
6. **Referral / "check a friend."** Share your score / check a date / roommate / caregiver — social
   sharing baked into the safety use-case. *(← owner pick)*

## Engine C — Paid *(fastest to scale, gated on economics)*

7. **Ship an angle funnel — Check-Your-Date** (criminal + sex-offender + marriage + catfish;
   highest intent, showcases full breadth; build spec exists). *(← owner pick)*
8. **Reverse-phone safety / scam-check** (Twilio approved) — one of the highest-volume search intents.

> The blocker on all of Engine C is one number: **real CAC vs subscriber LTV.** We don't know it —
> which is why partner + product-led go first (they produce the LTV data that unlocks confident spend).

## Engine D — Earned / organic *(slow, durable)*

9. **Data-PR off the moat.** First-party datasets nobody else has (inmate counts by state, SO density)
   → data studies earn press + backlinks + referral traffic *and* feed idlookup.me's authority problem.
10. **SEO → idlookup.ai handoff** (name-in-state → teaser funnel; already wired).

---

## Selected priorities (owner) → two workstreams

Owner picked **a.3, b.5, b.6, c.7**. They compose into two workstreams:

- **Viral acquisition loop = a.3 → b.5 → b.6.** Widget seeds visitors → free Exposure Score hooks them
  → referral spreads it. One system, not three features.
- **Paid pilot = c.7** (Check-Your-Date), separate track.

## Decisions (2026-08-15)

- **Start:** both tracks in parallel.
- **Widget hook (a.3):** **"Who's searching for YOU"** — the WSFY curiosity loop (highest CTR, our
  differentiated two-sided engine).
- **Paid (c.7):** **build the landing now, HOLD spend** until the widget/funnel yields real CAC/LTV.

## Free-tier principle *(owner, 2026-08-15)*

**The free tier needs PII to provide real value — so the FREE ACCOUNT is the value unlock, and the
anonymous experience exists to drive account creation.**

- **Anonymous:** limited teaser value only (a compelling, honest hook — "your info is probably public;
  find out"). It does **not** try to be the whole product.
- **Everything anonymous pushes toward creating a FREE-tier account** (captures PII: their identity).
- **Free account:** with PII in hand, deliver real value — Exposure Score, *where* they're exposed,
  "who's searching for you" count — specifics masked, with a clean push to **paid** (protect / full
  reveal / see others).

This reverses an earlier "show the score fully anonymous" lean: we capture the lead *at* the value
moment rather than giving the payoff away for free. Clean spine:

```
ANONYMOUS (teaser)  →  FREE ACCOUNT (real PII-based value, masked specifics)  →  PAID (full)
   hook, no PII            the value unlock + lead capture                        protect / reveal
```

---

## Where to place the first bets

1. **Prove the HomeFacts/partner funnel converts** (warm, cheap, live) → also produces CAC/LTV data.
2. **Build the WSFY "someone searched you" loop** — the one engine that compounds and only we can build.
3. **Consolidate + build the free tier** around the anonymous-teaser → free-account → paid spine
   (the home for b.5); make it *discoverable* (today every free self-experience is orphaned from nav —
   a self-inflicted traffic leak).
4. **Then** open paid (Check-Your-Date), funded by real economics.

*Related: `.claude/memory/project_acquisition_plan_2026_08_15.md`,
`docs/design/2026-07-11-master-growth-plan.md`, `project_freemium_identity_community`,
`project_wsfy_self_build`.*
