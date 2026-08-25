# SEO — 90-day execution roadmap

**Window:** ~90 days · 12 weeks (relative to kickoff; no fixed calendar dates)
**Companion strategy:** [`roadmap-seo.md`](roadmap-seo.md) (the why + workstreams WS1–WS5).

## Framing (set expectations before the plan)

SEO lags — on a young domain that took a deindex hit, **authority compounds over quarters, not weeks.**
So this 90-day plan is judged on **leading indicators** (pages indexed & valid, rankings on vertical/
how-to terms, referring domains, first organic→report conversions), **not** on a traffic hockey-stick.
The goal by Day 90: a **proven, differentiated vertical model** + the authority foundation that makes
organic traffic compound after the window.

**Design principle — don't block on the domain decision.** Months 1–3 below are **domain-agnostic**
(WS2–WS5). The WS1 domain/hosting decision (techBC) only affects *where* the pages live; if it slips, the
differentiation + authority work still proceeds and simply moves with the domain when it lands.

**Owner key:** Lead (L) · Developer (D) · Analyst/Report Dev (A) · Designer (Dz). *(Names per `team_roles`.)*

---

## Month 1 — Foundation + differentiator launch (Weeks 1–4)

*Stop the bleed, launch the moat vertical, seed authority, set the baseline.*

| Wk | Sprint | Deliverable | Owner | Gate/dep |
|---|---|---|---|---|
| 1 | **Hygiene close-out (WS2)** | Confirm thin-tier pruned/noindexed; **collapse the duplicate `/people` vs `/profiles` tree** (pick one, 301 the other); sitemaps/robots/canonical clean | D | — |
| 1 | **Measurement baseline (WS5)** | GSC baseline snapshot (impressions, clicks, index coverage valid/excluded); rank-tracking set for inmate + how-to terms; organic→report funnel event confirmed | A | — |
| 1–2 | **Inmate pilot v1 (WS3)** | Stand up a bounded set from existing `stateInmates` data: "inmates named [X] in [state]" + per-facility roster pages + state DOC hub, for roster-covered states (FL + 2–3). Internal-link from existing hubs. JSON-LD schema. | D | data pipelines exist (`stateInmates.mjs`, `inmatesDb`) |
| 1–2 | **Authority seed (WS4)** | Publish cornerstone how-to #1: "How to find an inmate in [state]" | L/Dz | — |
| 2 | **Domain decision (WS1)** | Put A1 hosting options to techBC; if subdomain approved → file the one BC DNS ask + add `people.idlookup.ai` in Vercel + prep GSC Change-of-Address | L | **techBC decision** |
| 3–4 | **Domain move (if approved)** | Canonical swap → new host; 301 every `idlookup.me/*` → new host (keep .me as redirector); regenerate sitemaps/robots; GSC Change-of-Address; request-index ~10 hero pages. **Move CURATED set only — not the ~41k thin pages.** | D | DNS ask done |
| 3–4 | **Inmate pilot v2** | Expand states/facilities; county roster hubs; tighten internal linking | D | pilot v1 live |
| 3–4 | **Authority seed x2** | How-to #2 + #3 (e.g. "look up divorce records in [state]", "remove your info from data brokers"); begin link/PR outreach off the inmate dataset | L | — |

**Month-1 exit gate (KPIs):** duplicate tree collapsed; inmate pilot **indexed & coverage-valid**; 3
cornerstone articles live; baseline captured; domain move complete **or** DNS ask filed. *Leading signal
to watch: pilot pages moving into "valid/indexed," first impressions on vertical terms.*

---

## Month 2 — Differentiate at scale + prove the model (Weeks 5–8)

*Scale the vertical, kill remaining thinness, read the pilot, build links.*

