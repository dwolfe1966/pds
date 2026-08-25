# Roadmap — SEO (organic acquisition)

**Date:** 2026-08-25   **Status:** roadmap for review
**Goal:** recover + grow organic traffic into a durable, near-zero-marginal-cost acquisition channel.

> The idlookup.ai migration is **one workstream inside this roadmap, and it is not a given** — it's a
> lever within the domain-strategy decision (WS1), which is open for BC architecture review. SEO is
> bigger than the migration.

---

## Diagnosis (why organic is floundering)

Grounded in `docs/seo/seo-recovery-brainstorm.md` + GSC evidence:

1. **100% generic people-directory pages** (`/people/[state]/[city]/[name]/[id]`) — the most saturated,
   least-differentiated page type in the space. Incumbents (Spokeo, TruePeopleSearch, BeenVerified) have
   millions of them *plus* authority *plus* links. We can't out-rank them on their own page type.
2. **New domain, ~zero authority** — idlookup.me is a young standalone `.me` that took a deindex hit.
3. **Thin pages actively hurt** — ~360k near-duplicate pages tripped a site-quality / helpful-content
   filter (the 7/13 impressions collapse). More thin pages = more dilution.
4. **Split domains** — SEO on idlookup.me vs. product on idlookup.ai may split authority.
5. **The moat is unused** — `seo/lib/` holds first-party incarceration, sex-offender, life-events, and
   person-search data. None of it powers an SEO page. We're fighting where we can't win with the one
   asset that could win.

**Thesis:** on a new domain, recovery is **not more pages — it's fewer, differentiated pages + authority.**

## What's already built / done

- Name×location directory live (Vercel + Neon): ~214M profiles, ~27M name hubs, 52 states, ~1,909
  cities, roster-state counties, ~980 unique-content name pages. Pipelines in `seo/scripts`.
- Technical hygiene largely done: thin tier noindexed/de-listed (7/20), conservative `sitemapv2.xml`
  holding, robots/canonicals correct, legacy→name-in-state 301s.
- First-party data pipelines exist but don't render SEO pages yet: `incarceration.mjs`,
  `stateInmates.mjs`, `inmatesDb`, life-events.
- Migration to idlookup.ai fully scoped (`docs/seo/idlookup-ai-people-migration-scoping.md`).

---

## The workstreams

### WS1 — Domain & authority strategy (the open architecture decision)

The question isn't only "migrate or not" — it's **which domain the organic footprint should live on, and
on whose infrastructure.** Options (decision open; ties to the hosting decision in the affiliate/eng
review):

| Path | What it is | Trade-off |
|---|---|---|
| Stay idlookup.me | Do nothing to the domain | Proven-failing — young `.me`, no authority. Not viable alone. |
| **Subdomain `people.idlookup.ai` → Vercel** | 1 CNAME, DNS-only; app stays on Vercel | Inherits idlookup.ai authority; smallest reversible BC ask; team lean per scoping doc |
| Subpath `idlookup.ai/people/*` | Cloudflare Worker or BC nginx | Strongest authority but blocked today (grey-cloud DNS) + collides with live `/people/:id` report route |
| Consolidate onto BC infra | Re-host SEO app under BC | CTO-consolidation posture; heavier; slows recovery — see the hosting decision doc |

**This is deliberately left open for architecture review.** The recovery plan below (WS2–WS5) is
**domain-agnostic** — it delivers value on whichever domain wins. Don't let WS1 block WS2–WS5.

### WS2 — Stop the bleed (technical hygiene) · *do first, mostly done*

- **Prune/noindex the thin tier** — keep only pages with real, unique data; noindex the near-duplicate
  long tail. (Fewer thin pages *raises* site quality post-helpful-content.)
- **Kill the duplicate tree** — `/people/...` and `/profiles/...` are parallel hierarchies; pick one,
  301 the other. Duplicate structures dilute and confuse crawlers. *(Open — verify current state.)*
- Sitemaps/robots/canonical clean on whichever domain WS1 selects.

### WS3 — Differentiate survivors with first-party data (the moat) · *highest-ceiling growth*

The only reason Google ranks *our* name/location page over an identical competitor's is **unique data.**

- **Lead vertical = inmate / incarceration.** Stand up pages from existing `stateInmates` data:
  "inmates named [X] in [state]," per-facility rosters ("[County] Jail inmate roster"), state DOC hubs.
  Unique first-party data + **proven paid intent** (the criminal/inmate ad channel converts — SEO
  compounds the paid success) + genuinely useful (families of the incarcerated). Pipelines exist; they
  just don't render pages. See the incarceration-MOAT track.
- **Second vertical = life-events** (marriage/divorce, death) — first-party/licensed, flow-aware.
- **Augment surviving name pages** with first-party records (inmate counts, life-events) so they're no
  longer thin duplicates.
- **Renderability advantage:** first-party data is **not Turnstile-gated** (unlike BC teaser data),
  so it renders server-side into indexable pages — the SEO-TEASER blocker doesn't apply here.

### WS4 — Build authority (the actual bottleneck) · *the constraint the owner named*

Programmatic pages don't build authority — content, links, and brand do.

- **Editorial / how-to content:** "how to find an inmate in [state]," "how to look up divorce records in
  [state]," "how to remove your info from data brokers." Much lower competition than name pages, earns
  links, builds topical authority, funnels into the tools. This is how a new domain *earns the right* to
  rank the harder pages later.
- **Link acquisition / digital PR** off the first-party data (unique inmate/data-broker datasets are
  linkable assets).
- Consolidate brand signals onto one domain (WS1).

### WS5 — Measurement

- GSC: impressions/clicks recovery, index coverage (valid vs. excluded/thin), Change-of-Address health
  if WS1 migrates.
- Rankings on inmate/vertical + how-to terms (not generic name pages).
- **Organic → report conversion** (the revenue metric, not just traffic).
- Pilot discipline: measure the inmate pilot vs. the pruned baseline over 4–6 weeks before scaling.

---

## Phasing

- **Now (domain-agnostic, no BC decision needed):** finish WS2 (confirm duplicate-tree collapse); stand
  up an **inmate-vertical pilot** (WS3) — a small set of facility/roster pages from existing data; draft
  2–3 cornerstone how-to articles (WS4). Measure vs. baseline.
- **Near (needs WS1 decision):** execute the chosen domain path; if subdomain, the one BC DNS ask +
  GSC Change-of-Address + curated-set move (per the scoping doc — curated pages only, NOT the ~41k thin
  pages).
- **Mid:** scale the winning vertical(s); expand editorial + link building; augment survivors.
- **Long:** compound authority; broaden verticals (life-events, sex-offender per NSOPW) as they prove.

## Open decisions

1. **WS1 domain/hosting** — which domain the footprint lives on + whose infra (open for architecture
   review; see the hosting decision). Recovery plan proceeds regardless.
2. **Pivot vs. fix appetite** — the hybrid (prune + differentiate + authority) works either way; it only
   changes how aggressively we prune vs. augment. Confirm appetite.
3. **Vertical priority** — inmate first (recommended, rides proven paid intent) vs. life-events.

## What we can do this week (visible progress, no decision gated)

- Confirm/complete the duplicate-tree collapse + thin-page pruning state.
- Ship an **inmate-vertical SEO pilot** from existing `stateInmates` data (differentiated, renderable,
  no Turnstile issue).
- Draft the first cornerstone how-to article.
