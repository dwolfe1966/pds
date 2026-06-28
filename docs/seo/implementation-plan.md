# idlookup.ai — Programmatic SEO Implementation Plan

**Strategy:** replicate the Spokeo/MyLife pSEO playbook — millions of templated, indexable
profile + directory pages targeting the long-tail of name×location searches, each a
teaser gated to the signup funnel.

**Status:** architecture approved (Next.js SSR app + ISR). Competitive-teardown-dependent
sections marked **[TEARDOWN]** — filled from `docs/seo/competitive-teardown.md` when ready.

---

## 1. Architecture

A **separate Next.js app** serves only the SEO surface; the existing Parcel SPA (funnel +
member app) is untouched. A reverse proxy / CDN splits traffic by path.

```
                         ┌── Cloudflare (CDN + edge cache) ──┐
   Googlebot / users ───▶│  reverse proxy by URL path         │
                         └───────┬───────────────┬────────────┘
                       SEO paths │               │ app paths
                    (/p/*, /in/* …)              (/dashboard, /name/landing, /payment …)
                                 ▼               ▼
                    ┌────────────────────┐   ┌───────────────────┐
                    │  Next.js SEO app   │   │  Parcel SPA (build/)│
                    │  ISR + cache       │   │  static + /api proxy│
                    └─────────┬──────────┘   └───────────────────┘
                              │ on-demand, then cached (revalidate 30–90d)
                              ▼
                        BC profile API
```

**Why Next + ISR:** first crawl renders from BC; the HTML is cached + revalidated on a long
interval (people data is slow-changing). Googlebot mostly hits cache → **BC API cost stays
bounded.** Same mechanism the incumbents use.

**Key principle — caching is mandatory:** crawler traffic = API calls. CDN edge cache + ISR
keep BC lookups ≈ one-per-page-per-revalidation-window, not one-per-crawl.

---

## 2. URL scheme  ✅ confirmed against Spokeo

**Progressive, geo-layered path** — each level is its own indexable page (own title/meta/schema):
```
/people/{First}-{Last}                      # name roll-up (the "money" page)
/people/{First}-{Last}/{State}              # name × state
/people/{First}-{Last}/{State}/{City}       # name × city
/people/{First}-{Last}/{State}/{City}/{id}  # individual record (leaf)
```
Hub / crawl-distribution pages:
- `/people/{letter}` — A–Z name index, paginated (Spokeo splits letter A into **864** pages)
- `/{ST}` state hubs; vertical hubs (`/people-search`, `/reverse-phone`, `/email-search`)

Rules: hyphenated, lowercase-normalized slugs; canonical per level; the **interactive app/
search surface stays on separate paths and is `Disallow`'d in robots.txt** (BeenVerified's
`/seo/`-vs-app split) so the SEO tree is clean and never collides with `/name/landing`, `/people/:id`.

---

## 3. Data pipeline

| Need | Source | Notes |
|---|---|---|
| **Profile detail** (the teaser per page) | **BC API**, on-demand | cached via ISR; one lookup per page per revalidation window |
| **Taxonomy / URL universe** (which pages to expose + sitemaps + hubs) | **Public seed now**: US Census surname file (~160k surnames), SSA first names, US gazetteer (states/cities). **IDIData later** for richer/verified seed | drives sitemaps + internal linking; do NOT expose URLs we can't back with real data |
| **Thin-page handling** | render → if data sparse/empty → **`noindex`** + exclude from sitemap | avoids doorway/thin-content penalties |

The taxonomy seed answers "which URLs are worth exposing." Public datasets give the candidate
space; over time, IDIData (or a discovery pass) confirms which combos have real records.

---

## 4. Page template  ✅ confirmed (Spokeo)

Every page is **thick, not thin** via a data-driven template:
- **Visible teaser (free):** name + aliases, age, city/state (current + prior cities),
  **relatives by name (each links to their own page)**, and **counts not values**
  — literally "Includes Address(3) Phone(10) Email(16)" (advertises how much exists).
