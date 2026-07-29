# GSC Recovery Checklist

Current production domain: `https://idlookup.me`

Last verified: 2026-07-29

## Submitted Sitemaps

Keep exactly one active submitted sitemap in Google Search Console:

- `https://idlookup.me/sitemap-directory.xml`

Remove old submissions after Google has seen their redirects:

- `https://idlookup.me/sitemapv2.xml`
- `https://idlookup.me/sitemap.xml`

Both legacy endpoints should return `301` to `/sitemap-directory.xml`.

## Current Sitemap Shape

The submitted sitemap should stay narrow until GSC shows recovery:

- `1,563` URLs total
- all URLs unique
- includes `/` and `/people`
- root, state, and city URLs only
- no county URLs
- no name-in-city URLs
- no profile URLs
- no URLs that intentionally serve `noindex`

Validate locally or live with:

```bash
npm run smoke:local
SEO_SMOKE_BASE=https://idlookup.me npm run smoke
SEO_AUDIT_BASE=https://idlookup.me npm run audit:sitemaps
```

The smoke script should report:

```text
OK   sitemap-directory shape -> 1563 unique root/state/city URLs
```

The sitemap audit should report zero duplicates, redirects, 404/410 responses, `noindex` pages,
empty titles, and missing canonicals.

## GSC Monitoring

Watch these buckets before widening the sitemap:

- Indexed pages from `sitemap-directory.xml`
- Discovered - currently not indexed
- Crawled - currently not indexed
- Excluded by `noindex`
- Duplicate without user-selected canonical
- Alternate page with proper canonical tag
- Soft 404
- Not found (404)
- Page with redirect

Use URL Inspection on representative pages:

- `https://idlookup.me/`
- `https://idlookup.me/people`
- `https://idlookup.me/people/ca`
- `https://idlookup.me/people/fl/miami`
- `https://idlookup.me/people/tx/houston`

## Do Not Widen Yet

Do not add county, name, profile, or long-tail city/name URLs to submitted sitemaps until:

- the current 1,563 submitted URLs are mostly crawled
- indexed count is trending up
- `noindex` and duplicate buckets are not growing from submitted URLs
- sampled county/name pages pass a status, title, canonical, robots, and render-time audit

Deep pages can remain discoverable through internal links while the submitted sitemap stays conservative.
