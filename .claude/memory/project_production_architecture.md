---
name: Production deployment architecture
description: Static React assets from /build and /build-admin are MANUALLY uploaded to a BC-managed VPS. No Vercel, no automated pipeline. The /server directory is dev-only.
type: project
originSessionId: c440a532-76cb-478f-b386-94d3d358bd6c
---
**Deployment is manual upload of static assets to a VPS that ByteCrtrs (BC) manages.** Owner copies `build/` (consumer SPA) and `build-admin/` (admin SPA) onto the VPS by hand. There is **no Vercel**, no GitHub Actions, no automated deploy pipeline, and `vercel.json` is irrelevant to the actual production hosting.

**Why this matters when troubleshooting:**
- Don't propose Vercel-specific config (rewrites, headers, env vars in dashboard) — it isn't there.
- Any host-level routing (`/api/*` proxy, redirects, headers) is configured by BC on their VPS — out of our control unless we ask them.
- Bundle hashes change per build — if the deployed asset still has an old hash after a "redeploy," the upload didn't actually replace the file on the VPS. Suspect either a stale upload or BC's VPS still serving cached assets.
- The `/server` directory is **development mock only** and never ships to production.

**How to apply:**
- Build via `npm run build` (consumer) and `npm run build:admin` (admin) — both output to gitignored dirs (`build/`, `build-admin/`).
- Owner uploads the resulting files to BC's VPS manually.
- BC's VPS handles host-level routing (presumably nginx/Apache with `/api/*` reverse-proxied to BC's actual API). Treat that as a black box; if a route isn't working, ask BC to wire it up rather than building infra on our end.
- Server-side concerns (email delivery, /api proxy, CORS allowlist) are BC's responsibility on their VPS, not ours in the bundle.

**Bundle config:**
- `.env.production` keeps `REACT_APP_NEW_API_URL=/api` (relative). The bundle calls same-origin `/api/*` and BC's VPS handles forwarding to the BC API host. Absolute URLs in the bundle re-introduce CORS dependencies that BC has historically not configured.
