# idlookup-seo — programmatic SEO surface

Phase 0 (proof of crawl) of `docs/seo/implementation-plan.md`. A separate Next.js app that
serves ONLY the indexable `/people/*` tree; the Parcel SPA keeps every other path. In
production a reverse proxy / Cloudflare splits traffic by path (plan §1).

## Status — Phase 0

- One server-rendered profile template: `/people/{first}-{last}/{st}/{city}/{id}`
  with title/meta, visible teaser (Spokeo split per plan §0.2), and all JSON-LD blocks
  (Organization, WebPage, BreadcrumbList, Person, FAQPage) in the initial HTML.
- **Data source: fixtures** (`lib/fixtures.js`) shaped like our BC teaser adapter output.
  The BC adapter seam is `lib/data.js#getPerson` — swap in the live BC call when SEO ASK 0
  lands (dev captcha fix / sample payloads; see docs/seo/bc-coverage-probe.md).
- **Everything is `noindex` for now** (`app/layout.js` metadata.robots): proof-of-crawl via
  GSC URL Inspection works with noindex; indexing switches on with the staged rollout
  (plan §0.5), not before.
- ISR: pages revalidate every 60 days (people data is slow-changing; keeps BC lookups
  ≈ one per page per window once live).

## Run

```bash
cd seo && npm install
npm run dev     # http://localhost:3005/people/david-aab/ga/cumming/p0000000001
npm run build && npm start
```

Verify SSR: `curl -s localhost:3005/people/david-aab/ga/cumming/p0000000001 | grep -o 'application/ld+json'`
— all content and schema must be present WITHOUT JavaScript execution (teardown §1.7:
client-rendered profile trees are a documented indexing failure at this scale).

## IDs

URLs use OUR public IDs (`p` + 10 digits), never raw BC/IDI record IDs (locked decision
§0.1 — URL churn at scale is unrecoverable). `lib/ids.js` is the mapping seam; the real
mint/store comes with Phase 1 taxonomy work.
