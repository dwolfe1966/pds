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

## 2. URL scheme  **[TEARDOWN — confirm against Spokeo/MyLife patterns]**

Provisional (refine from the teardown):
- **Profile:** `/p/{first}-{last}/{state}/{city}` (e.g. `/p/john-smith/tx/dallas`)
- **Surname hub:** `/name/{last}` → list of people with that surname
- **Name index (crawl paths):** `/name/{a-z}` → `/name/{last}` (A–Z pagination)
- **Location hub:** `/in/{state}` → `/in/{state}/{city}` → people in that city
- Keep SEO namespace **disjoint** from app routes (no collision with `/name/landing`, `/people/:id`, etc.).

Decisions to lock: hyphen vs. underscore, ID-in-URL vs. clean slugs, trailing slash,
canonical handling for duplicate name×location.

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

## 4. Page template  **[TEARDOWN — confirm fields, gating, schema]**

Provisional teaser anatomy (refine from competitors):
- **Visible (free):** name, approximate age, city/state, # of relatives/associates (initials),
  partial phone/address — enough unique content to be non-thin.
- **Gated:** full report → CTA into the existing signup funnel (`/signup?...`).
- **Structured data:** BreadcrumbList for sure; **Person schema is a [TEARDOWN] decision**
  (can be risky for non-notable individuals — see what incumbents actually use).
- **Compliance on every page:** opt-out link, FCRA "not a consumer reporting agency" disclaimer
  (we already have the language), privacy notice.
- Reuse idlookup design tokens so it looks native + the CTA matches the funnel.

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
1. **Hosting for the Next app** — Vercel/Cloudflare (managed, easy ISR) vs. your VPS (Node process). 
2. **CDN / reverse proxy** — Cloudflare in front for both apps.
3. **BC API** — per-lookup cost + rate limits (sizes the caching/revalidation window).
4. **URL scheme final** — [TEARDOWN].
5. **IDIData** — timing + format for the richer seed.
6. **Legal review** — public personal-data publishing.

---

*Next: fold in `competitive-teardown.md` (URL patterns, template, schema, hub graph), then
build Phase 0.*
