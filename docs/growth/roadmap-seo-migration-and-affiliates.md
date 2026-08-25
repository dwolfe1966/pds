# Roadmap — idlookup.ai SEO migration + affiliate onboarding (Fluent, MobileMarketing)

**Date:** 2026-08-25   **Status:** roadmap for review (team + BC architecture review)
**Audience:** growth + engineering; **Track A hosting decision is open for Kwan (BC CTO) to weigh in.**

This roadmap intentionally presents **options, not fait accompli**. Track A in particular carries a
genuine architecture decision we want reviewed, not rubber-stamped. Recommendations are the team's
current lean with honest trade-offs; the call is open.

---

## 0. Progress to date (what already works)

Leading with what's built, because the fastest way to de-risk both tracks is to show the load-bearing
parts already run in production.

**SEO directory (idlookup.me, Vercel + Neon):**
- Name×location directory **live**: ~214M person profiles, ~27M name hubs, 52 states + ~1,909 cities
  + roster-state counties + ~980 unique-content name pages. Pipelines in `seo/scripts`.
- Technical SEO layer clean: thin pages noindexed/de-listed (7/20), conservative `sitemapv2.xml`
  holding, robots/canonicals correct. Diagnosis of the traffic problem is **domain authority, not
  technique** (see `docs/seo/idlookup-ai-people-migration-scoping.md`).
- Migration already scoped end-to-end (the DNS/authority axis) in that doc.

**Affiliate plumbing (consumer app):**
- **Partner param capture + resolution** is built: `shN`/`shL` → campaign config via
  `src/services/campaignResolver.js` + `campaignRegistry.js` (fallback chain, BC ShapeCompiled merge).
- **Attribution persists to BC**: `src/services/trackingService.js` assembles URL params into BC's
  `data.refer` convention; **order-level `commerceorders.refer` is confirmed to persist** on the sale.
- **Conversion signal is live**: GA4 + Google Ads purchase tracking verified — the same
  confirmed-sale signal a postback should hang off.
- Reusable landing `/name/landing/v2` (`V2LandingSplit`) already routed (`src/App.js:223`).

**Net:** Track A needs one BC DNS action + a hosting decision. Track B is mostly *extending* existing
capture + adding a server-side postback — not building attribution from scratch.

---

## Track A — Migrate the SEO directory to idlookup.ai

**Why:** idlookup.me is a ~7-week-old standalone `.me` that took a deindex hit and has no trust —
17 impressions/7d, ~13k pages "discovered, not indexed," Bing zero. Authority can't be sitemap'd. The
lever is to serve the directory from **idlookup.ai** (aged, branded, revenue-bearing) so it inherits
real domain authority.

**There are two independent decisions here. Keep them separate.**

### Decision A1 — Where the SEO app runs (hosting) ← *this is the open architecture call*

The existing scoping doc assumed "app stays on Vercel, only the hostname changes." That answers A2,
not this. This is the decision the user flagged ("keep Vercel or not") and the one for Kwan to own.

| Option | What it means | Pros | Cons / cost |
|---|---|---|---|
| **A1-a · Stay Vercel + Neon** | SEO app stays exactly where it runs today | Already live & proven; **zero migration risk**; fast SEO iteration (ISR/edge/CDN built-in); recovery timeline unaffected; independence (repoint one CNAME to leave) | Separate stack from BC; separate vendor bill; SEO data in Neon sits apart from BC's DB; BC ops team doesn't operate it |
| **A1-b · Move SEO app onto BC infrastructure** | Re-host the Next.js app + data on BC's stack | Single stack under BC ops & observability; consolidated data ownership; aligns with one-architecture posture | Migration cost + risk; must reproduce Next.js ISR/SSR/edge-caching that SEO depends on; **slows a time-sensitive recovery**; re-plumbs a working system |
| **A1-c · Hybrid** | Vercel for SEO rendering/edge; data via BC APIs/DB | Keeps SEO velocity while moving data ownership toward BC | Cross-origin data latency; two systems to operate; partial-migration complexity |

**Team's working lean (open to review):** proceed on **A1-a now** to preserve the SEO recovery
timeline — it's fully reversible — and set an explicit **checkpoint to revisit consolidation (A1-b/c)
once the subdomain proves the model**. This is precisely the point to align with Kwan before we
commit; if the architecture direction is consolidation, we'd rather build toward it deliberately than
migrate twice.

