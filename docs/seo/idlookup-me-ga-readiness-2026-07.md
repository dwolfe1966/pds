# idlookup.me — SEO People-Search Directory: GA Readiness & Improvement Plan

**Date:** 2026-07-11
**Scope:** the `seo/` Next.js app deployed to Vercel on `idlookup.me`, backed by Neon Postgres, that indexes people-search directory hubs + profile leaves to win long-tail Google searches and hand off to the `idlookup.ai` funnel.
**Method:** read of `seo/` source (libs, routes, schema, scripts) + live fetch/curl of `idlookup.me` (home, `/people`, sitemap, robots, a state hub, a city page, a profile leaf) + `site:` index probe.

---

## TL;DR — the three things that actually block "real, scaled, indexed product"

1. **The site is ~866k pages and ~99.9% of them are thin, doorway-shaped by construction.** The sitemap holds **~868,000 URLs** (19 chunks × 45,000 + one of 13,345). In sitemap chunk 0, **44,938 of 45,000** URLs are name-in-city leaves (`/people/{state}/{city}/{first-last}`). Those pages carry **no per-person data** — just a Census-derived "an estimated N people named X live in City" line, four ACS city stats, related-name links, and a funnel CTA. This is the textbook programmatic-doorway pattern, at scale, already served with `index,follow`. This is the single biggest Google manual-action / thin-content risk, and it dwarfs everything else.

2. **Opt-out does not propagate to this store — likely a legal + Google-policy blocker.** Every page links to `idlookup.ai/optout` (`lib/ui.js:39`), but there is **no suppression field and no removal path** into the Neon/JSON profile store. `db/schema.sql` has no `suppressed`/`removed` column; `scripts/sweep-profiles.mjs` upserts unconditionally; nothing reads an opt-out list. If a person opts out on the main site, their `idlookup.me` profile leaf keeps rendering and stays in the sitemap. For a PII directory that is both a compliance exposure and a Google policy problem.

3. **The real-data path is head-excluded and rate-capped — "scale to millions" is not "run the sweep longer."** Only **619 profiles** exist (`seo/data/profiles.json`, 619 records). They come from `scripts/sweep-profiles.mjs`, which drives the prod BC teaser IIFE through a **headed, Cloudflare-Turnstile-gated Playwright browser at ~1 call / 4.5s** with a human solving challenges on failure bursts. Worse, it's structurally capped: the teaser dead-ends (`TooManyMatches`) above ~1,000 people per name-per-state (`EST_IN_STATE_MAX`, `lib/directory.js:23`), so common names in big states return **nothing** — the sweep can only ever capture the long tail. Reaching millions needs a **bulk BC/IDI data feed**, not more Turnstile sweeping.

Everything below expands on these plus the smaller findings.

---

## 1. Architecture (as actually built — memory & in-repo docs are partly stale)

Standalone Next.js 15 / React 19 app in `seo/`, ISR with 60-day revalidate (`REVALIDATE_SECONDS`, `lib/data.js:19`). **Two independent page trees:**

**A. `/people/*` — the Census-derived location×name taxonomy (the ~866k pages).** DB-free; driven entirely by public-domain JSON slices (`lib/directory.js`, no Neon import by design):
- `/people` — state index (`app/people/page.js`)
- `/people/{state}` — state hub → cities + top names
- `/people/{state}/{city}` — city landing, the **rich augmentation page** (`app/people/[state]/[city]/page.js`): ACS demographics grid, race/ethnicity bars, occupations, population-trend chart, state map, most-common-names list, notable people (Wikidata), historic places (NPS), historic newspapers (LoC Chronicling America), nearby cities. Data from `data/city-*.json` via `lib/facts.js`.
- `/people/{state}/{city}/{first-last}` — name-in-city leaf (`app/people/[state]/[city]/[name]/page.js`): the thin page. Estimated in-city count + 4 city stats + name facts + related names + SERP hand-off CTA. **No real person data.**

**Gates** (`lib/directory.js`): name×state kept only when est-in-state ∈ [5, 1000]; name-in-city page kept only when est-in-city ∈ [2, 750) (`EST_IN_CITY_MIN/MAX`). This gate is what produces the ~866k count and prunes thin/dead-end combos to `notFound()`.

