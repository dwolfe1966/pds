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

## Step 1 — (safe insurance) clear any outage-window sweep_log rows
So combos that (edge case) returned `TooManyMatches` *during* the block re-verify. No-op if nothing
was swept in that window. In the Neon SQL Editor (SEO project DB):
```sql
DELETE FROM sweep_log WHERE swept_at >= '2026-07-08' AND swept_at < '2026-07-13';
```

## Step 2 — run the sweep, HEADED (you solve Turnstile if it appears)
`name-pairs.ndjson` is ranked common-first, so `--names N` = the top N most common names × 50 states.
Resumable (skips combos already done) and slow-paced (~4.5s/call) to keep Turnstile passing.
```bash
cd seo
DATABASE_URL="postgres://…neon.tech/…" HEADED=1 node scripts/sweep-profiles.mjs --names 200
```
- ~200 names × 50 states ≈ 10,000 combos ≈ several hours — it's **resumable**, so run in sittings;
  re-running continues where it left off.
- Scale up later (`--names 500`, etc.) once this batch looks good.
- Narrow while testing: `--states CA,TX,NY --names 50` for a quick pass.

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
