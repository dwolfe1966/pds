# Growth roadmaps — index + cross-cutting decisions

**Status:** for team + BC architecture review

From the growth review ($20k/mo burn vs ~$500/mo revenue → close a ~40× gap; the gap is
**qualified traffic, not product**). Each channel is its own full roadmap; this index holds the pieces
that cut across them.

## The roadmaps

| Channel | Doc | Role in the plan |
|---|---|---|
| **Paid marketing** | [`roadmap-paid-marketing.md`](roadmap-paid-marketing.md) | **The proven engine** — real conversions/revenue, CPAs dropping. Scale it. |
| **Affiliate platform** | [`roadmap-affiliate.md`](roadmap-affiliate.md) | **Near-term new traffic** — reusable platform; Fluent/MobileMarketing as instances. |
| **SEO** | [`roadmap-seo.md`](roadmap-seo.md) · [90-day](roadmap-seo-90day.md) | **The durable moat** — cheap organic later; first-party data + authority. |

Companion: [`growth-scorecard.csv`](growth-scorecard.csv) (one-line status of all channels).

**How they ladder:** paid is what works today → scale it (fastest revenue). Affiliates add new partner
traffic on top of the same funnel. SEO builds the near-zero-marginal-cost channel underneath, using the
same first-party data (inmate, life-events) that the paid winners already convert on. One funnel, three
feeders — not three separate products.

---

## Cross-cutting decision — app hosting & architecture (open for Kwan, BC CTO)

This one decision touches **two** roadmaps, so it lives here. Presented as **options, not a fait
accompli** — it's a genuine architecture call we want reviewed.

**There are two separate decisions. Keep them apart.**

### A1 — Where the app(s) run (hosting) ← *the open call*

| Option | Means | Pros | Cons / cost |
|---|---|---|---|
| **A1-a · Stay Vercel + Neon** | Runs where it does today | Live & proven; **zero migration risk**; fast SEO iteration (ISR/edge); reversible (repoint 1 CNAME) | Separate stack/bill from BC; data in Neon apart from BC's DB; BC ops doesn't run it |
| **A1-b · Move onto BC infra** | Re-host under BC | Single stack + observability under BC; consolidated data | Migration cost/risk; must reproduce Next.js ISR/SSR/edge; **slows a time-sensitive SEO recovery** |
| **A1-c · Hybrid** | Vercel render/edge; data via BC | Keeps SEO velocity, moves data ownership toward BC | Cross-origin latency; two systems; partial-migration complexity |

**Team's working lean (open):** proceed on **A1-a now** (reversible) to keep the SEO recovery moving,
with an explicit **checkpoint to revisit consolidation** once the model proves out. This is exactly the
point to align with Kwan — if the direction is consolidation, build toward it deliberately vs. migrate
twice.

**Why it's cross-cutting:**
- **SEO** ([WS1](roadmap-seo.md)) — the recovery plan (prune → first-party differentiation → authority)
  is domain-agnostic; only the domain/host move depends on A1.
- **Affiliate** ([postback](roadmap-affiliate.md)) — *where the postback receiver runs* (BC-emitted vs.
  our backend) depends on A1.

### A2 — How idlookup.ai authority reaches the app (DNS) ← *only if A1 = Vercel*

Fully worked in [`../seo/idlookup-ai-people-migration-scoping.md`](../seo/idlookup-ai-people-migration-scoping.md).
Team lean: subdomain **`people.idlookup.ai`** via **one CNAME → `cname.vercel-dns.com`, grey-cloud** —
the smallest reversible BC ask. Subpath is blocked today (grey-cloud DNS + `/people/:id` report-route
collision). Moot if A1 lands on BC infra.

---

## P0 — Security (act first, separate from the roadmaps)

- **Live OpenAI key on disk:** `seo/docs/openai-key.rtf` holds a real `sk-proj-…` key. **Untracked —
  never committed, not in git history** → no repo leak. **Rotate/revoke it anyway** (plaintext on disk;
  surfaced in a session). Sibling `seo/docs/credentials.rtf` too.
- **`seo/docs/` is not gitignored** — one stray `git add` commits both. Recommend gitignore
  `seo/docs/*.rtf` (mirrors `docs/admin/*.rtf`). Files not deleted (owner's) — gitignore on request.

---

## Consolidated open decisions

1. **A1 hosting** — Vercel (lean) / BC infra / hybrid. *Kwan's call; touches SEO + affiliate.*
2. **A2 DNS** — confirm subdomain `people.idlookup.ai` (if Vercel).
3. **SEO** — pivot-vs-fix appetite (hybrid works either way) + vertical priority (inmate first).
4. **Affiliate** — CasA/CasD definitions + postback URLs + receiver placement (gates the postback build).
5. **P0** — rotate the OpenAI key + gitignore `seo/docs/*.rtf`.

## First visible progress (no decision gated)

- **Paid:** relight `PS Free – Orig` ($11.61 CPA) on `name/landing/v11?shns=1` (plan already written).
- **Affiliate:** Phase 0 sub-ID passthrough + BC-persistence check; send partners the CasA/CasD questionnaire.
- **SEO:** inmate-vertical pilot from existing `stateInmates` data + first cornerstone how-to article.
