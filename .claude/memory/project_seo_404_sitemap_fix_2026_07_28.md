---
name: project_seo_404_sitemap_fix_2026_07_28
description: idlookup.me GSC fixes — index-drop is intentional noindex pruning; legacy-URL 404s + 360k chunked sitemap retired
metadata:
  type: project
---

GSC "why pages aren't indexed" triage + fixes for idlookup.me, 2026-07-28 (seo-auditor-verified live).

**KEY REFRAME — the indexed-count DROP is NOT a bug.** It's the owner-approved noindex pruning from commit `de81f2f` (2026-07-20, "Step 2 — noindex boilerplate name-in-city residue"): name-in-city pages (`app/people/[state]/[city]/[name]/page.js:46`) are `noindex` UNLESS a real captured individual exists (`person_profiles`). ~All name-in-city indexed 07-10→07-20 were de-indexed on the 07-20 deploy, by design. 404s/dupes can't remove indexed pages; only this could. Confirm via GSC → Pages → "Excluded by 'noindex' tag" count (was missing from the owner's bucket list).

GSC buckets (2026-07-28): Crawled-not-indexed 3,549 · Discovered-not-indexed 1,971 · Not found 404 = 1,423 · Dup-Google-chose-canonical 210 · Dup-no-canonical 59 · Page-with-redirect 5.

**FIXES SHIPPED + verified live (curl, all pass):**
1. **Legacy-URL 404s** (`seo/middleware.js`, matcher now `['/people/:path*','/profiles/:path*']`): profile URLs went name-first `/people/<name>/...` → `/profiles/<name>/...` → now state-first Census `/people/<state>/<city>/<name>/<id>`, and the `/profiles` route was DELETED. Old middleware still 301'd to dead `/profiles` → 404. NEW: legacy `/profiles/*` + name-first `/people/<name>/*` → **301 to name-in-state `/people/<state>/<name>`** (auditor MEASURED 200+indexable for any name; the legacy city/id grain 404s because the directory only has top-N names per city). No usable 2-letter state → **410**. Discriminator: seg1 has a hyphen ⇒ legacy name; 2-letter state ⇒ current, pass through.
2. **360k crawl-budget bleed**: `/sitemap.xml` was a live index → `/sitemap/{id}.xml` (8× 45k = ~360k mostly-noindex name-in-city URLs), NOT declared in robots but still served/discoverable. Deleted `app/sitemap.js` (chunk generator) → chunks 404; rewrote `app/sitemap.xml/route.js` → **301 to /sitemap-directory.xml**. The two declared sitemaps (`sitemapv2.xml` 1,000 + `sitemap-directory.xml` 2,332) are clean geo-only (states/cities/counties), all 200.

**Duplicates (269) = content, NOT canonical bug** — canonicals verified clean/self-referential; don't "fix" them. Near-duplicate templated pages; same lever as thin-content. **Crawled/Discovered-not-indexed (5,520) = thin content + young-domain authority** ([[project_seo_indexing_incident]]) — not a config fix; ties to the fold-into-idlookup.ai + first-party-verticals strategy.

**OWNER GSC to-dos:** remove any `/sitemap.xml` or `/sitemap/N.xml` from GSC+Bing Sitemaps (keep only v2+directory); pull "Excluded by noindex" count; Validate-Fix on Not-found + Page-with-redirect; verify a REAL captured-person leaf `/people/<state>/<city>/<name>/<id>` returns 200+index (auditor only tested a fake id → 308-strips to name page; if real ids also strip, captured pages have no indexable URL = bigger problem).