| Wk | Sprint | Deliverable | Owner | Gate/dep |
|---|---|---|---|---|
| 5–6 | **Scale inmate vertical (WS3)** | National coverage where data exists; per-county roster hubs; state DOC hubs; consistent schema + internal-link architecture (hub→spoke) | D | pilot proving out |
| 5–6 | **Augment survivors (WS3)** | Inject first-party data (inmate counts, life-events) into surviving name/location pages so they're no longer thin duplicates | D | — |
| 6–7 | **Life-events pilot (WS3)** | Divorce/marriage how-to + data pages where licensed (person-keyed); flow-aware | D/A | licensing/legal ok |
| 5–8 | **Editorial + links (WS4)** | 2–3 more how-to articles; active link/digital-PR outreach; internal-link pass | L/Dz | — |
| 7–8 | **Pilot read (WS5)** | 4–6-week read on inmate pilot vs. pruned baseline: coverage, rankings, impressions, organic→report. Double down on the page types/terms that rank; cut what doesn't | A | Month-1 launch data |

**Month-2 exit gate (KPIs):** inmate pages **ranking (top ~20–50)** on target terms; organic impressions
**recovering vs. baseline**; **first organic→report conversions** from the vertical; **referring domains
up** (first earned links); explicit **go/scale vs. hold** call per page type. *If the pilot isn't
ranking at all by end of M2, escalate the domain-authority question — that's the real bottleneck, not
page volume.*

---

## Month 3 — Compound + expand + authority push (Weeks 9–12)

*Scale what's proven, add the second vertical, run a real PR/link campaign, decide next quarter.*

| Wk | Sprint | Deliverable | Owner | Gate/dep |
|---|---|---|---|---|
| 9–10 | **Scale proven vertical(s)** | Expand the winning page types; add life-events at scale **only if** its pilot proved (M2); prune anything that didn't rank | D/A | M2 read |
| 9–10 | **Conversion path (WS5)** | Optimize organic→report/paywall path on vertical pages (CTAs, teaser→unlock); measure conversion, not just traffic | Dz/A | — |
| 11–12 | **Authority campaign (WS4)** | Digital-PR data study off a unique first-party dataset (e.g. "incarceration by county") as a linkable asset; outreach | L | dataset ready |
| 11–12 | **Quarter review + next plan (WS5)** | Full measurement review; go/no-go per vertical; next-quarter SEO plan; confirm domain-authority trajectory | L/A | — |

**Month-3 exit gate (KPIs):** **sustained** organic impression/click growth vs. Day-0 baseline; ranking
gains on vertical + how-to; **measurable organic→revenue**; **referring-domain count up**; documented
go/no-go per vertical + next-quarter plan.

---

## The KPI dashboard (track weekly; leading indicators first)

| Metric | Why | Day-0 | M1 target | M2 target | M3 target |
|---|---|---|---|---|---|
| Pages indexed & **coverage-valid** | The prerequisite; thin-page filter is the current wound | baseline | pilot valid | vertical valid | scaled valid |
| **Rankings** on inmate/how-to terms | Where a new domain *can* win | ~none | on-page (50–100) | top 20–50 | top-10 gains |
| **Referring domains** | The actual bottleneck (authority) | baseline | outreach live | first links | campaign links |
| **Organic → report conversions** | Revenue, not vanity traffic | ~0 | instrument | first conv. | growing |
| Organic impressions/clicks (GSC) | Lagging confirmation | 17 impr/7d | stabilizing | recovering | growing |

## Dependencies & risks

- **WS1 domain/hosting decision (techBC)** — gates only the domain move; everything else proceeds. If it
  slips past Month 1, do the differentiation + authority work on idlookup.me and migrate later.
- **Legal review** for criminal/inmate/sex-offender page copy + claims before scaling those page types.
- **Authority is the real constraint** — if pilots don't rank despite unique data, the answer is more
  links/brand + domain consolidation, not more pages. The plan front-loads the leading indicators so we
  catch this by end of Month 2, not Month 3.

## First moves this week (no decision gated)

1. Confirm/close the duplicate-tree collapse + thin-prune state (D).
2. Ship inmate pilot v1 from existing `stateInmates` data (D).
3. Publish cornerstone how-to #1 + capture the GSC baseline (L/A).
4. Put the A1 domain/hosting options to techBC (L).