**B. `/profiles/*` — the 619 real captured people.** DB-backed (`lib/data.js` → `lib/db.mjs`, Neon; falls back to `data/profiles.json` when no `DATABASE_URL`):
- `/profiles/{name}` → `/{state}` → `/{city}` → `/{id}` leaf (`app/profiles/[name]/[state]/[city]/[id]/page.js`). Public IDs `p+10 digits` (`lib/ids.js`), minted from stable attributes (name+city+first-seen), never BC extId (which is ephemeral). Leaf shows an obfuscated teaser (masked phone/email/street), a "records that may be available" grid, location history, relatives, a data-driven FAQ, and an **Unlock Full Profile** CTA deep-linking to `idlookup.ai/search/{id}?fn=…&ln=…&st=…&city=…&fs=…` + UTM.

**JSON-LD** (`lib/schema.js`), all server-rendered into initial HTML (verified via curl — see §2): Organization (global, `app/layout.js`), plus per profile leaf: WebPage, BreadcrumbList, Person, FAQPage. Hub pages emit CollectionPage/ItemList + BreadcrumbList.

**Funnel hand-off (verified live):**
- Profile leaf → `idlookup.ai/search/{id}?fn/ln/st/city/fs` (re-hydrates the SUP by name+city+first-seen; extId deliberately omitted).
- City / name-in-city pages → `idlookup.ai/name/landing/v2?...&state=XX` and `idlookup.ai/name/search-result?firstName=…&lastName=…&state=…&city=…`.
- All carry `utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`.
- Footer → `idlookup.ai/optout` + `/privacy`.

**Stale in-repo docs (flag):** `seo/DEPLOY.md` and `seo/README.md` still describe **Phase 0**: fixtures data source, **`noindex` everywhere**, and serving on `idlookup.ai/people/*` via a Cloudflare path-split. **None of that is current.** Reality (per `lib/site.js`, `app/layout.js`, live site): dedicated domain `idlookup.me`, whole-domain Vercel, **`robots: index,follow` globally**, DB/JSON real data + augmentation. Memory (`project_seo_live_idlookup_me`, `project_seo_content_augmentation`) is accurate; the committed README/DEPLOY.md are not. Recommend updating them.

---

## 2. Live verification (what's actually serving right now)

| Check | Result |
|---|---|
| `robots.txt` | `User-Agent: *` / `Allow: /` / `Sitemap: https://idlookup.me/sitemap.xml`. Fully open. |
| `/` and `/people` | Live. `/people` = state index (50 states + DC + PR with populations), FCRA disclaimer, opt-out/privacy footer to idlookup.ai. |
| Sitemap | Sitemap **index** → 20 children (`/sitemap/0.xml`…`19.xml`), lastmod 2026-07-11. Total **≈868,345 URLs** (0–18 = 45,000 each, 19 = 13,345). |
| Sitemap composition | Chunk 0: 44,938/45,000 are 4-segment `/people/{st}/{city}/{name}` leaves; 59 are city landings; rest index/state. `/profiles/*` URLs appear only in the tail (chunk 19), ~4 per profile ≈ 2.5k total. |
| City page (`/people/mi/detroit`) | Renders (augmentation modules present). |
| Profile leaf (`/profiles/charles-jackson/mi/detroit/p0719942576`) | **200**, `<meta name="robots" content="index, follow">`, JSON-LD present in raw HTML (no JS needed): Organization, WebPage, BreadcrumbList, **Person**, FAQPage. `streetAddress:null` in PostalAddress. |
| `site:idlookup.me` (WebSearch proxy) | **No idlookup.me results returned.** Soft signal that Google has **not yet meaningfully indexed** the domain (fresh `.me`); not authoritative — GSC Coverage is the only real answer. |

**Good news from the leaf curl:** the "aggressive PII street-in-JSON-LD" risk that memory worried about is **not currently live** — the teaser only captures city/state (`sweep-profiles.mjs` `addressList` maps `{city, state}` only), so `streetAddress` is `null` for every swept profile. The visible teaser masks phone/email. Real PII still in JSON-LD/HTML: full name, **age**, city+state, prior cities, **named relatives** (`relatedTo`), aliases. That is still an aggregator PII surface, but it is not house-level address exposure today.

---

## 3. GA-readiness assessment

