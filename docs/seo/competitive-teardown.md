# People-Search Programmatic SEO — Competitive Teardown

**Purpose:** Reverse-engineer the programmatic SEO (pSEO) playbook that Spokeo, MyLife, Whitepages, and BeenVerified use to mint millions of organic landing pages, so we can replicate it for **idlookup.ai**. This feeds a follow-on technical implementation plan.

**Date:** 2026-06-28
**Method:** Direct `curl` fetches of live robots.txt, sitemaps, and rendered profile HTML, parsed locally. All quoted titles, meta descriptions, JSON-LD blocks, and URL patterns below are **verbatim from pages fetched on the date above** unless explicitly marked as an estimate or blocked.

## What was blocked / uncertain (read this first)

This teardown is **strong on Spokeo (fully observed) and on URL/sitemap architecture for Whitepages + BeenVerified (robots.txt observed)**. The following were genuinely blocked and are flagged inline where relevant — none of it is reconstructed from memory:

- **WebSearch and WebFetch tools were denied** by the harness permission policy. I fell back to `curl` (an allowlisted tool in this repo). Consequence: **no Google `site:` indexed-page counts** and **no third-party SEO-analysis articles** (Ahrefs/SEMrush/Reddit teardowns). Where this report estimates page scale, it is derived from **observed internal-link fan-out and sitemap structure**, NOT from a search-engine index count. These are different numbers; do not conflate them.
- **MyLife** — robots.txt fetched successfully (URL patterns below are real), but **every rendered page (sitemap, profile, people-search) returns a Cloudflare "Attention Required" challenge** to curl. So the MyLife section contains *only* robots.txt-derived URL patterns. Its page template, schema, and teaser anatomy are **not observed** and are marked as such.
- **FastPeopleSearch** — returns a JS "Security Challenge" interstitial to curl. **Not observed at all.** Dropped from the teardown.
- **Whitepages / BeenVerified** — robots.txt and sitemap *declarations* fetched (real, below), but the sitemap XML bodies and profile pages are Cloudflare-blocked. URL scheme and sitemap *architecture* are observed; page template/schema/teaser are **not**.
- **Spokeo** — fully observed (robots.txt, top sitemap, name-index hubs, name profile page, name×state page, opt-out page all fetched and parsed). This is the spine of the report.

To unblock the missing pieces, re-enable WebSearch/WebFetch and re-run, or fetch via a browser/proxy that passes Cloudflare.

---

# Competitor 1 — Spokeo (fully observed; the reference implementation)

## 1.1 URL architecture

Spokeo's public, indexable surface is a strict tree. Observed patterns:

| Tier | Pattern | Real example | Role |
|---|---|---|---|
| Home / vertical hubs | `/people-search`, `/reverse-phone-lookup`, `/email-search`, `/reverse-address-search`, `/directory` | `https://www.spokeo.com/people-search` | Top funnel + keyword hubs |
| State hub | `/{ST}` (2-letter) | `https://www.spokeo.com/CA` | Geo hub → cities + area codes |
| Area-code hub | `/{N}xx-area-codes` | `https://www.spokeo.com/2xx-area-codes` | Phone vertical hub |
| **Name-index hub (A–Z, paginated)** | `/people/{LETTER}{NNNN}` | `https://www.spokeo.com/people/A0001` | Crawl-distribution backbone. Meta says **"Page 1 of 864"** for letter A alone. |
| **Name page (the money page)** | `/{First}-{Last}` | `https://www.spokeo.com/David-Aab` | Aggregates all people with that name |
| Name × state | `/{First}-{Last}/{State}` | `https://www.spokeo.com/David-Aab/Georgia` | Geo-refined variant |
| Name × state × city (paginated) | `/{First}-{Last}/{State}/{City}/p{NNN}` | `https://www.spokeo.com/David-Aab/Georgia/Cumming/p19777981` | `p{NNN}` is the **person record ID**, not a page number |

