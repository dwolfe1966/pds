# idlookup-seo

Standalone Next.js app for the IDLookup SEO surface. It is currently deployed as
the indexable `idlookup.me` prototype and hands search/conversion traffic to the
main product app at `idlookup.ai`.

## What It Serves

- `/` — indexable homepage with links into the directory.
- `/people` — state directory hub.
- `/people/{state}` — state hub with cities, incarceration/sex-offender signals when available.
- `/people/{state}/{city}` — city hub with ACS, map, population, notable people, historic places, newspapers, nearby cities, and name links.
- `/people/{state}/{city}/{first-last}` — name-in-city page. It is indexable only when captured person data exists; otherwise it serves `noindex,follow`.
- `/people/{state}/{city}/{first-last}/{id}` — captured person profile leaf.
- `/people/{state}/county/{county}` and `/people/{state}/county/{county}/{first-last}` — incarceration/county record pages.
- API routes under `/api/*` for leads, enrichment, email lifecycle, WSFY, suppression, breach monitoring, phone intel, and incarceration lookup.

Legacy `/profiles/*` and old name-first `/people/{name}/{state}/...` URLs are handled by
`middleware.js` so old indexed URLs redirect to a current state-first page or return `410`
when there is no usable state.

## Data Model

The directory taxonomy is driven by committed public-data JSON in `data/`.
Runtime/differentiated data comes from Neon when configured:

- captured people/search activity
- leads and abandoned-checkout recovery
- member enrichment and suppression
- incarceration and sex-offender records
- phone, email, breach, social, and life-event enrichment

Most DB-backed modules use `LEADS_DATABASE_URL || DATABASE_URL || POSTGRES_URL`.
When DB or provider env vars are absent, most endpoints degrade to empty/skipped responses
rather than blocking the static SEO pages.

## SEO Posture

The current surface is indexable at the app level. Thin combinations are controlled at the
route/sitemap level:

- `robots.txt` lists `/sitemapv2.xml` and `/sitemap-directory.xml`.
- `/sitemap.xml` redirects to `/sitemap-directory.xml`.
- the full historical long-tail sitemap was retired.
- name-in-city pages without captured people use `noindex,follow`.
- sitemaps emphasize root, state, city, roster-state name pages, county hubs, and a limited quality set.

Do not widen generic name/city URL volume until GSC shows the narrowed quality set is healthy.

## Run

```bash
cd seo
npm install
npm run dev      # http://localhost:3005
npm run build
npm run start    # http://localhost:3005
```

Smoke test the production build locally, or test a running/deployed instance:

```bash
npm run smoke:local
SEO_SMOKE_BASE=http://localhost:3005 npm run smoke
SEO_SMOKE_BASE=https://idlookup.me npm run smoke
```

## Local Artifacts

Large raw data and local secrets are intentionally ignored: `obis/`, `scratchpad/`,
`.next/`, `node_modules/`, `data/name-pairs.ndjson`, local env files, and local provider
key/recovery-code files.
