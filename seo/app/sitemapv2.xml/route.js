// Legacy conservative sitemap endpoint.
//
// Its 1,000 URLs are now a subset of /sitemap-directory.xml, so keeping both submitted
// creates duplicate sitemap reporting in GSC without adding crawl coverage. Redirect old
// GSC/bookmarked submissions to the canonical sitemap instead of serving overlapping URLs.
import { SITE } from '../../lib/site';

export const dynamic = 'force-static';

export function GET() {
  return new Response(null, {
    status: 301,
    headers: { Location: `${SITE}/sitemap-directory.xml` },
  });
}