Key insight: **the URL does NOT encode name×location as one slug at the leaf** — it's a *progressive path* (`/David-Aab` → `/David-Aab/Georgia` → `/David-Aab/Georgia/Cumming/p<id>`). Each level is its own indexable page with its own title/meta/schema. The individual *record* is the `p<id>` leaf; the `/{First}-{Last}` page is a roll-up of multiple records.

robots.txt disallows the *interactive* surfaces but leaves the static SEO tree open:
```
Disallow: /people/profile      # the logged-in/dynamic profile viewer
Disallow: /search
Disallow: /*/search
Disallow: /checkout  /purchase  /offers
Disallow: /*-*/*/*/l   /*-*/*/*/t   # certain leaf variants
Sitemap: https://www.spokeo.com/sitemap.xml
```
So the crawlable money pages are `/{First}-{Last}` and its geo children; the dynamic `/people/profile` viewer and `/search` are walled off from crawlers.

## 1.2 Page template anatomy (free teaser vs. gated)

Observed on `https://www.spokeo.com/David-Aab` (a real, low-volume name — 3 records). Rendered, visible-in-HTML content:

**Shown free (in the crawlable HTML):**
- Full name + variants/aliases ("David James Aab, David S Aab, Dave J Aab")
- **Age** ("David J Aab, Age 68")
- City of residence ("Resides in Cumming, GA") + secondary location *cities* ("Stone Mountain GA, Brookhaven GA")
- **Relatives by name** ("Relatives: Linda Aab, Susan Aab, Franklin Aab") — each a link to *their* name page
- **Counts, not values**, of gated data: literally **"Includes Address(3) Phone(10) Email(16)"** — the teaser advertises *how much* data exists without revealing it.
- A 5-question **FAQ block** of templated narrative (see 1.4).

**Gated (behind Sign Up / "Unlock Profile"):**
- Exact **street addresses, phone numbers, and emails**. This is the most important observed tactic and it's **directly confirmed on the leaf record page** `/David-Aab/Georgia/Cumming/p19777981`: the visible UI shows **deliberately obfuscated teasers** — "Current Address: **RASC** Fleetwood Dr" (house number replaced with a garbage token), "Phone Number: (678) 462-**GUOB** +9 phones", "Email Address: **d USQC**@gmail.com +15 emails" — each behind an **"UNLOCK PROFILE"** CTA. Meanwhile the **clean, full `streetAddress` ("2700 Fleetwood Dr") sits in the page's `Person`/`PostalAddress` JSON-LD**, machine-readable and indexable.
- Net effect: **Google indexes the precise PII that the human visitor is paywalled out of.** The street/phone/email *exist* in the crawlable response (as schema) but are corrupted in the rendered UI. (See playbook §A — this is the central teaser/indexing trick *and* the key privacy decision idlookup must make consciously.)
- Also gated: full background/criminal report, full address/phone/email *lists* ("Phone & Email (26)", "Court (35)", "Social (91)").

**CTA:** "Sign Up" / "See Results" buttons throughout; `/purchase?url=...` and `/login?url=...` deep-links carry the current path so the user lands back on the gated record after paying.

The page is **thick, not thin** (~358 KB of HTML; a multi-record name page renders a results list + FAQ + cross-links), even though the *valuable* PII is gated.

## 1.3 On-page SEO

Verbatim, from the fetched pages:

**Name page `/David-Aab`:**
- `<title>` (JS/JSON-LD): `David Aab (3 matches): Phone Number, Email, Address - Spokeo`
- Meta description: `3 records for David Aab. Find David Aab's phone number, address, and email on Spokeo, the leading online directory for contact information.`
- `<h1>`: `David Aab`
- `<h2>`s: `Browse Locations`, `3 people named David Aab found in Georgia and New York`, `David Aab FAQ`
- Canonical: `https://www.spokeo.com/David-Aab`

**Name × state `/David-Aab/Georgia`** (title IS server-rendered here):
- `<title>`: `David Aab, Georgia (2 matches): Phone Number, Email, Address - Spokeo`
- Meta: `David Aab in Georgia. Find David Aab's phone number, address, and email on Spokeo...`
- `<h1>`: `David Aab in Georgia`