- **Gated:** exact addresses/phones/emails + full report → CTA into the signup funnel.
- **FAQ engine (the anti-thin-content mechanism — build early):** a data-driven FAQ per page,
  rendered as visible text **and** `FAQPage` JSON-LD ("How many people named X?", "Where do
  they live?", "Criminal records?", census demographics). Per-name uniqueness is what keeps
  pages out of doorway-penalty territory — the single most important quality lever.
- **Schema (server-rendered):** `Organization` + `WebPage` + `BreadcrumbList` + `Person[]`
  (each with `relatedTo` URLs to relatives) + `FAQPage`.
- **Compliance every page:** prominent opt-out, FCRA non-CRA disclaimer (we have it), privacy.
- Reuse idlookup design tokens; CTA matches the funnel.

### ⚠️ THE central decision — PII in structured data (owner's call, blocks the template)
Spokeo embeds the **clean full street address** in `Person`/`PostalAddress` **JSON-LD (indexed
by Google)** while the rendered UI shows an **obfuscated teaser** ("RASC Fleetwood Dr", "(678)
462-GUOB") behind "Unlock Profile". Net: **Google indexes the precise PII the human is paywalled
out of.** That's the core ranking trick — but two real risks:
1. **Google policy** — structured data must represent *visible* content; marking up data hidden
   from users is a structured-data violation / cloaking-adjacent → manual-action risk.
2. **Privacy/legal** — exact street addresses at scale = the most complaint/opt-out-generating
   choice (CCPA + state privacy exposure).

**Recommendation — the defensible middle:** index enough to win the "is this the right person?"
long-tail (name, age, **city/state**, relatives, counts) **without** hiding full street addresses
in schema that aren't visible. Go more aggressive only as a conscious, legally-reviewed decision.

---

## 5. SEO mechanics
- **Unique title + meta per page**, templated (e.g. "John Smith in Dallas, TX — Age, Phone, Address | IDLookup").
- **Internal linking / hub structure** — the crawl-budget engine: hubs → profiles, "others named X",
  "people in {city}", A–Z indexes, related/nearby. **[TEARDOWN]** for the exact graph.
- **Sitemaps:** sitemap index → child sitemaps (≤50k URLs each), submitted in GSC; only real-data URLs.
- **Canonical, robots, hreflang(n/a), fast LCP, mobile-first.**

---

## 6. Compliance & risk (this is a moat, not an afterthought)
- **Google doorway/thin-content policy** — each page must carry real, unique value; `noindex` the thin tail.
- **Privacy / opt-out (CCPA/state laws)** — prominent, working opt-out; suppress opted-out records from pages + sitemaps.
- **FCRA framing** — non-CRA disclaimers (we have them).
- **API cost / crawl budget** — the caching architecture is the control; also a `crawl-delay`/budget plan.
- **Legal review** recommended before launch — publishing personal-data pages at scale.

---

## 7. Phases

- **Phase 0 — Foundation (proof of crawl):** Next.js app skeleton; reverse-proxy/CDN routing alongside the Parcel SPA; ONE profile-page template rendering live from BC; ISR + edge cache; deploy; verify Googlebot gets server-rendered HTML (`view-source` + GSC URL Inspection).
- **Phase 1 — Taxonomy + sitemaps:** public seed → URL universe → sitemap index + child sitemaps → hub pages (surname, A–Z, location) → internal linking. Submit sitemaps in GSC.
- **Phase 2 — Scale + quality:** schema, thin-page `noindex`, broader hub graph, opt-out suppression, monitoring (indexed count, coverage errors).
- **Phase 3 — Optimize:** content depth, IDIData richer seed, teaser A/B, **SEO→signup conversion** (tie into the GA4/Ads tracking we just built — variant of teaser, conversion path).

---

## 8. Metrics
Indexed pages (GSC), organic sessions, **SEO→signup conversion** (reuse our GA4/Ads pipeline),
crawl stats, BC API call volume/cost (the guardrail).

---

## 9. Open decisions / dependencies
1. **🔴 PII-in-schema boundary** (§4) — how aggressive on indexed PII. Recommendation: the
   defensible middle (no hidden full street addresses in schema). **Owner's call — blocks the template.**
2. **BC data coverage** — confirm BC can return: name-aggregation ("all people named X"),
   per-record location history, relatives *with profile URLs* (for `relatedTo`), per-name
   counts, and demographic aggregates (for the FAQ engine). Likely the long pole → BC asks for gaps.
3. **Hosting for the Next app** — Vercel/Cloudflare (managed ISR) vs. your VPS (Node process).
4. **CDN / reverse proxy** — Cloudflare in front for both apps.
5. **BC API cost/rate limits** — sizes the caching/revalidation window.
6. **IDIData** — timing + format for the richer taxonomy seed.
7. **Legal review** — public personal-data publishing (CCPA) before launch.
8. **Re-run research with WebSearch/WebFetch enabled** — blocked this pass; missing Google
   `site:` indexed counts, third-party traffic estimates, and MyLife's actual template.

---

*Next: fold in `competitive-teardown.md` (URL patterns, template, schema, hub graph), then
build Phase 0.*
