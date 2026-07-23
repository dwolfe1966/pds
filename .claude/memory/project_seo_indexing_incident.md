---
name: project_seo_indexing_incident
description: idlookup.me indexing/impressions dropped 7/13; diagnosis + conservative sitemapv2.xml fix (retreat from 360k thin pages)
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

**Incident:** Google search impressions dropped starting **2026-07-13** and crawling stalled;
Bing sitemap upload reported "only 8 URLs discovered." Owner wanted a CONSERVATIVE sitemap.
Fixed 2026-07-16 (commits `2bda4ed` sitemapv2 + `e5d6902` robots repoint).

## Diagnosis (root causes, ranked)
1. **Scaled/thin content on a 2-week-old domain.** Site went live ~7/05; taxonomy ballooned to
   **~360k** name×city pages (state-first `/people/{st}/{city}/{name}`) by 7/10–7/13, each ~579
   words of templated Census stats, near-duplicate across cities (579 vs 555). New domain + 360k
   thin templated pages = Google's "scaled content" pattern → honeymoon-over quality pullback
   right at 7/13. This is the PRIMARY trigger.
2. **Sitemap was an INDEX of 8 chunks.** `/sitemap.xml` = `<sitemapindex>` → `/sitemap/{id}.xml`
   (8 × 45k). Introduced 7/10 (`ea25931`). Bing read the index and reported the 8 chunk-pointers
   as "8 URLs" (didn't recurse well). Index adds a hop new domains get little benefit from.
3. **Every `/people/*` page serves DYNAMIC + `cache-control: no-store` (x-vercel-cache MISS on
   every hit, confirmed 3×).** Only `/people` (static PRERENDER) + sitemap files are cached. Cause
   = the `/people/:path*` middleware (added 7/14, `281e686`, for legacy-URL 301s) + NO
   `generateStaticParams` → routes drop out of the CDN cache. NOTE: middleware is 7/14, AFTER the
   7/13 drop, so it COMPOUNDED (crawl-budget bleed at 360k dynamic renders) but wasn't the original
   trigger. Owner said the caching fix is **NOT necessary** for now (1000 dynamic renders is fine).

## The fix (conservative retreat)
- **NEW `app/sitemapv2.xml/route.js`** — a FLAT `<urlset>` (no index, no chunks) of **~1000
  high-trust URLs**: `/people` hub + all 50 state pages + top ~950 cities by population (all
  content-rich, all 200; verified through position #1000). `force-static`, stable fixed `lastmod`
  (NOT per-crawl `now` — that trains crawlers to distrust lastmod).
- **`robots.txt` repointed** to `/sitemapv2.xml` (was the old index). Old `/sitemap.xml` index +
  chunks left resolving but no longer referenced anywhere → fades from crawler attention.
- Owner resubmits sitemapv2.xml in Search Console + Bing manually. Recovery = days-to-weeks.

## 2026-07-18 UPDATE — it got WORSE (impressions → 0) + recovery shipped
Owner reported Google traffic **stopped**. GSC facts: **no manual action**; **impressions → 0** (7/12
drop → 0 on 7/15) = pages were **DEINDEXED, not demoted**. GSC Pages: Discovered-not-indexed 13,015 +
Crawled-not-indexed 767 + **Not found(404) 1,231** + duplicates 260 + ~13.5k indexed. Owner: "the 404
pages exist when I visit" — confirmed (25/25 sampled = 200). So **transient/churn 404s**, not real gone.
**Root cause = the URL-structure churn itself** (profile pages moved `/people/<name>` → `/profiles/<name>`,
`/people/` handed to state directory) mass-404'd Google's indexed set 7/12–7/15 → deindex cascade.
Ruled out: X-Robots-Tag header (none), robots block (allows all), canonical errors (self-referential now).

**Phase 1 fixes SHIPPED (auto-deployed to Vercel):**
- **Caching FIXED** (reversed the earlier "not necessary" call — situation escalated): added
  `generateStaticParams(){return []}` to all 9 dynamic routes → flipped `ƒ Dynamic` → `● ISR-cached`.
  Verified LIVE: leaf went `private,no-store,MISS` → `public…HIT`. Kills per-crawl live Neon renders
  (the 404 amplifier).
- **404 → 308 id-fallback** on BOTH leaf systems: `/profiles/.../[id]` (p-id from `profiles`) and
  `/people/.../[id]` (age-token from captured corpus). Churned id now redirects to same-person or the
  name-in-city hub instead of `notFound()`. Verified: `/profiles/.../pFAKE` → 308 → hub.
- Legacy-URL audit: root `/<state>/<name>`, `/people/<state>/<name>`, legacy `/people/<name>` (middleware
  301→/profiles) all resolve 200/301. Zero 404s on indexed patterns.
- Also: 338k URLs submitted to **Bing via IndexNow** (key route `app/<key>.txt`, script
  `scripts/indexnow-submit.mjs --scope=full`).

**Canonical directory sitemap SHIPPED (live):** `/sitemap-directory.xml` = flat urlset, **46,562 URLs**
(all 52 states + 1,509 cities + top **45k** name-in-city by population; `getDirectoryUrls()` in
directory.js, cap 45k). Fresh `LASTMOD=2026-07-18` (one-time bump — pages genuinely changed; keep stable
after). Deliberately EXCLUDES the ~290k thin long-tail (the incident set). robots.txt now lists BOTH
sitemapv2 (1000) + sitemap-directory. Honest caveat: this re-crawls the fixed/indexed-then-404'd pages;
it will NOT force the 13.8k never-indexed thin pages in ("discovered – not indexed" = Google already declined).

**Phase 2 — OWNER must do in Search Console:** (1) Validate Fix on "Not found(404)" + "Duplicate"; (2)
submit a sitemap of the CANONICAL name/profile URLs (sitemapv2 only has the 1000 — the name pages Google
wants aren't in it); (3) URL-Inspect → Request Indexing on ~5 top pages. Recovery = 2–6 wks as Google
re-crawls. **Phase 3 (the 13.8k never-indexed thin pages) = slow authority/content game** (consolidate
duplicate URL patterns to one canonical + thicken pages via [[project_seo_content_augmentation]]).

## 2026-07-23 UPDATE — live re-verify: Phase-1 technical fixes are HOLDING
Owner asked again "still no traffic." Re-checked the live site from outside (no GSC access this session):
- **robots** open (`Allow: /`, Host, 2 sitemaps); **sitemapv2.xml** valid flat urlset **1,052 URLs**;
  **sitemap-directory.xml** live (200); old **sitemap.xml** index still resolves (200, unreferenced — fine).
- **Deep leaves recovered from the 404 cascade:** `/people/ca/los-angeles/john-smith`, `/people/ca/los-angeles`,
  `/ca/john-smith` all **HTTP 200 + `<meta robots=index,follow>` + self-canonical** (the churn 404s that
  deindexed the set 7/12–7/15 are gone).
- **Caching fix holding:** deep leaf + state hub both `x-vercel-cache: HIT` (age 69 / 213s) — ISR-cached,
  not per-crawl no-store. The crawl-budget/404 amplifier is fixed.
- Hero page `/people/ca` = SSR real content (cities+counties+incarceration). Technical health = GOOD.
**Conclusion:** nothing new is broken; this is the expected *waiting-for-reindex* phase ~5–10 days after
Phase-1/2 shipped. NO external tool can confirm Google's state — `site:` via WebSearch isn't Google and
returned nothing (unreliable). **The only instrument is the owner's GSC.** What to read there decides the
next move: (a) did the **Validate Fix** on "Not found(404)"+"Duplicate" PASS? (b) is the **indexed count**
climbing back from the 7/15 deindex? (c) are **impressions off 0**? (d) confirm Phase-2 owner-actions were
actually done (Request Indexing on ~5 top pages; submit a canonical NAME-URL sitemap — sitemapv2 is only the
1,000 city/state, not the name pages Google wants). The 13.8k "discovered – not indexed" thin pile won't
come back via resubmission — that's the slow authority + [[project_seo_content_augmentation]] game.

## 2026-07-23 — GSC numbers in + sitemap now DELIBERATELY 2.3k (not 46k)
Owner's GSC: (1) Validate-Fix on 404/Duplicate **still PENDING** (not passed → Google hasn't reprocessed the
deindex reason, gates everything); (2) **indexed count FLAT**; (3) **17 impressions / 7 days, flat**; (4) only
`sitemap-directory.xml` submitted (Jul 21, Success, **2,291 discovered**). **Bing: ZERO data.**
- Live `sitemap-directory.xml` = **2,302 URLs** (52 states + 1,909 cities + 340 counties [CA/FL/GA/PA only];
  **0 name pages, 0 name-in-state**). GSC's 2,291 ≈ this exactly → **Google reads the whole sitemap; it's just
  small on purpose.** The 46k→2.3k drop is **owner-approved 7/20** (`maxNamePages:0` in the route): the ~41k thin
  name-in-city pages now serve page-level `robots:noindex`; only ~980 unique-content ones stay indexable via
  internal links. This is the CORRECT anti-thin-content cleanup — NOT a bug.
- **VERDICT: "no traffic" is NOT a technical/sitemap problem.** Everything technical is correct and freshly
  cleaned. It's a **domain-authority/trust** problem: a ~7-week-old STANDALONE domain that indexed ~13.5k then
  took a deindex cascade (7/12–7/15) has no trust; GSC's 13k "discovered–not-indexed" = Google declined; **Bing
  zero confirms it's authority, not a Google quirk.** Two owner-gated blockers: Validate-Fix pending (can't force);
  and authority can't be sitemap'd. **Highest-leverage move = fold the CURATED 2,302-page directory into the
  established `idlookup.ai/people`** (inherits real domain authority) — curated set ONLY (already = the current
  sitemap), NEVER the thin tail, to avoid importing the trust problem onto the revenue domain (BC/Cloudflare).
  Minor open Q: counties only for 4 states — confirm intentional (roster-coverage) vs truncated. See
  [[project_seo_individual_profiles]], [[project_seo_content_augmentation]].

## Strategy going forward
Don't advertise the 360k leaves until they carry REAL per-person content (the profile/lazy-pull
work in [[project_seo_individual_profiles]]). Earn trust on ~1000 solid pages, then WIDEN
deliberately. If we later re-expand: keep flat urlsets, gate hard on content quality, grow
gradually — never dump the full taxonomy on the domain again. Relates to
[[project_seo_live_idlookup_me]], [[project_seo_content_augmentation]].