### Decision A2 — How idlookup.ai authority reaches the app (DNS) ← *only if A1 = Vercel*

Fully worked in `docs/seo/idlookup-ai-people-migration-scoping.md`. Summary of the constraint: the
authority lives at idlookup.ai, which sits behind BC's edge, so inheriting it needs **one BC DNS/edge
change** — the goal is the smallest, most reversible one. Verified live 2026-07-23:

| Approach | BC involvement | Collision risk | Note |
|---|---|---|---|
| **Subdomain `people.idlookup.ai` → Vercel** (1 CNAME, DNS-only) | **One DNS record** | None (separate host) | Team lean; smallest reversible ask |
| Subpath `idlookup.ai/people/*` via Cloudflare Worker | High (needs BC to orange-cloud prod + run a Worker) | Yes — collides with the live `/people/:id` report route (`src/App.js`) | Blocked today: idlookup.ai DNS is grey-cloud (DNS-only), so no Worker interception |
| Subpath via BC nginx reverse-proxy | Highest (BC edits prod nginx) | Same `/people/:id` collision | Heaviest, most coupled |

The DNS options are downstream of A1. If A1 lands on BC infra, A2 is moot (BC controls the edge
directly). Presenting both so Kwan sees the full dependency, not a pre-closed choice.

### Track A plan (assuming A1-a + A2 subdomain — adjust if the review redirects)

