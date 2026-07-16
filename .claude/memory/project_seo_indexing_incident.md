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

## Strategy going forward
Don't advertise the 360k leaves until they carry REAL per-person content (the profile/lazy-pull
work in [[project_seo_individual_profiles]]). Earn trust on ~1000 solid pages, then WIDEN
deliberately. If we later re-expand: keep flat urlsets, gate hard on content quality, grow
gradually — never dump the full taxonomy on the domain again. Relates to
[[project_seo_live_idlookup_me]], [[project_seo_content_augmentation]].
