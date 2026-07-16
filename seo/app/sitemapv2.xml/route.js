// Conservative FLAT sitemap at /sitemapv2.xml.
//
// Deliberately NOT a sitemap index and NOT the 360k-URL taxonomy. After the 7/13 crawl/
// impression drop, we submit a small, high-trust set: the /people hub + every state page +
// the top city pages by population (~1000 URLs total, all content-rich, all resolving 200).
// One flat <urlset>, no baby sitemaps, so a crawler discovers real page URLs directly (the
// old index made Bing report "8 URLs" — the 8 chunk pointers). Widen only once Google is
// crawling again. The old /sitemap.xml index is left in place until we retire it.
import { getStateList, getStateCities } from '../../lib/directory';
import { statePath, cityPath } from '../../lib/ids';
import { SITE } from '../../lib/site';

export const dynamic = 'force-static';
export const revalidate = 86400; // 1d

const TARGET = 1000;
// Stable lastmod (a fixed date, not `now`): re-emitting a fresh timestamp every crawl trains
// crawlers to distrust lastmod. Bump this only when the listed pages genuinely change.
const LASTMOD = '2026-07-16';

function buildUrls() {
  const states = getStateList(); // sorted by population desc
  const out = ['/people'];
  for (const st of states) out.push(statePath(st.code));

  // Every city across all states, ranked by population; take the top N to fill to TARGET.
  const cities = [];
  for (const st of states) {
    for (const c of getStateCities(st.code)) {
      if (c && c.slug && c.pop != null) cities.push({ pop: c.pop, path: cityPath(st.code, c.slug) });
    }
  }
  cities.sort((a, b) => b.pop - a.pop);
  const room = Math.max(0, TARGET - out.length);
  for (const c of cities.slice(0, room)) out.push(c.path);
  return out;
}

export async function GET() {
  const urls = buildUrls();
  const items = urls.map((path) => {
    const priority = path === '/people' ? '1.0' : path.split('/').length === 3 ? '0.8' : '0.6';
    return `  <url><loc>${SITE}${path}</loc><lastmod>${LASTMOD}</lastmod>` +
      `<changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
