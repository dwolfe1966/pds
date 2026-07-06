---
name: project_seo_live_idlookup_me
description: SEO people-search directory is LIVE + indexable on idlookup.me (Vercel + Neon Postgres); prototype for idlookup.ai/people
metadata: 
  node_type: memory
  type: project
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

The programmatic-SEO directory is **live and indexable at https://idlookup.me** (verified
2026-07-05): `/people` index, name→state→city hubs, and profile leaves — all server-rendered
with canonical→idlookup.me, `robots: index,follow`, sitemap (1,499 URLs), and 5 JSON-LD types
(Organization/WebPage/Breadcrumb/Person/FAQPage). Leaves show masked contact + a "Records that
may be available" tease (criminal/property/financial/… categories w/ counts, present-only) +
category FAQ. "Unlock" → idlookup.ai/search (funnel handoff, cross-domain).

**Architecture:** `seo/` Next.js app on **Vercel** (whole domain idlookup.me → Vercel, no
Cloudflare Worker — dedicated domain, so no path-split needed). Profiles persist in **Neon
Postgres** (`lib/db.mjs`, schema `seo/db/schema.sql`; falls back to `seo/data/profiles.json`
when no DATABASE_URL). Host split via `seo/lib/site.js`: `SITE`=idlookup.me (our pages),
`MAIN`=idlookup.ai (funnel + legal). Kept the `/people` prefix for a clean 1:1 swap to
idlookup.ai/people/* later (path-split described in `seo/DEPLOY.md`).

**Data (~619 profiles, 35 names, 43 states):** captured from the prod BC teaser via the
**MCP/Playwright browser** (clears Turnstile) — name×state sweep. KEY: common names alone
→ `TooManyMatches`, but **name+state works**, so BC covers the whole directory, no vendor
needed ([[reference_bc_extid_ephemeral]] — ids minted from name+city+state+first-seen, NOT
the ephemeral extId). Scale populate = `seo/scripts/sweep-profiles.mjs` → upserts to Neon;
**headless is Turnstile-blocked → must run `HEADED=1`** (owner-present). `--batch`/`seed-db`
also load captures.

**NEXT:** (1) confirm `DATABASE_URL` is in the Vercel env so future sweeps show live;
(2) Google Search Console → add idlookup.me → submit sitemap → watch indexing; (3) run the
HEADED sweep to scale to 50 names × 50 states; (4) when idlookup.ai DNS control lands, do the
Cloudflare path-split + re-canonical to idlookup.ai. Supersedes the Phase-0 parts of
[[project_seo_layer1_built]].