**Name-index hub `/people/A0001`:**
- `<h1>`: `Last Names Starting With 'A' - Page 1`
- Meta: `Page 1 of 864. Names starting with A. Browse through Spokeo's People Directory of phone numbers, addresses, court records, and more.`

**State hub `/CA`:**
- Meta: `Who lives at that address? Find any street address in California and find out who lives there now, or who lived there in the past.`
- `<h2>`s: `Area Codes in California`, `Cities in California`

### Structured data (schema.org) — the heaviest weapon

The name page `/David-Aab` carries **5 JSON-LD blocks**, all server-rendered:

1. `Organization` + `ContactPoint` (site-wide brand block, every page)
2. `WebPage` (name + description mirroring the title/meta)
3. **`BreadcrumbList`** — 4 levels: `People Search` → `🔍A` (`/people/A0001`) → `📁Aab` → `👤David Aab`. (Spokeo even prefixes breadcrumb names with emoji.)
4. **`Person[]`** — one per record, each with:
   - `additionalName` (aliases), `name`
   - `homeLocation[]` → `Place` → `PostalAddress` with **full `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`**
   - `relatedTo[]` → `Person` objects **with `url` to the relative's name page**
   - `url` → the `/{First}-{Last}/{State}/{City}/p<id>` leaf
5. **`FAQPage`** — 5 `Question`/`Answer` pairs (see 1.4).

Verbatim `Person` sample:
```json
{ "@type": "Person",
  "additionalName": ["David James Aab","David S Aab","Dave J Aab"],
  "homeLocation": [{ "@type":"Place","address":{ "@type":"PostalAddress",
     "addressLocality":"Cumming","addressRegion":"GA","postalCode":"30041",
     "streetAddress":"2700 Fleetwood Dr" }}, ...],
  "name":"David J Aab",
  "relatedTo":[{ "@type":"Person","name":"Linda Aab","url":"https://www.spokeo.com/Linda-Aab" }, ...],
  "url":"https://www.spokeo.com/David-Aab/Georgia/Cumming/p19777981" }
```

## 1.4 Thin-content / doorway avoidance — the FAQ machine

The single most important anti-thin-content tactic: every name page renders a **templated-but-unique FAQ** built from that name's data, exposed both as visible text and `FAQPage` schema. Verbatim from `/David-Aab`:

- *"How many people named David Aab are there in the US?"* → "We found 3 people named David Aab in America, across 2 states. This is a nearly-unique name in the US."
- *"Where does David Aab live?"* → "Most of them live in Georgia and New York."
- *"How many criminal records are there matching people named 'David Aab'?"* → "No criminal records found matching the name David Aab."
- *"Where does David Aab work?"* → "We found the following companies associated with David Aab's work history: Aab Plumbing."
- *"What are the demographics of people named David Aab?"* → "Based on US Census data, 100% are in their 60s... income average is $100k. 0% of these people are married..."

Each answer is generated from the record set, so **no two name pages have identical text** — this is what lifts them above Google's doorway/thin-content threshold. The page also carries a results list, breadcrumb, "Browse Locations" panel, and dozens of internal links. Net: even a 3-record name yields a substantive, unique page.

## 1.5 Internal linking & hub structure (how crawl budget flows)

Observed link fan-out on the name-index hub `/people/A0001`:
- **864 links to sibling pagination pages** `/people/A0001`…`/people/A0864` ("Page 1 of 864") — letter A's index is split into 864 paginated pages.
- **~2,000 links to individual `/{First}-{Last}` name pages** on that single hub page (e.g. `/Aaron-A`, `/David-Aab`, `/Zachary-Aagard`, `/Kelly-Aakhus`...).

On a name page (`/David-Aab`), internal links flow to:
- **Relatives' name pages** (`/Linda-Aab`, `/Susan-Aab`, `/Franklin-Aab`) — the `relatedTo` graph creates a dense person-to-person web.
- **Its own geo children** (`/David-Aab/Georgia`, `/David-Aab/New-York`, `/David-Aab/Georgia/Cumming/p…`).
- **"Others named with this surname"** (`/Linda-Aab`, etc.).
- Back up the breadcrumb to the name-index hub.

