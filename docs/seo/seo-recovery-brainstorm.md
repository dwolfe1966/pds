# SEO recovery brainstorm — "recover + grow organic traffic"

**Date:** 2026-07-20 · owner goal: **recover + grow organic traffic** (bottleneck: new-domain authority + thin
pages). Owner appetite (pivot vs. fix-current) still open — this doc argues a hybrid.

## Diagnosis — why it's floundering
1. **100% generic people-directory pages.** Every SEO route is `/people/[state]/[city]/[name]/[id]` (plus a
   *parallel* `/profiles/...` tree). That's the most saturated, least-differentiated, thinnest content in the
   space — Spokeo/TruePeopleSearch/FastPeopleSearch/BeenVerified have millions of them + authority + links.
2. **New domain, ~zero authority.** idlookup.me can't out-rank incumbents on *their* page type.
3. **Thin pages actively hurt.** 360k near-duplicate pages on a new domain → helpful-content / site-quality
   filter → the 7/13 impressions collapse. More thin pages = more dilution.
4. **Split domains.** SEO on idlookup.me vs. product on idlookup.ai may be splitting authority.
5. **The moat is unused.** `lib/` has first-party **incarceration, sexOffender, life-events, person-search**
   data — none of it powers an SEO page. We're fighting where we can't win with the one asset that could win.

## Thesis
Recovering organic on a NEW domain is **not more pages — it's fewer, differentiated pages + authority.** Two
moves, in order: (1) stop the bleed + differentiate what survives, (2) build the authority we lack.

## Recovery plan (phased)

**Phase A — Stop the bleed (technical hygiene, do first).**
- **Prune/noindex the thin tier.** Keep only pages with real, unique data; noindex the near-duplicate long tail.
  (Fewer indexed-but-thin pages *raises* site quality — counterintuitive but real post-helpful-content.)
- **Kill the duplicate tree.** `/people/...` AND `/profiles/...` are parallel structures — pick one, 301 the
  other. Duplicate hierarchies dilute + confuse crawlers.
- **Evaluate domain consolidation.** idlookup.me vs. idlookup.ai/people — pooling authority onto one domain
  (or the product domain via path-split, which already exists per the SEO deploy notes) likely helps a new site.

**Phase B — Differentiate the survivors with first-party data.**
- The only reason Google ranks *our* name/location page over a competitor's identical one is **unique data.**
  Augment surviving pages with our first-party records (inmate counts/rosters, life-events) — the stuff no
  competitor has.
- **Lead vertical = inmate/incarceration.** Pages like "inmates named [X] in [state]," per-facility rosters
  ("[County] Jail inmate roster"), state DOC hubs. Unique first-party data + **proven intent** (this is the
  7.15%-CVR ad channel — SEO compounds the paid success) + genuinely useful (families of the incarcerated).
  Pipelines already exist (`incarceration.mjs`, `stateInmates.mjs`, `inmatesDb`) — they just don't render pages.

**Phase C — Build authority (the actual bottleneck).**
- **Editorial / how-to content:** "how to find an inmate in [state]," "how to look up divorce records in
  [state]," "how to remove your info from data brokers." *Much* lower competition than name pages, earns links,
  builds topical authority, and funnels into the tools. This is how a new domain *earns the right* to rank the
  harder pages later.
- Authority is the constraint the owner named; programmatic pages don't build it — content + links + brand do.

## What to STOP
Expanding generic name×state pages. Every new thin page dilutes the domain further and feeds the filter.

## The two paths (owner's open question) + recommendation
- **Pivot (vertical/first-party):** highest ceiling, plays to the moat; abandons the people-directory build.
- **Fix + differentiate (keep structure, augment + prune):** lower risk, salvages pages; still competes on name
  pages (hard to win on a new domain).
- **Recommended = hybrid:** **prune hard (A) + differentiate survivors with first-party data (B) + build
  authority via editorial (C)** — and point ALL *new* page investment at the **inmate vertical**, not more name
  pages. This is the literal "recover organic traffic" path: fewer/better pages + authority, moat as the
  differentiator, riding the one intent we already convert.

## Known constraints / open items
- **SEO-TEASER / Turnstile blocker** (memory): SEO pages can't render live BC teaser data (Turnstile gates it).
  But first-party data (inmate/life-events on idlookup.me's own APIs) is NOT Turnstile-gated → another reason
  the moat data is the right SEO fuel (renderable server-side, unlike BC teaser).
- **Measurement:** GSC impressions/clicks recovery, index coverage (valid vs. excluded/thin), rankings on
  inmate/vertical + how-to terms, organic→report conversions.
- **Prereq decision:** owner appetite (pivot vs. fix) — the hybrid above works either way; it just changes how
  aggressively we prune vs. augment.

## Suggested first concrete step (when owner picks a lane)
A **pruning + inmate-pilot**: (1) noindex the thin long-tail + collapse the duplicate tree, (2) stand up a small
set of inmate/facility pages from existing `stateInmates` data as a differentiated pilot, (3) 2–3 cornerstone
how-to articles for authority. Measure the inmate pilot vs. the pruned baseline over 4–6 weeks before scaling.
