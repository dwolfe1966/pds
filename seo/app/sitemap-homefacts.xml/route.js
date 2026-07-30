// HomeFacts sitemap at /sitemap-homefacts.xml — the QUALITY core of the /homefacts area-profile section.
//
// Deliberately conservative (the domain is recovering from a thin-page deindex — see the directory sitemap's
// notes): only pages with genuinely rich, multi-source content. That's the landing, every state hub (51), and
// the ~2,000 cities that carry ACS demographics (city-acs.json = real Census data + FEMA + schools + etc.).
// Counties (~3,200) and ZIPs stay DISCOVERABLE via crawl from the state/city pages, but are NOT force-fed:
// county/zip ACS is fetch-at-generation, so mass-listing them would make the crawl slow and DB/API-dependent.
import CITY_ACS from '../../data/city-acs.json';
import STATE_SLICE from '../../data/state-slice.json';
import { SITE } from '../../lib/site';

export const dynamic = 'force-static';
export const revalidate = 86400; // 1d

const LASTMOD = '2026-07-30'; // HomeFacts area-profile section launched.

export async function GET() {
  const urls = ['/homefacts'];
  for (const lc of Object.keys(STATE_SLICE.states)) urls.push(`/homefacts/${lc}`);
  // Cities with real ACS content only (key = "ST/slug").
  for (const key of Object.keys(CITY_ACS)) {
    const [st, slug] = key.split('/');
    if (st && slug) urls.push(`/homefacts/${st.toLowerCase()}/${slug}`);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((path) => {
      const depth = path.split('/').filter(Boolean).length; // homefacts=1, state=2, city=3
      const priority = depth <= 1 ? '0.9' : depth === 2 ? '0.8' : '0.7';
      return `  <url><loc>${SITE}${path}</loc><lastmod>${LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>${priority}</priority></url>`;
    }).join('\n')
  }\n</urlset>\n`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
}
