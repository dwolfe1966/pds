---
name: Local production-bundle test setup
description: How to serve build/ on localhost with /api proxied to BC dev (dev.www.idlookup.ai) for end-to-end manual testing of the prod bundle. Confirmed working 2026-05-06.
type: reference
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
---
The production bundle is built from `.env.production` which uses `REACT_APP_NEW_API_URL=/api` (relative) and `REACT_APP_USE_MOCK_API=false`. Running it on plain localhost would 404 every API call. Solution: serve `build/` locally with a tiny zero-dep Node proxy that forwards `/api/*` to a BC dev host server-side.

## How to run — consumer

```bash
npm run build
node scripts/serve-prod.js          # listens on :3000, proxies /api → dev.www.idlookup.ai
# Override the upstream:  BC_HOST=other.dev.host node scripts/serve-prod.js
# Override the port:      PORT=3030 node scripts/serve-prod.js
```

Then open http://localhost:3000.

## How to run — admin / CSR

```bash
npm run build:admin
node scripts/serve-admin-prod.js    # listens on :3004, proxies /api + /libs → dev.admin.www.bytecrtrs.com
# Override:  BC_HOST=dev.gwhubadmin.www.bytecrtrs.com node scripts/serve-admin-prod.js
```

Then open http://localhost:3004 (auto-redirects to `/csr/`).

The admin script differs from the consumer one because the prod admin bundle is built with `--public-url /csr/` and BC serves the IIFE wrappers (api-wrapper *and* csr-wrapper) at the domain root — both `/api/*` and `/libs/*` are proxied upstream while `build-admin/*` is served from disk under the `/csr/` mount.

## What it does

`scripts/serve-prod.js` is a single-file zero-dep Node http server that:
- Listens on `PORT` (default 3000)
- Forwards `/api/*` (and exactly `/api`) to `https://${BC_HOST}` via `https.request`, default `dev.www.idlookup.ai`
- Strips `Domain=...` and `Secure` from `Set-Cookie` so BC session cookies stick on localhost (otherwise the browser would drop them)
- Strips `accept-encoding` from outgoing requests so we don't have to handle gzip
- Streams request and response bodies via pipes — works for any method
- Serves everything else from `build/` with extension-based MIME types
- Falls back to `build/index.html` for unknown paths (SPA routing)
- Has a path-traversal guard

## Confirmed working (2026-05-06)

```
GET / → 200                    (index.html)
GET /people-search → 200       (SPA fallback)
POST /api/auth/login → 400     (proxied — 400 = real BC response on empty body)
```

Browser test of full purchase flow on localhost:3000 against BC dev passed. Same-origin from the browser's POV (no CORS), cookies persist, IIFE loads from `build/libs/api-wrapper/index.iife.js`.

## When this is the right tool

- Sanity-checking the actual production bundle (minified, optimized) before deploying.
- End-to-end testing of BC-routed flows (login, search, billing.sale, getUserOrders, createReport) against BC dev without needing a deploy.
- Reproducing prod-mode bugs that don't appear in `npm run dev`.

For dev-loop work, prefer `npm run dev` (Parcel dev server + local mock API + tracking API).
