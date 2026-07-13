# Lead-capture endpoint — deploy runbook

_Paused 2026-07-13; resume when ready. Endpoint code is committed (`75cd119`); env var + init
script committed (`1747d2e`). DB decision: **reuse the existing SEO Neon DB** (no `LEADS_DATABASE_URL`
needed — falls back to the SEO app's `DATABASE_URL`)._

Files: `seo/app/api/leads/route.js` · `seo/lib/leads-db.mjs` · `seo/db/leads-schema.sql` ·
`seo/scripts/init-leads-table.mjs` · `.env.production` (`REACT_APP_LEAD_CAPTURE_URL`).

---

## Task 1 — Create the `leads` table on the SEO Neon DB
Need the SEO app's `DATABASE_URL` (Vercel → SEO project → Settings → Environment Variables →
`DATABASE_URL`, or local `seo/.env.local`).

**CLI (uses the added script):**
```bash
cd seo
node --env-file=.env.local scripts/init-leads-table.mjs        # if seo/.env.local has DATABASE_URL
# or inline:
DATABASE_URL="postgres://…neon.tech/…?sslmode=require" node scripts/init-leads-table.mjs
```
Expect `✓ CREATE TABLE …` then `✅ leads table ready.`

**Neon Console (no CLI):** https://console.neon.tech → project → SQL Editor → paste
`seo/db/leads-schema.sql` → Run.

## Task 2 — Deploy the SEO app (so `/api/leads` is live)
Route is on `main` already.
- **Git-connected Vercel project (likely):** the push already built it. Verify at
  https://vercel.com/dashboard → SEO project → Deployments (latest = Ready, includes the leads route).
  If needed, ⋯ → Redeploy.
- **Manual (Vercel CLI):**
  ```bash
  npm i -g vercel        # once
  cd seo && vercel login # once
  vercel link            # once — pick the existing SEO project
  vercel --prod
  ```

## Task 3 — Rebuild + deploy the consumer bundle
`REACT_APP_LEAD_CAPTURE_URL=https://idlookup.me/api/leads` is baked into `.env.production`.
```bash
npm run build            # from repo root
# upload build/ to the BC VPS via the usual process
```

## Verify
```bash
curl -i -X OPTIONS https://idlookup.me/api/leads -H "Origin: https://www.idlookup.ai" | grep -i "HTTP/\|allow-origin"
curl -X POST https://idlookup.me/api/leads -H "Content-Type: application/json" \
  -d '{"email":"you+leadtest@example.com","meta":{"source":"manual_test","variant":"v11-serp"}}'
```
Neon SQL: `SELECT id, email, source, variant, received_at FROM leads ORDER BY received_at DESC LIMIT 5;`
Then walk the real flow (or `?flow=bv`), enter an email at the loader gate, confirm a row appears.

## Fill-ins / open
- Exact **Vercel SEO project name** (Task 2) + **BC VPS upload step** (Task 3) — environment-specific.
- Optional add: an **authed `GET /api/leads`** to view/export leads from a browser (not built yet).
- Dedup: currently one row per capture (keeps history); dedup at query time or add a unique index later.
- Abuse: endpoint is public; consider a light rate-limit / shared-secret header before it's a known URL.