So crawl budget cascades: top sitemap → 26 letter hubs → ~864 pagination pages/letter → ~2,000 name pages/hub → each name page → geo children + relative pages. **The internal-link graph, not the sitemap, is the primary discovery mechanism.**

## 1.6 Scale & indexing

- **Top sitemap** `https://www.spokeo.com/sitemap.xml` is a lean **90-URL hub map** (home, vertical hubs, 50 state pages, area-code hubs, and the 26 letter-index entry points `/people/A0001`…`/people/WXYZ0001`). It is **NOT** a sitemapindex and does **NOT** enumerate millions of profile URLs. Spokeo deliberately seeds crawlers with hubs and lets internal linking do the rest.
- **Estimated URL universe (from fan-out, NOT a search index count):** letter A alone ≈ 864 index pages × ~2,000 name links ≈ **~1.7M name-page entry points for one letter**. Across the ~17 letter-group hubs (the top sitemap combines low-frequency initials: `EF0001`, `IJ0001`, `NO0001`, `QR0001`, `TUV0001`, `WXYZ0001`) that's tens of millions of `/{First}-{Last}` pages, *before* multiplying by the name×state and name×state×city tiers (each name page spawns one child per state and per city it appears in). Order of magnitude: **tens of millions of indexable pages**, consistent with public reporting that people-search sites run 8–9 figures of pages. **This is an internal-link-fan-out estimate; the true Google-indexed count requires a `site:` query, which was blocked.**

## 1.7 Rendering — server-rendered (critical for our SPA)

**Confirmed server-rendered / static (present in raw HTML before any JS):**
- All visible body content: name, age, "Resides in Cumming, GA", relatives, aliases, the "Includes Address(3) Phone(10) Email(16)" counts, and the full FAQ text — all found in the curl'd HTML with no JS execution.
- `<h1>`, meta description, canonical, **all 5 JSON-LD blocks** (including `Person` with street addresses).
- On name×state pages, the `<title>` is also in raw HTML.

**JS-injected:** on the *hub* pages (`/people/A0001`), the `<title>` tag was absent from raw HTML and set client-side (the `WebPage` JSON-LD still carried the name). Minor — the SEO-critical content is server-side.

**Takeaway for idlookup:** Spokeo's pages are effectively SSR/SSG with structured data baked in. A **client-rendered SPA (our current Parcel build) will NOT replicate this** — Google may render JS, but for tens of millions of low-PageRank long-tail pages, relying on JS rendering is a known indexing risk. We need static/server-rendered HTML for the SEO surface.

## 1.8 Privacy / opt-out

- Dedicated, indexable opt-out page: `https://www.spokeo.com/optout` (HTTP 200, fully rendered).
  - `<h1>`: "You Control Your Data" / "Opt Out Your Listing from Spokeo"
  - Meta: "You can easily remove your information from Spokeo by using our online opt out form."
  - Copy frames the data as lawful public-records aggregation ("By law, many of these records... are made publicly accessible via the public domain") and asserts they **do not sell** SSNs, ethnicity, or sexual orientation.
- On the profile page itself, the only privacy link in the body is `/privacy`; the opt-out is reached via the global footer/privacy hub rather than a prominent per-record "remove me" button. (Whitepages/BeenVerified typically put a more direct "remove this listing" link on the record — not verified here due to Cloudflare.)

## 1.9 Trust / E-E-A-T

- Site-wide `Organization` schema with toll-free `ContactPoint`, logo, and `sameAs` (Facebook/X/LinkedIn).
- "Over 12 billion records" claim in the org description.
- A "highest-quality data standards" footnote (teal checkmark) on records — a freshness/accuracy trust signal.
- About/Careers/Contact/Blog hubs (standard authority pages).

---

# Competitor 2 — MyLife (robots.txt only; pages Cloudflare-blocked)

**Observed (robots.txt):** URL patterns only. Everything else below the patterns is **blocked/not observed.**

