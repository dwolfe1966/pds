// Sitemap INDEX at /sitemap.xml.
//
// Next's generateSitemaps (app/sitemap.js) serves the chunks at /sitemap/{id}.xml but
// does NOT emit an index, so a bare /sitemap.xml 404s — which is what Search Console
// and most humans try first. This route handler emits the <sitemapindex> that points
// at every chunk, so one URL (/sitemap.xml) can be submitted and it fans out to all
// chunks. robots.txt references this index.
import { getSitemapUrls } from '../../lib/data';
import { SITE } from '../../lib/site';

const CHUNK = 45000; // must match app/sitemap.js

export const dynamic = 'force-static';
export const revalidate = 86400; // 1d

export async function GET() {
  const urls = await getSitemapUrls();
  const n = Math.max(1, Math.ceil(urls.length / CHUNK));
  const now = new Date().toISOString();
  const items = Array.from({ length: n }, (_, id) =>
    `  <sitemap><loc>${SITE}/sitemap/${id}.xml</loc><lastmod>${now}</lastmod></sitemap>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
