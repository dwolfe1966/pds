# SEO Deploy Runbook

The `seo/` app is a standalone Next.js project. Current production posture is the
dedicated prototype domain `https://idlookup.me`, with CTAs and account flows linking to
`https://www.idlookup.ai`.

The older idlookup.ai path-split plan is still viable, but should wait until the
idlookup.me quality set is proven in GSC.

## Vercel Project

1. Import the `pds` repo.
2. Set **Root Directory** to `seo`.
3. Use the Next.js framework preset.
4. Build command: `npm run build`.
5. Output: default Next.js output.

`next.config.js` pins `outputFileTracingRoot` to the `seo` directory so Vercel does not
trace from the parent repo lockfile.

## Required Env Vars

The static directory can build without provider env vars. Production features depend on:

- `LEADS_DATABASE_URL` or `DATABASE_URL` or `POSTGRES_URL` — Neon database.
- `CRON_SECRET` — protects cron/status/test endpoints.
- Email provider: `RESEND_API_KEY` or `SENDGRID_API_KEY`, plus `EMAIL_FROM`.
- Optional provider keys: `HIBP_API_KEY`, `PDL_API_KEY`, `TWILIO_*`, `ENFORMION_*`,
  `BC_CSR_*`, `CAPTCHA_SOLVER_KEY`, `BROWSER_SERVICE_URL`.

Email and cron jobs are intentionally gated by env flags such as `ABANDON_ENABLED=1` and
`LEAD_RM_ENABLED=1`.

## Crons

Configured in `vercel.json`:

- `/api/cron/abandoned-recovery` every 15 minutes.
- `/api/cron/breach-monitor` every 30 minutes.
- `/api/cron/lead-reengagement` every 6 hours.

Verify cron endpoints with `CRON_SECRET` before enabling send flags.

## SEO Verification

After deployment:

1. Confirm `https://idlookup.me/` returns `200` and is not a redirect.
2. Confirm `https://idlookup.me/robots.txt` lists `sitemapv2.xml` and `sitemap-directory.xml`.
3. Confirm `https://idlookup.me/sitemap.xml` redirects to `/sitemap-directory.xml`.
4. View source on a state, city, name, county, and profile page to confirm server-rendered content.
5. Run:

```bash
npm run smoke:local
SEO_SMOKE_BASE=https://idlookup.me npm run smoke
```

Submit/monitor in Google Search Console:

- `https://idlookup.me/sitemapv2.xml`
- `https://idlookup.me/sitemap-directory.xml`

Watch indexing, excluded/noindex counts, crawled/discovered-not-indexed, and manual action status
before increasing sitemap volume.

## Optional idlookup.ai Path Split

Only consider moving behind `idlookup.ai/people/*` after GSC validates the narrowed quality set.
If/when that happens, route these paths to the Vercel SEO app:

- `/people/*`
- `/sitemap-directory.xml`
- `/sitemapv2.xml`
- `/sitemap.xml`

The main app must own `idlookup.ai/robots.txt` and include the SEO sitemap URLs. Update
`lib/site.js` canonicals at the same time so `SITE` matches the public host.