### 3a. Data scale — the core product gap
- **619 profiles** is the entire real-people inventory. Against 866k taxonomy URLs, the real data is a rounding error: most name-in-city pages resolve to a Census estimate and a funnel CTA, not a person.
- **Capture is head-excluded by design.** `EST_IN_STATE_MAX=1000` → common names in populous states `TooManyMatches` and yield zero. The sweep can only harvest rare/long-tail name×state combos.
- **Throughput cap:** headed Playwright, Turnstile-gated, ~1 call / 4.5s, human-in-loop on failure bursts (`ensureSession` backoff to 5 min). Even running flat-out this is thousands/day, not millions.
- **Verdict:** the memory NEXT item "HEADED sweep to 50×50" grows the long tail marginally; it does **not** get to a scaled product. The real dependency is a **bulk BC/IDI feed** (batch export or an un-throttled server-side search). That is the #1 thing to put in front of BC.

### 3b. Indexing status
- Everything is `index,follow`; sitemap submitted-ready. But **no evidence of actual indexing** — `site:` returns nothing; fresh domain. **We cannot confirm indexing without GSC** (Search Console property + Coverage/Pages report). That's the memory NEXT item "GSC → submit sitemap → watch indexing," and it's still the only way to know. **Priority: stand up GSC now.**
- Submitting an 868k-URL sitemap where ~99.9% are thin is a way to *invite* a thin-content/doorway evaluation. See 3d.

### 3c. Infra / DB
- Neon wired via `lib/db.mjs`; graceful fallback to `data/profiles.json` (build-resilient — sitemap and pages degrade to committed JSON if Neon blips). **Could not externally confirm whether `DATABASE_URL` is set in Vercel** — the one live leaf I tested (`p0719942576`) is *also* in the committed JSON, so it's served identically either way. Memory NEXT item "confirm DATABASE_URL in Vercel" is **still unverified**; check the Vercel project env directly.
- **Dead safety valve:** `db/schema.sql` defines `indexable BOOLEAN DEFAULT FALSE` for staged rollout, and `dbSitemapRows(indexableOnly)` supports it — but `getSitemapUrls()` (`lib/data.js:94`) calls it **with no arg** (all rows) and `app/layout.js` sets `index:true` globally. **The staged-rollout gate DEPLOY.md describes gates nothing; the whole site is live-indexed.** If you want a staged flip, this is where to wire it.

### 3d. Content quality / thin-content risk (the headline)
Tier the surface — it is not uniform:
- **City pages (~one per city, low thousands): defensible.** Genuine, sourced augmentation (ACS, occupations, ethnicity, pop chart, notable people, historic places, newspapers, map). These can rank on their own merits.
- **Name-in-city leaves (~800k+): the doorway risk.** Templated, no per-person content, differ mainly by a Census estimate and city name, and exist primarily to funnel to idlookup.ai. `lib/facts.js` adds `hash()`-based prose variation to dodge an identical footprint — a tell that the pages are thin enough to need it. At 800k scale this is exactly what triggers "Scaled content abuse" / doorway manual actions.
- **Profile leaves (~2.5k): fine content-wise**, but tiny and orphaned (see 3f).

### 3e. Opt-out / legal (blocker — see TL;DR #2)
No suppression column, no propagation from `idlookup.ai/optout` to the Neon/JSON store, unconditional upsert. Add a `suppressed` flag + a removal job before scaling PII, and honor it in `getPerson`/`dbSitemapRows`. FCRA disclaimer footer is present on every page (good), but "we link to opt-out" without an actual removal path is the exposure.

### 3f. Smaller bugs / SEO hygiene
- **Broken internal links + invalid JSON-LD URLs on every profile leaf with relatives.** `personJsonLd.relatedTo[].url` and the leaf's relatives section both build `/people/{name}` (e.g. `/people/jesse-jackson`) — **verified 404** (correct hub path is `/profiles/{name}`, which 200s). `lib/schema.js:71` hardcodes `${SITE}/people/${…}`; leaf `app/profiles/.../[id]/page.js:125` hardcodes `/profiles/${…}` — inconsistent, and the schema one points at 404s. Google penalizes structured-data URLs and internal links that 404. **Cheap, high-value fix.**
- **619 real profiles are orphaned from the 866k taxonomy.** The `/people/*` tree never links into `/profiles/*`; the only discovery path for a real profile is the sitemap + the `/profiles` tree itself. The rich taxonomy authority doesn't flow to the profiles that actually convert.
- **Potential cannibalization:** `/people/mi/detroit/charles-jackson` (thin taxonomy) and `/profiles/charles-jackson/mi/detroit/...` (real) target the same name+city intent with two URL families.
- **Path-split to idlookup.ai/people not started.** `lib/site.js` treats idlookup.me as prototype, idlookup.ai as target via Cloudflare path-split — memory NEXT item #4, not yet done. Running the PII directory on a **separate domain** actually *contains* manual-action risk away from the money domain; consider that a feature until content quality is proven, not a gap to close hastily.

