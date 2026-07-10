// Chunked sitemap (Next 15). The state → city → name taxonomy is ~600k+ URLs, past
// the 50k-per-file cap, so generateSitemaps splits it into /sitemap/{id}.xml files
// behind a sitemap index. URLs point at the canonical domain (SITE), never the deploy.
import { getSitemapUrls } from '../lib/data';
import { SITE } from '../lib/site';

const CHUNK = 45000; // safely under the 50k sitemap limit

export async function generateSitemaps() {
  const urls = await getSitemapUrls();
  const n = Math.max(1, Math.ceil(urls.length / CHUNK));
  return Array.from({ length: n }, (_, id) => ({ id }));
}

export default async function sitemap({ id }) {
  const urls = await getSitemapUrls();
  const slice = urls.slice(id * CHUNK, id * CHUNK + CHUNK);
  const now = new Date();
  return slice.map((path) => {
    const depth = path.split('/').length; // /people/{st}/{city}/{name} = 5
    return {
      url: `${SITE}${path}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: path === '/people' ? 0.8 : depth >= 5 ? 0.5 : depth === 4 ? 0.6 : 0.7,
    };
  });
}
