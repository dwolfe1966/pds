// Canonical DIRECTORY sitemap at /sitemap-directory.xml (SEO recovery, 2026-07-18).
//
// After the 7/12–7/15 deindex (URL-churn 404s → impressions to 0), the /people/* directory pages were
// fixed (ISR-cached + no more 404s). This sitemap re-crawls the QUALITY core of that directory — every
// state + city (ACS-rich) + the top ~45k name-in-city pages by population — with a FRESH lastmod so
// Google re-fetches the now-fixed pages. Deliberately NOT the full ~335k taxonomy: the thin long-tail is
// what tanked the domain and is "discovered – not indexed", so re-dumping it re-floods without helping.
// One flat <urlset> (no index). This is the only sitemap advertised in robots.txt.
import { getDirectoryUrls, getStateList } from '../../lib/directory';
import { rosterTopNamesByState } from '../../lib/incarceration.mjs';
import { SITE } from '../../lib/site';

export const dynamic = 'force-static';
export const revalidate = 86400; // 1d

// Roster-proven name-in-state hubs to list (auditor P1-2, 2026-08-14): our name-in-state pages
// (/people/{state}/{name}) are our ONLY differentiated indexable page type, but they were absent from
// every sitemap — discoverable via internal links only. Add them, but ONLY the ones that actually carry a
// first-party record (so they're index,follow — never mix a noindex URL into the sitemap). We source them
// from rosterTopNamesByState (record-count-ranked, DB-proven ≥1 incarceration record) rather than Census
// candidates (which can be noindex). This runs at BUILD + daily ISR revalidate (route is force-static),
// NOT per crawl, so no live-Neon-per-request dependency; a DB hiccup falls back to the geo-only set below.
// Note: SO-only-indexable names (offenders but no inmate record) aren't enumerated here yet — they stay
// internal-link-discoverable (no regression); adding an SO top-names enumerator is a follow-up.
const NAMES_PER_STATE = 150;

async function getIndexableNameStateHubs() {
  const states = getStateList();
  const perState = await Promise.all(
    states.map((st) =>
      rosterTopNamesByState({ state: st.code, limit: NAMES_PER_STATE })
        .then((names) => names.map((n) => `/people/${st.code.toLowerCase()}/${n.slug}`))
        .catch(() => [])
    )
  );
  return perState.flat();
}

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
  // Name-in-state hubs are now included via getIndexableNameStateHubs() below — but sourced from the
  // record-proven roster (index,follow only), not the Census `includeNameStates` path (which can emit
  // noindex names), so keep includeNameStates:false here.
  const { all } = getDirectoryUrls({ maxNamePages: 0, includeNameStates: false });
  // Roster-proven, differentiated, indexable name-in-state hubs (auditor P1-2). Never breaks the sitemap:
  // a DB failure yields [] and we still serve the geo-only core.
  let nameStateHubs = [];
  try { nameStateHubs = await getIndexableNameStateHubs(); } catch { nameStateHubs = []; }
  // County hubs are differentiated pages, but they are DB-heavy and currently too slow/fragile under
  // concurrent crawl. Keep them discoverable from state pages; leave them out of the submitted sitemap
  // until they pass a full status/noindex walk.
  const countyHubs = [];
  // Root homepage first — it's now real indexable content (2026-07-24), so it belongs in the submitted sitemap.
  const items = ['/', ...all, ...nameStateHubs, ...countyHubs].map((path) => {
    const depth = path.split('/').filter(Boolean).length; // /people=1, state=2, name-in-state/city=3, name-in-city=4
    const priority = depth <= 1 ? '1.0' : depth === 2 ? '0.9' : depth === 3 ? '0.8' : '0.6';
    return `  <url><loc>${SITE}${path}</loc><lastmod>${LASTMOD}</lastmod>` +
      `<changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
