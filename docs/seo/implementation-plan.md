# idlookup.ai — Programmatic SEO Implementation Plan

**Strategy:** replicate the Spokeo/MyLife pSEO playbook — millions of templated, indexable
profile + directory pages targeting the long-tail of name×location searches, each a
teaser gated to the signup funnel.

**Status:** architecture approved (Next.js SSR app + ISR); **concept-model decisions locked
with owner 2026-07-02 (§0)**. Teardown folded in from `docs/seo/competitive-teardown.md`.

---

## 0. Concept-model decisions — locked with owner 2026-07-02

Concept model: base nodes = profile pages (some attributes exposed, some obfuscated), strung
together by multiple directory dimensions (name, location, school, employer, …), all pointing
into the signup funnel. Framing: **exposed attributes = the search surface (the query universe
we can win); obfuscated attributes = the conversion tease.** An attribute only ranks for
"{name} + {attribute}" queries if it's visible text on the profile page.

1. **Node = one profile page per BC record** (not per deduped human) to start. Entity
   resolution / threading multiple data stores into logical person records is future work.
   **We mint our own stable public IDs** (slug + ID layer mapped to BC record IDs) so the URL
   space survives future re-keying, merges, and new data sources.
2. **Exposed/gated split: mimic Spokeo initially.** Exposed: name, aliases, age, city/state
   (current + prior), relatives-as-links, counts of gated data. Gated: exact street/phone/
   email + full report. Mimicking Spokeo *includes* the clean-PII-in-JSON-LD tactic —
   **legality confirmed by owner 2026-07-02 from direct MyLife precedent (they pioneered it;
   Spokeo replicated). We may expose MORE PII in the indexed JSON-LD than on the visible
   page.** Residual watch-item is Google structured-data policy (§4), not legality.
3. **School/employer data exists in the source data; coverage unknown** → probe BC coverage
   early. Not assumed for launch.
4. **Launch directory dimensions = name + location.** School/employer directories are
   explored in parallel; not a launch gate.
5. **Staged rollout** — high-search-demand segments first; expand sitemap/index exposure as
   quality signals accrue. NOT full-universe on day one (new domain, zero authority —
   indexing is a growth curve to manage).
6. **List/directory pages are first-class ranking surfaces**, not just crawl plumbing — e.g.
   a "Newton, MA" hub carries the people list PLUS town content (news, statistics, meetups,
   commerce). Location hubs become content destinations — a differentiation beyond Spokeo's
   thin geo hubs. (Roadmap: per-hub content enrichment engine.)
7. **Opt-out removes the person from the entire directory surface** (profile + every
   directory listing + sitemaps). Full legal validation of the publishing model before launch.
8. **(addendum) Directory skeleton may be sourced OUTSIDE BC:** a third-party API, or
   crawling incumbents (Spokeo was curl-fetchable in the teardown; Whitepages/MyLife/
   BeenVerified are Cloudflare-gated), to build the high-level name + location directories —
   with BC/IDI queried on-demand only for actual profile pages. Decouples the URL universe /
   sitemaps from BC coverage limits. See §3.

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
| **Taxonomy / URL universe** (which pages to expose + sitemaps + hubs) | **Public seed now**: US Census surname file (~160k surnames), SSA first names, US gazetteer (states/cities). **IDIData later** for richer/verified seed. **Also on the table (owner 2026-07-02): a third-party directory API, or crawling incumbents (Spokeo curl-fetchable; Whitepages/MyLife Cloudflare-gated), to build high-level name+location directories independent of BC — BC/IDI then queried on-demand for actual profiles** | drives sitemaps + internal linking; do NOT expose URLs we can't back with real data |
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

**✅ RESOLVED 2026-07-02 — owner goes aggressive:** the tactic is legally valid per direct
experience (owner pioneered it as CEO at MyLife; Spokeo replicated it). We may expose more PII
in the indexed JSON-LD than the visible page shows. The remaining watch-item is risk #1 only
(Google structured-data policy / manual-action exposure) — monitor GSC, have a fallback
schema variant ready, but do not block the template on it.

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
  **⏳ STARTED 2026-07-03 (`seo/` app):** leaf template `/people/{first}-{last}/{st}/{city}/{id}`
  serving all content + 5 JSON-LD block types server-side (curl-verified, no JS);
  aggressive PII split implemented (clean address in schema, obfuscated teaser);
  data-driven FAQ engine v0; OUR public-ID layer (`p`+10 digits); 60-day ISR;
  **noindex until staged rollout**. Data = fixtures behind the `lib/data.js` BC seam
  (blocked on SEO ASK 0 — dev captcha / sample payloads). Remaining for Phase 0:
  hosting pick (§9.3), path-split proxy, deploy, GSC URL-Inspection verification.
- **Phase 1 — Taxonomy + sitemaps:** public seed → URL universe → sitemap index + child sitemaps → hub pages (surname, A–Z, location) → internal linking. Submit sitemaps in GSC.
- **Phase 2 — Scale + quality:** schema, thin-page `noindex`, broader hub graph, opt-out suppression, monitoring (indexed count, coverage errors).
- **Phase 3 — Optimize:** content depth, IDIData richer seed, teaser A/B, **SEO→signup conversion** (tie into the GA4/Ads tracking we just built — variant of teaser, conversion path).

---

## 8. Metrics
Indexed pages (GSC), organic sessions, **SEO→signup conversion** (reuse our GA4/Ads pipeline),
crawl stats, BC API call volume/cost (the guardrail).

---

## 9. Open decisions / dependencies
1. ~~🔴 PII-in-schema boundary~~ **RESOLVED 2026-07-02 (§0.2, §4): mimic Spokeo incl.
   PII-in-JSON-LD; owner validated legality (MyLife precedent). Watch-item: Google
   structured-data policy only.**
2. **BC data coverage** — confirm BC can return: name-aggregation ("all people named X"),
   per-record location history, relatives *with profile URLs* (for `relatedTo`), per-name
   counts, demographic aggregates (for the FAQ engine), **and school/employer history
   coverage (§0.3 — exists, coverage unknown)**. Likely the long pole → BC asks for gaps.
3. **Hosting for the Next app** — Vercel/Cloudflare (managed ISR) vs. your VPS (Node process).
4. **CDN / reverse proxy** — Cloudflare in front for both apps.
5. **BC API cost/rate limits** — sizes the caching/revalidation window.
6. **IDIData** — timing + format for the richer taxonomy seed (future entity-resolution
   layer per §0.1; our own public IDs insulate URLs from it).
7. **Legal validation** — the full publishing model (public personal-data pages, CCPA,
   opt-out semantics, PII-in-schema) before launch (§0.7).
8. **Re-run research with WebSearch/WebFetch enabled** — blocked this pass; missing Google
   `site:` indexed counts, third-party traffic estimates, and MyLife's actual template.
9. **Own-ID minting scheme** (§0.1) — stable public ID + slug layer over BC record IDs;
   design before Phase 0 URLs go live (URL churn is unrecoverable at scale).
10. **List-page content engine** (§0.6) — what feeds location-hub content (news, stats,
    meetups, commerce) and when; roadmap item, not Phase 0.

---

*Next: fold in `competitive-teardown.md` (URL patterns, template, schema, hub graph), then
build Phase 0.*
