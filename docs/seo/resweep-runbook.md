# idlookup.me re-sweep runbook (post-IDI-unblock)

_2026-07-13. IDI returned NO results 2026-07-08→07-12 (account blocked). Re-sweep to capture
valid common-name profile data now that it's live, and redeploy so the directory regenerates on
the new common-name gate (`seo/lib/directory.js`, commit `16f5799`)._

**Two independent pieces:**
1. **Directory (`/people/*`) = gate-computed, DB-free** → it regenerates on a **redeploy** (no sweep).
2. **Profiles (`/profiles/*`) = real captured data** → that's what the **sweep** populates.

---

## Step 0 — confirm the account is live
Run one search on prod (you, past Turnstile): a common name should return records, e.g.
`https://www.idlookup.ai/name/search-result?firstName=Michael&lastName=Smith&state=CA` → 30+.

## Step 1 — outage-window sweep_log — ALREADY CLEARED 2026-07-13 (was empty). Skip.
(For reference, the safe reset is `DELETE FROM sweep_log WHERE swept_at >= '2026-07-08' AND swept_at < '2026-07-13';`)

## Step 2 — run the sweep, HEADED, from pds/seo (run it on YOUR machine — residential IP
passes Turnstile; a datacenter/CI box gets challenged on the teaser API). One-time setup:
```bash
cd /path/to/pds/seo
npm install                      # if deps not installed
npx playwright install chromium  # the browser binary
grep DATABASE_URL .env.local     # confirm the Neon string is present
```
Test batch first (a browser window opens — click any Cloudflare "Verify you are human" box):
```bash
HEADED=1 node --env-file=.env.local scripts/sweep-profiles.mjs --names 3 --states CA,TX
```
Then the full run (name-pairs.ndjson is ranked common-first, so --names N = top-N most common × 50 states):
```bash
HEADED=1 node --env-file=.env.local scripts/sweep-profiles.mjs --names 200
```
- **Resumable** (skips done combos) and slow-paced (~4.5s/call). ~200×50 ≈ several hours; run in sittings.
- Scale later (`--names 500`); narrow while testing (`--states CA,TX,NY`).
- Quick count check: `node --env-file=.env.local -e 'import("./lib/db.mjs").then(m=>m.dbCount().then(n=>console.log("profiles:",n)))'`

## Step 3 — redeploy the SEO app (regenerates `/people` on the new common-name gate)
Git-connected Vercel project → the gate commit already builds; verify at
https://vercel.com/dashboard → SEO project → Deployments (Ready, includes `16f5799`/`5b4dd0b`).
Manual: `cd seo && vercel --prod`.

## Verify
- Neon: `SELECT count(*) FROM profiles;` grows as the sweep runs (was ~619).
- A common-name profile page shows real captured data.
- A city page (`/people/ca/los-angeles`) lists common names with "Most common names" as the #2 card.

## Then
Back to the **lead-endpoint deploy** — `docs/design/lead-endpoint-deploy-runbook.md`.