---

## 4. Prioritized plan

### This week (unblocked, do now)
1. **Stand up Google Search Console** for idlookup.me; submit `/sitemap.xml`; watch Coverage/Pages. This is the only way to answer "is anything indexed" and to catch a manual action early. (No indexing evidence exists today.)
2. **Fix the `relatedTo` / relatives 404 links** — `lib/schema.js:71` and the leaf relatives block → `/profiles/{name}` (namePath), not `/people/{name}`. One-line class of fix; removes bad structured-data URLs + dead links on every leaf.
3. **Confirm `DATABASE_URL` in the Vercel project** (still unverified). If unset, the site is silently serving the 619-row committed JSON, and any DB-driven scale-up won't appear.
4. **Update `seo/DEPLOY.md` + `seo/README.md`** to reality (idlookup.me, indexable, DB/augmented) — they still say Phase 0 / noindex / fixtures and will mislead the next operator.
5. **Decide the thin-page posture** (see risks). At minimum, consider **noindexing the ~800k name-in-city leaves** (keep them crawlable for funnel links but out of the index) and letting the **defensible city pages + real profile leaves** carry the index. Wire it via the already-existing `indexable` gate + a per-route robots override. Shrinking 868k→~tens-of-thousands of quality URLs is the single best defense against a scaled-content manual action.

### Blocked on BC (file in parallel — the real scale story)
6. **Bulk BC/IDI data feed** to replace the Turnstile sweep. Without it there is no path from 619 → millions; the sweep is head-excluded and rate-capped. This is the top BC ask for this surface.
7. **City-forwarding to IDI** (already noted in `lib/directory.js`): today common-name-in-small-city SERPs still teaser on name+state and may thin; when BC forwards city, the name-in-city pages "self-heal" and the whole thin tier gets more resolvable.

### Before scaling PII (compliance)
8. **Opt-out propagation:** add `suppressed`/`removed` to `db/schema.sql`, honor it in `getPerson`/`dbPeopleByName`/`dbSitemapRows`, and build the job that ingests idlookup.ai opt-outs. Do this **before** growing the profile count.

### After (growth)
9. Internal-link the taxonomy into real `/profiles/*` (flow authority to converting pages; de-orphan the 619).
10. Resolve `/people` vs `/profiles` cannibalization (pick one canonical family per name+city).
11. Execute the idlookup.ai/people Cloudflare path-split **only once content quality is proven in GSC** — until then the separate domain contains risk.

---

## 5. Biggest risks (ranked)
1. **Scaled-content / doorway manual action** from submitting 868k thin, template-varied, funnel-oriented pages. Highest-probability, highest-impact. Mitigate by pruning the index to quality pages (#5) before pushing for crawl.
2. **PII opt-out non-compliance** — no removal path into the store (#8). Legal + Google policy.
3. **No real scale path without BC** — 619 profiles, head-excluded + rate-capped capture (#6).
4. **Reputational/domain risk to idlookup.ai** if the path-split ships before quality is proven (#11).
5. **Minor but live:** 404 structured-data/internal links on every leaf with relatives (#2), orphaned profiles, cannibalization.

---

## Appendix — key files
- Hosting/canonical: `seo/lib/site.js` (idlookup.me = SITE, idlookup.ai = MAIN)
- Global robots (index,follow): `seo/app/layout.js`
- Taxonomy + gates: `seo/lib/directory.js` (`EST_IN_STATE_MAX`, `EST_IN_CITY_MIN/MAX`, `getTaxonomyUrls`)
- Real-profile data access + sitemap builder: `seo/lib/data.js`
- Neon access + dead `indexable` gate: `seo/lib/db.mjs`, `seo/db/schema.sql`
- JSON-LD (incl. the `/people/{name}` 404 bug): `seo/lib/schema.js`
- Augmentation data/prose: `seo/lib/facts.js`, `seo/data/city-*.json`, `seo/data/name-facts.json`
- Profile leaf template: `seo/app/profiles/[name]/[state]/[city]/[id]/page.js`
- City landing template: `seo/app/people/[state]/[city]/page.js`
- Name-in-city (thin) template: `seo/app/people/[state]/[city]/[name]/page.js`
- Capture pipeline (Turnstile-gated, capped): `seo/scripts/sweep-profiles.mjs`
- Stale docs to fix: `seo/DEPLOY.md`, `seo/README.md`
