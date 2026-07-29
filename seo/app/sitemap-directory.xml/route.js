// Canonical DIRECTORY sitemap at /sitemap-directory.xml (SEO recovery, 2026-07-18).
//
// After the 7/12–7/15 deindex (URL-churn 404s → impressions to 0), the /people/* directory pages were
// fixed (ISR-cached + no more 404s). This sitemap re-crawls the QUALITY core of that directory — every
// state + city (ACS-rich) + the top ~45k name-in-city pages by population — with a FRESH lastmod so
// Google re-fetches the now-fixed pages. Deliberately NOT the full ~335k taxonomy: the thin long-tail is
// what tanked the domain and is "discovered – not indexed", so re-dumping it re-floods without helping.
// One flat <urlset> (no index). This is the only sitemap advertised in robots.txt.
import { getDirectoryUrls } from '../../lib/directory';
import { SITE } from '../../lib/site';

export const dynamic = 'force-static';
export const revalidate = 86400; // 1d

// FRESH one-time bump (owner + advisor 2026-07-18): the listed pages genuinely changed (fixed + made
// cacheable), so a single new lastmod legitimately says "re-crawl these." Keep it STABLE afterward —
// a per-crawl `now()` trains crawlers to distrust lastmod. Bump only on a real content change.
const LASTMOD = '2026-07-24'; // bumped: added the root homepage `/` (was a 307 redirect Bing/GSC wouldn't
                              // index; now real content). Genuine change → legit re-crawl signal.

export async function GET() {
  // Step 2 (owner-approved 2026-07-20): DON'T list name-in-city here. Only ~980 of ~42k carry unique
  // first-party content (a captured individual, person_profiles); the other ~41k now serve robots:noindex
  // (page-level, in the name-in-city route) as near-dup boilerplate. Listing 41k noindex URLs in the
  // sitemap of a recovering domain is an anti-signal, so we emit ZERO name-in-city (maxNamePages: 0).
  //
  // Also don't list name-in-state candidates here. Census-derived candidates can return noindex when the
  // exact name has no incarceration/sex-offender match, and DB-proven candidates make the sitemap route
  // build/runtime dependent on live Neon. Keep the submitted sitemap DB-free and limited to fast, stable
  // root/state/city pages; first-party name/county pages remain discoverable from those hubs.
  const { all } = getDirectoryUrls({ maxNamePages: 0, includeNameStates: false });
  // County hubs are differentiated pages, but they are DB-heavy and currently too slow/fragile under
  // concurrent crawl. Keep them discoverable from state pages; leave them out of the submitted sitemap
  // until they pass a full status/noindex walk.
  const countyHubs = [];
  // Root homepage first — it's now real indexable content (2026-07-24), so it belongs in the submitted sitemap.
  const items = ['/', ...all, ...countyHubs].map((path) => {
    const depth = path.split('/').filter(Boolean).length; // /people=1, state=2, name-in-state/city=3, name-in-city=4
    const priority = depth <= 1 ? '1.0' : depth === 2 ? '0.9' : depth === 3 ? '0.8' : '0.6';
    return `  <url><loc>${SITE}${path}</loc><lastmod>${LASTMOD}</lastmod>` +
      `<changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