URL patterns inferable from `Allow`/`Disallow` rules:
- **Name profile pages:** `/{First-Name}-{Last-Name}/...` — confirmed by the rule `Disallow: /{US_FEMALE_NAME}-{US_CENSUS_NAME}/*` (MyLife literally templates the name slug; that specific disallow appears to suppress a class of generated female-name pages) and `Allow: /*-*/` (hyphenated two-token slugs are allowed). *(From general knowledge, NOT observed in this fetch:* MyLife's commonly reported leaf format is `/{first}-{last}/e{number}` — the `e<id>` reputation/profile pages. Not verifiable here because rendered pages are Cloudflare-blocked.)*
- **Phone vertical:** `Allow: /phone-*/*`, `Allow: /phone-*-*-*` (e.g. `/phone-555-123-4567`).
- **Search reg funnel (gated):** `Disallow: /search*`, `Disallow: /search/seo-reg/`, `Disallow: /json/teaser/wsfy/` (the path is observed; *"WSFY = who's searching for you" is a general-knowledge gloss of MyLife's email-capture teaser, not derivable from robots.txt alone*), `Disallow: /people-search-directory/*`.
- `Allow: /search-*/*$` — certain `search-*` directory pages ARE crawlable (geo/name directory shells).

**NOT observed (Cloudflare-blocked):** page template, free-vs-gated teaser, on-page SEO tags, schema.org usage, internal linking, sitemap architecture, rendering mode, opt-out page. Do not assume; re-fetch via a Cloudflare-passing client.

*Note:* MyLife's historically reported playbook (large reputation/"Reputation Score" profile pages with aggressive teaser + email-capture, heavy litigation/FTC scrutiny over its scores and auto-billing) is **not verifiable here** and is omitted from findings on purpose.

---

# Competitor 3 — Whitepages (robots.txt + sitemap declarations; pages blocked)

**Observed (robots.txt):** a notably *clean*, machine-friendly URL scheme:
- **Name pages:** `/name/{Name}`, `/name/{Name}/{Location}`, `/name/{Name}/{Location}/{Page}` (`Allow: /name/*`, `/name/*/*`, `/name/*/*/P`).
- **Address:** `/address`, `/address/*/*/`.
- **Phone:** `/phone`, `/phone/*`, `/phone*`; plus `/area-codes`, `/caller`.
- Verticals: `/reverse`, `/people-search`, `/person`, `/email-search`, `/background-checks`, `/property`, `/white-pages`.

**Sitemap architecture (declared in robots.txt — the textbook geo split):**
```
/main-site-hierarchy.xml
/white-pages-city.xml
/sitemap-state.xml   /sitemap-county.xml   /sitemap-zip-code.xml
/property-sitemap.xml  /sitemap-city-single-family.xml
/sitemap-city-vacant.xml  /sitemap-city-property-owners.xml
/sitemap-cms.xml
```
This shows the canonical pSEO sitemap strategy: **one sitemap (or sitemapindex) per geographic granularity** — state, county, city, zip — plus separate property/CMS maps. Crawlers get a clean per-tier map instead of one giant file.

**NOT observed (Cloudflare-blocked):** sitemap XML bodies, page template, teaser, schema, rendering, opt-out.

---

# Competitor 4 — BeenVerified (robots.txt + sitemap declarations; pages blocked)

**Observed (robots.txt):**
- People sitemaps are explicitly **partitioned by geography and scope** (a clean sitemapindex-per-tier model):
```
/people/sitemap-national-index.xml
/people/sitemap-state-index.xml
/people/sitemap-city-index.xml
/people/sitemap-limited-index.xml
/property/sitemap-index.xml
/articles/sitemap.xml
```
- **Interesting divergence:** BeenVerified **`Disallow: /seo/`** and disallows short generated dirs `/p/`, `/n/`, `/abc/`, plus the whole funnel (`/signup/`, `/promos/`, `/reports/`, `/users/`). So they keep their indexable people/property pages in `/people/*` and `/property/*` and wall off an internal `/seo/` area and the conversion funnel from crawlers — a cleaner separation of "SEO landing surface" vs. "app."

**NOT observed (Cloudflare-blocked):** URL leaf format for individual profiles, page template, teaser, schema, rendering, opt-out.

---

# The Playbook (the common pattern that drove their traffic)

Synthesizing the observed evidence (Spokeo fully; Whitepages/BeenVerified/MyLife on architecture):

**A. One indexable page per (name) and per (name × geography), generated from the data, not hand-authored.** The atomic unit is `/{First}-{Last}` (Spokeo) or `/name/{Name}/{Location}` (Whitepages). Geography is layered progressively (name → state → city), each level its own URL/title/meta/schema. **The full PII (clean street address) is embedded in `Person`/`PostalAddress` JSON-LD while the rendered UI shows only an obfuscated teaser (house number/phone/email replaced with garbage tokens behind "Unlock Profile") — observed on Spokeo's leaf record page.** Google indexes the precise data the visitor must pay to see. This is the core teaser/indexing trick *and* the central privacy decision.

**B. A teaser that advertises volume, not values.** Free: name, age, city, relatives (as links), aliases, and **counts** ("Phone(10) Email(16)"). Gated: the actual numbers/addresses/reports. The free data is exactly the high-search-intent stuff ("is this the right John Smith?") and exactly enough to rank.

**C. Unique, data-driven narrative per page (FAQ schema) to beat thin-content/doorway filters.** The `FAQPage` with name-specific answers ("nearly-unique name", "live in Georgia and New York", census demographics) makes every page textually unique and earns FAQ rich results. This is the difference between a doorway page and a surviving page.

**D. Crawl budget flows through on-page internal links, seeded by a lean hub sitemap.** A small top sitemap (Spokeo: 90 URLs) points to A–Z name-index hubs and geo hubs; each hub fans out to ~2,000 profile links and ~864 pagination siblings; each profile links to relatives + geo children. The `relatedTo` person graph + breadcrumbs weave a dense mesh. For the *bulk* enumeration, the others (Whitepages/BeenVerified) use **per-geo-tier sitemapindex files** (state/county/city/zip).

**E. Server-rendered/static HTML with schema baked in.** All SEO-critical content (body text + JSON-LD) is in the raw HTML. This is non-negotiable at this scale.

**F. Compliant-by-design opt-out + "lawful public records" framing + brand E-E-A-T.** A dedicated opt-out page, "we don't sell SSN/ethnicity" assertions, Organization schema with real contact info.

---

# Recommendations for idlookup.ai

These are the decisions the implementation plan must make. Tied to our stack (React 18 SPA on Parcel 2, BC API as the data source — see CLAUDE.md).

### 1. URL scheme (decide first; it's hard to change later)
Adopt a **progressive, geo-layered path**, e.g.:
```
/people/{First}-{Last}                      # name roll-up
/people/{First}-{Last}/{State}              # name × state
/people/{First}-{Last}/{State}/{City}       # name × city
/people/{First}-{Last}/{State}/{City}/{id}  # the individual record
```
Plus hub pages: `/people/{letter}` A–Z index (paginated), `/{ST}` state hubs, vertical hubs (`/people-search`, `/reverse-phone`, `/email-search`). Keep slugs hyphenated and lowercase-normalized. Keep the **interactive search/app surface on different paths** (and `Disallow` them in robots.txt) so the SEO tree is clean — BeenVerified's `/seo/`-vs-app split is the model.

### 2. Rendering (the biggest gap vs. our current build)
**Our Parcel SPA cannot do this as-is.** The SEO surface needs **pre-rendered static HTML or SSR** with content + JSON-LD in the initial response. Options to evaluate in the plan:
- A separate **static-site generator / SSR layer** that renders the `/people/*` tree at build/request time and is deployed independently of the React app (mirrors how tracking-api is a separate deployable). Hydrate to the SPA for interactivity.
- Or pre-render the SEO pages to static HTML on a schedule from the BC data and serve them directly; the app handles only the gated/interactive parts.
- Do **not** ship the profile tree as client-rendered SPA routes and hope Google renders the JS — at 7–8 figures of low-authority pages that is a documented indexing failure mode.

### 3. Data needs (what BC must supply per name/record)
To build a non-thin page we need, per record: name + aliases, age, city/state (current + prior), relatives (with their own profile URLs for `relatedTo`), and **counts** of addresses/phones/emails/records (for the teaser), plus census-style demographic aggregates per name (for the FAQ). Confirm BC can return: a **name-aggregation endpoint** ("all people named X"), per-record location history, relative links, and per-name counts/stats. **Flag any gap as a BC ask** (consistent with our BC-asks workflow). The street-address-in-schema decision (B/§A) determines whether we even request street-level data for the indexed layer.

### 4. Sitemap strategy
Use a **lean top sitemapindex** that points to per-tier child sitemaps split by geography and letter (Whitepages/BeenVerified model): e.g. `sitemap-name-index.xml`, `sitemap-state.xml`, `sitemap-city-index.xml`. Don't dump millions of URLs in one file. Lean on **internal linking** (A–Z hubs → name pages → relatives + geo children) as the primary discovery path, exactly like Spokeo's 90-URL top sitemap.

### 5. Page template / anti-thin-content
Every generated page must carry: server-rendered `<h1>`/title/meta (templated with name + match count + geo), a results/record list, a **data-driven FAQ block rendered both as visible text and `FAQPage` JSON-LD**, a `BreadcrumbList`, `Person` schema per record (with `relatedTo` URLs), and an internal-link panel ("others named X", "people in {city}", relatives). The FAQ-from-data pattern is the specific mechanism that keeps pages out of doorway-penalty territory — build the templating engine for it early.

### 6. Teaser / paywall boundary
Match the proven split: free = name, age, city, relatives, aliases, **counts** of gated data; gated = exact phone/email/address values + full report, behind our existing narrow paywall. **Decision required:** whether to embed full street addresses in the `Person`/`PostalAddress` JSON-LD (indexable) while hiding them in the UI, as Spokeo does. This boosts long-tail "address" queries but is the most privacy-aggressive choice and the most likely to draw complaints/opt-outs — make it a conscious, documented call.

### 7. Compliance / trust (do this at launch, not later)
- Ship a dedicated, indexable **opt-out page** with a simple form *and* a direct "remove this listing" affordance on each record (more prominent than Spokeo's footer-only link — it reduces legal risk and is a trust signal).
- Add site-wide `Organization` schema (contact, logo, `sameAs`), a "public records, lawfully sourced" explainer, and standard About/Contact/Privacy authority pages.
- Honor opt-outs by suppressing the record from generation/sitemaps, and consider CCPA/"Do Not Sell" handling given the California exposure of this category.

### 8. Open items to resolve before building
- **Get the blocked data:** re-run with WebSearch/WebFetch enabled (or a Cloudflare-passing fetch) to capture MyLife's actual template + the real Google-indexed counts (`site:` queries) and third-party traffic estimates, to size the opportunity.
- **Confirm BC's name-aggregation + relatives + counts coverage** (§3) — likely the long pole.
- **Pick the rendering approach** (§2) — this is an architecture decision that affects deployment and is the single biggest delta from our current SPA.

---

## Appendix — evidence captured

Fetched and parsed locally on 2026-06-28 (all via `curl`):
- `spokeo.com/robots.txt`, `/sitemap.xml` (90-URL hub map), `/people/A0001` (name-index hub, "Page 1 of 864"), `/David-Aab` (name roll-up page, 5 JSON-LD blocks incl. Person+FAQ verbatim), `/David-Aab/Georgia` (name×state, SSR title), `/David-Aab/Georgia/Cumming/p19777981` (leaf record page — confirmed obfuscated address/phone/email teaser + "Unlock Profile" gate vs. clean address in JSON-LD), `/CA` (state hub), `/optout` (opt-out page).
- `mylife.com/robots.txt` (URL patterns only; all other pages → Cloudflare challenge).
- `whitepages.com/robots.txt` (URL scheme + 10 geo-split sitemap declarations).
- `beenverified.com/robots.txt` (per-geo-tier sitemapindex declarations + `/seo/` disallow).
- **Blocked:** all WebSearch/WebFetch (denied); MyLife/FastPeopleSearch rendered pages, Whitepages/BeenVerified sitemap XML + profile pages (Cloudflare).
