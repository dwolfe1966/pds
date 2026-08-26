---
name: project_acquisition_plan_2026_08_15
description: "Customer-acquisition brainstorm for idlookup.ai — constraint=traffic; 4 picks (widget/free-score/referral/check-your-date); pivot to FREE TIER build"
metadata:
  type: project
---

**Brainstorm 2026-08-15: "how do we get more customers to idlookup.ai."** Owner's stated CONSTRAINT = **traffic** (not conversion) right now. Full option menu in the session; owner PICKED four:
- **a.3 — Embeddable partner widget** (drop-in on HomeFacts/partner pages → our funnel; taps existing partner volume; cheapest net-new traffic).
- **b.5 — Free "Exposure Score" lead magnet** (product-led front door; free "see YOU" reveal, lowers $1-trial friction).
- **b.6 — Referral / "check a friend"** (viral share layer on top of b.5).
- **c.7 — Check-Your-Date paid pilot** (composite safety funnel /name/landing/v14; spec exists in docs/marketing/2026-07-23-*).

**Synthesis:** the 4 = TWO workstreams — (1) a viral loop **a.3→b.5→b.6** (widget seeds → free score hooks → referral spreads), (2) paid pilot **c.7**. Traffic-constraint splits them into SOURCES (widget a.3, paid c.7 = raise top of funnel) vs MULTIPLIERS (b.5+b.6 = need a seed to compound). Lead with a source.

**Owner answers (AskUserQuestion 2026-08-15):** start = **BOTH tracks in parallel**; widget hook = **"Who's searching for YOU"** (WSFY curiosity loop, our differentiated two-sided engine); paid = **build now, HOLD spend** until widget/funnel yields real CAC/LTV.

**⚠️ IMMEDIATE REDIRECT (owner, same session):** before the above, **FOCUS on building + "clearing up" the FREE TIER in idlookup.ai, with clear/clean TRANSITIONS.** The free tier is fragmented across several partially-built self/identity routes (/my-exposure, /my-identity, /people-search, /proof-check, exposure graph, WSFY) — owner wants it consolidated into ONE clear free experience with clean entry→free-value→paid transitions. This is the home for b.5. Doing an audit-first findings report (cleanup protocol) before bulk-building. Ties [[project_freemium_identity_community]] (free = MyLife partial-reveal "see YOU", NOT free report), [[project_identity_management]], [[project_wsfy_self_build]], [[project_exposure_graph]], [[project_growth_plan_2026_07_11]] (Wave-2 free experience).

**Full growth framework saved: `docs/design/2026-08-15-acquisition-growth-directions.md`** (engines A–D, ideas 1–10, owner picks, decisions, free-tier principle).

**⚠️ FREE-TIER PRINCIPLE (owner, 2026-08-15) — reverses my earlier "anonymous score" lean:** the **free tier needs PII to provide real value, so the FREE ACCOUNT is the value unlock**; anonymous gets only a limited teaser whose ONE job is to drive **free-account creation** (captures PII = their identity + the lead). Real value (Exposure Score, where-exposed, WSFY count, specifics masked) lives behind the free account, then pushes to PAID. Spine: **anonymous teaser → FREE ACCOUNT (real value, masked) → PAID (full/protect)**. So we capture the lead AT the value moment, not give the payoff away anonymously.

