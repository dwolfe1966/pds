// Dynamic sitemap (Next 15). Emits idlookup.ai URLs (the canonical domain), never
// the vercel.app deploy URL. Phase 0 = fixture pages; TODO(BC): at scale this
// becomes a chunked sitemap index streamed from the Layer-1 skeleton × the names
// BC returns real people for.
import { getSitemapUrls } from '../lib/data';
import { SITE } from '../lib/site';

export default async function sitemap() {
  const urls = await getSitemapUrls();
  const now = new Date();
  return urls.map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: path === '/people' ? 0.8 : path.split('/').length >= 6 ? 0.6 : 0.7,
  }));
}