**The one BC ask (minimal, reversible):**
> In Cloudflare for idlookup.ai, add `people` **CNAME → `cname.vercel-dns.com`**, **DNS-only (grey
> cloud)** (+ one TXT if Vercel's verification asks). No proxying, no origin/nginx change, no
> consumer-app impact.

**Everything else is ours on Vercel:**
1. Add `people.idlookup.ai` to the Vercel SEO project (Vercel issues SSL + the CNAME target).
2. Swap canonical base → `https://people.idlookup.ai`; regenerate sitemaps + robots on the new host.
3. **301** every `idlookup.me/<path>` → `people.idlookup.ai/<path>`; keep idlookup.me alive as a pure
   redirector for months so crawl equity flows.
4. GSC: add the new property, **Change of Address** from idlookup.me, submit sitemaps, request
   indexing on ~10 hero pages.
5. **Move the curated set only** (hub + states + cities + counties + ~980 unique name pages). **Do
   not** bring the ~41k thin name-in-city pages onto the branded domain.

**Visible progress we can make this week without the architecture decision:** stage the canonical-host
swap + 301 map + regenerated sitemaps behind a flag on Vercel, and prep the GSC change-of-address — all
reversible, none of it needs the BC DNS record until we flip. The only true gate is the one DNS ask.

---

## Track B — Affiliate onboarding: Fluent (Incent) + MobileMarketing (App)

Porting two affiliate partners from the compet site. Fluent's postback/reporting/cascade pattern was
already implemented there — we **port the pattern**, we don't invent it.

### What's built vs. what's new

| Capability | State | Where |
|---|---|---|
| Capture `shN`/`shL` + resolve partner config | **Built** | `campaignResolver.js`, `campaignRegistry.js` |
| Persist attribution to BC (`data.refer` / `commerceorders.refer`) | **Built** (order-level confirmed) | `trackingService.js` |
| Capture arbitrary partner sub-IDs (custom click IDs, SHLs) + pass them through | **Extend** — widen the refer passthrough key list to carry unknown partner IDs verbatim | `trackingService.js` |
| **Server-to-server postback** on confirmed sale (return the partner's original URL params) | **New** — none in `src/` today; port Fluent's compet pattern | backend (see design note) |
| CasA / CasD event mapping | **Open** — must be pinned with the partners (below) | — |
| Landing experiences | Reuse `/name/landing/v2` (MobileMarketing); **new** direct-to-SUP landing (Fluent) | `src/App.js`, `src/pages/sales/` |
| Reporting | **New** — monthly (Fluent), daily Google Sheet (MobileMarketing) | ops/script |

### Postback design note (ties back to Track A hosting)

Postbacks **must fire server-side from a conversion-confirmed point** (BC sale) — never a client
pixel (blocked in-browser; prod strips `console.*`). Hang it off the **same confirmed-sale signal GA4/
Ads already uses**. The open design question is *where the receiver runs* — BC emits the postback, or a
backend of ours receives the BC conversion webhook and fans out to partners. **That placement depends
on the Track A hosting decision** (A1), so we pin CasA/CasD and partner postback URLs first, and
finalize placement alongside A1.

### Per-partner requirements → build items

**Fluent (Incent — incentivized traffic):**
- Traffic is **incentivized** → low-intent; **"Direct to SUP"** fits. Creative + funnel must expect
  incent quality (affects CasA definition and any quality gating).
- Need **CasA** — *confirm what event Fluent is paid on, in BC order terms.* → **open item**.
- **Monthly** sales report (explicitly *not* CasD or CasA tiers) → monthly reporting deliverable.
- **Postback** returning the URL params they passed in → S2S postback on sale.
- **Placement on their wall** → **marketing creative** needed.
- **New Fluent landing** routing straight to SUP.

**MobileMarketing (App traffic):**
- Need **CasA**.
- **Daily** sales, likely a **Google Sheet** (not CasD/CasA) → daily reporting deliverable.
- **Postback** returning their original URL params → S2S postback on sale.
- People-search **or** background-check funnel. **Mostly backend**, except the **front end must capture
  partner-URL params (SHNs, SHLs, custom IDs) and persist them to BC** → extend param capture.
- **Reuse `/name/landing/v2`** for MobileMarketing (no new landing needed).

### Open items to confirm before building (do not guess)

- **CasA vs CasD** — these are distinct partner-facing sale/conversion tiers. We need the exact
  definition of each and which one each partner is paid on, mapped to a concrete BC order/sale event.
  Confirm with Fluent/MobileMarketing + BC billing.
- **Postback URLs + macro spec** per partner (which sub-ID params round-trip, param names).
- **Postback receiver placement** (BC-emitted vs our backend) — decide with Track A A1.

### Track B phasing

1. **Now (visible progress, low risk):** extend the refer passthrough to carry arbitrary partner
   sub-IDs verbatim and verify end-to-end that a MobileMarketing-style URL's params persist onto the
   BC order (`commerceorders.refer`). Reuse `/name/landing/v2`. *In parallel:* send partners the
   CasA/CasD + postback-URL questionnaire.
2. **Postback service:** build/port the S2S postback off the confirmed-sale signal; wire CasA/CasD
   event mapping once confirmed. Placement per A1.
3. **Fluent landing + creative:** new direct-to-SUP landing; wall-placement creative.
4. **Reporting:** monthly (Fluent) + daily Google Sheet (MobileMarketing).
5. **Go live per partner** once postbacks reconcile against partner-side numbers.

---

## P0 — Security (separate from the roadmap, act first)

- **Live OpenAI API key on disk:** `seo/docs/openai-key.rtf` contains a real `sk-proj-…` key.
  **Good news:** it is **untracked — never committed, not in git history** (`git ls-files` empty, no
  log), so there's **no repo leak**. **Still rotate/revoke it** — it has existed in plaintext on disk
  (and any process/backup that read the file). Rotation is the fix; the file is secondary.
- Sibling `seo/docs/credentials.rtf` also holds secrets, same untracked status.
- **`seo/docs/` is not gitignored** — one stray `git add` would commit both. Recommend: gitignore
  `seo/docs/*.rtf` (mirrors the `docs/admin/*.rtf` pattern) or relocate these to a gitignored creds
  path. I did not delete them (owner's files) — say the word and I'll gitignore the path.

---

## Open decisions to close (for the review)

1. **A1 — SEO hosting:** stay Vercel (A1-a, team lean) vs move to BC infra (A1-b) vs hybrid (A1-c).
   *This is Kwan's to weigh.*
2. **A2 — DNS (if Vercel):** confirm subdomain `people.idlookup.ai` (team lean) — needs the one BC
   DNS ask.
3. **B — CasA/CasD definitions + postback URLs + receiver placement** — gate for the affiliate build.
4. **P0 — rotate the OpenAI key + gitignore `seo/docs/*.rtf`.**