**Free-tier audit findings (Explore, 2026-08-15):** current mess = (1) 6+ redundant self-exposure front doors (/my-exposure=/name/landing/self, /proof-check=/name/landing/proof, honest /people-search, /see-who, /phone/exposure, /email/exposure) all dumping into the same /name/loader with a cosmetic ?variant; (2) EVERY free self-experience is ORPHANED from nav (grep-confirmed 0 links) → only reachable via ad deep links = a traffic leak; (3) no anonymous exposure SCORE (locked behind login+identity-claim in ProtectionScoreRing; ExposureScoreWidget exists in DEAD unrouted DashboardHome); (4) two competing score lenses (Protection vs Exposure); (5) free-member state = dead-end paywall preview (full MemberNav but all surfaces masked, /people/:id → PaidRoute→/payment), not a usable free product; (6) silent account creation on /see-who. Codebase already names 3 states: anonymous → free member (account/unpaid) → paid (AuthContext isPaid from BC billing.getOrders; PaidRoute guards only /people/:id). Proposed spine: Exposure(problem, free)→Protection(solution, paid); unify the EXPERIENCE + make it discoverable (respect live A/B route experiments — unify shared reveal, don't delete angle routes; collapse pure aliases).

**FREE-TIER SPINE BUILT 2026-08-15 (commits 5aaffab + 0a3b4a3, on main, NOT deployed — owner deploys consumer bundle):**
- **#1 FreeExposureHero** (`src/components/FreeExposureHero.js`) — free members' dashboard now leads with EXPOSURE (Dashboard2: `isPaid ? ProtectionScoreRing : FreeExposureHero`; paid untouched). TEASER NOT A WALL (owner: expose much in the clear) — real per-category details (city/state, address-hist count, relatives, employer, breach count+classes) shown with "EXPOSED" flags; paid unlocks itemized specifics + hide-power. Reuses `computeExposure` + `syncBreach` (HIBP on signup email = the scary driver a fresh acct has, fixes the name+state-only "Low" trap). Unclaimed state = ConfirmIdentity mini-form capturing name+CITY+state (city lets enrichViaPersonSearch populate relatives/addresses).
- **#2 Anonymous→free-account seam** (`MyExposurePage.js`) — `/my-exposure` now bridges name/city/state into the mapped-identity store (wsfyMappedIdentity, what the hero reads) + routes to `/signup?redirect=/dashboard&flow=exposure` (FREE acct, no card, lands on the populated hero) instead of the old paywall loader→SRP. Explicit signup (kills silent-account smell). Verified: PII bridged + lands on free signup.
- **#3 Discoverability** (`SalesNav.js`) — added "Check My Exposure" nav link (was orphaned = traffic leak).

**a.3 WSFY WIDGET — BUILT 2026-08-18 (commit 1c5a52e, on main, NOT deployed).** Embeddable partner widget `src/pages/sales/WsfyWidget.js` at route `/widget/wsfy` (bare — `/widget` added to SELF_CHROME_PREFIXES so Header+Footer suppress). "Is someone searching for you?" hook; CTA is a `target="_top"` link that breaks out of the iframe → free-tier funnel `/my-exposure` with attribution forwarded (partner→utm_source, shn, utm_medium=widget, utm_campaign=wsfy). No separate hosting (route in our app). Partner embed guide: `docs/marketing/wsfy-widget-embed.md`. Verified bundle: bare render, console clean, CTA href correct. This is the a.3→b.5 loop (widget seeds the free tier).

**b.6 REFERRAL — BUILT 2026-08-18 (commit 28f9734, on main, NOT deployed).** "Check a friend" share in the free-member exposure hero's EXPANDED view (`FreeExposureHero` ReferralShare): "Know someone who should check theirs? [Check a friend →]" → navigator.share (mobile) / clipboard (desktop) of `/my-exposure?utm_source=referral&utm_medium=share&utm_campaign=check-a-friend`. No backend referral codes yet (utm attribution only) — v1 to start the viral loop; incentive design is a later owner call. Verified on the real free dashboard.

**c.7 CHECK-YOUR-DATE — ALREADY BUILT.** `/name/landing/v14` (NameSearchLandingV14Page, DATING_CFG, flow='dating', DatingTeaser) is a complete dating/safety-check funnel. Only the ad spend is held (owner-gated). Nothing to build.

**→ ALL FOUR PICKS now addressed: a.3 ✅ b.5 ✅ b.6 ✅ c.7 ✅ (pre-existing). Deploy bundles pending owner.**

**FOLLOW-UPS (not yet done):** (a) LIVE verify the free-member dashboard hero (needs an unpaid BC session — owner has one?); (b) apply the SAME free-account seam to the OTHER anonymous doors (/proof-check, /see-who, /phone/exposure, /email/exposure — still old paywall handoff / silent-account on see-who); (c) server-sync the bridged identity (currently local mirror drives display; enrich fires post-login); (d) reconcile/collapse the redundant self routes (unification). Then the b.5 free-tier is complete → widget (a.3) + referral (b.6) + Check-Your-Date landing (c.7) per [[project_growth_plan_2026_07_11]].
</content>
