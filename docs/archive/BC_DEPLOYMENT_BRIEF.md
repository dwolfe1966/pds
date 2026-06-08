# Deployment Brief for ByteCrtrs

> **STATUS: OBSOLETE — ARCHIVED 2026-06-08.** Describes a Dec-2025 dev build being
> live in March 2026. Long resolved — current bundles deploy routinely and were
> re-verified live this session. Kept for history.
**App:** IDLookup.AI
**Live URL:** https://dev.www.idlookup.ai/
**Date:** 2026-03-31

---

## Current Problem

The live site is running a **development build from December 2, 2025** — 4 months out of date. This was diagnosed by fetching the live `index.html` and inspecting the JS bundle.

Evidence:
- Live `Last-Modified` headers on all assets: `Tue, 02 Dec 2025`
- Live bundle contains React HMR/hot-reload code (dev-only)
- Live bundle does NOT contain the ByteCrtrs API integration (`ApiWrapper`, `routeApiRequest`) — all API calls fail silently
- The API wrapper IIFE file (`/public.fff7644d.js`) is **missing from the server entirely** — returns `index.html` instead of the script
- `process.env` variables were never resolved in the live bundle (`.env.production` was not loaded at build time)

**Result:** The app loads a blank React shell. Every data fetch fails because `/api/v1/*` routes return `index.html`.

---

## Root Cause

The wrong directory was deployed. There are two directories:

| Directory | Purpose | Deploy? |
|-----------|---------|---------|
| `dist/` | Output of the **dev server** (`npm start`) — dev build, unminified, contains HMR code | **NO** |
| `build/` | Output of the **production build** (`npm run build`) — minified, optimized, env vars resolved | **YES** |

The live server received files from `dist/` instead of `build/`.

---

## Correct Build & Deploy Steps

### Step 1 — Ensure the production env file is present

The file `.env.production` must exist in the project root (same directory as `package.json`).
It is already committed to the repository. Verify it exists:

```bash
ls .env.production
```

Contents should include:
```
REACT_APP_NEW_API_ENABLED=true
REACT_APP_USE_API_PROXY=false
REACT_APP_USE_MOCK_API=false
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Run the production build

```bash
npm run build
```

This command:
- Sets `NODE_ENV=production` automatically
- Loads `.env.production` automatically (Parcel 2 behavior)
- Resolves all `process.env.REACT_APP_*` variables into the bundle
- Minifies and optimizes all JS/CSS
- Outputs ALL files to the `build/` directory

**Do NOT run `npm start` for deployment.** `npm start` is the dev server — it writes to `dist/` and includes debug/HMR code.

### Step 4 — Deploy the `build/` directory

Upload/copy ALL contents of the `build/` directory to the nginx web root. Do not deploy selectively — every file in `build/` is required.

After a successful build, `build/` will contain files like:
```
index.html                              ← MUST be deployed (this is the entry point)
public.XXXXXXXX.js                      ← Main React app bundle
public.XXXXXXXX.js.map                  ← Source map (optional, can omit)
public.YYYYYYYY.js                      ← API wrapper IIFE (REQUIRED — was missing)
public.ZZZZZZZZ.css                     ← Styles
*.png                                   ← Logo/image assets
```

**Every file with a hashed filename is referenced by `index.html` and must be present.**

### Step 5 — Verify the nginx configuration

The nginx config must:
1. Serve static files from the `build/` directory
2. Fall back to `index.html` for unknown routes (React Router SPA)
3. **NOT** fall back to `index.html` for missing asset files (`.js`, `.css`, `.png`)

**Correct nginx config:**

```nginx
server {
    listen 80;
    server_name dev.www.idlookup.ai;
    root /path/to/build;   # ← point to build/ output directory

    # SPA routing: unknown paths serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets: return 404 (not index.html) if file is missing
    # This ensures missing JS/CSS files fail loudly, not silently
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
```

**Why this matters:** With the current config, a missing `.js` file (like the api-wrapper IIFE) returns `index.html` with a 200 status. The browser tries to execute `index.html` as JavaScript and fails silently. The `try_files $uri =404` line for assets ensures missing files return a proper 404 so the problem is visible.

---

## Verification Checklist

After deploying, verify the following in a browser:

| Check | How to verify |
|-------|--------------|
| ✅ New build deployed | Open DevTools → Network tab → click `index.html` → Headers → `Last-Modified` should be today's date |
| ✅ API wrapper loaded | Network tab → filter by `.js` → look for `public.*.js` with ~46KB size (the IIFE) — should return 200 |
| ✅ Correct index.html | View source → should contain `<script src="/public.fff7644d.js">` (or new hash) AND `<script src="https://cdn.jsdelivr.net/npm/axios...">` |
| ✅ No `[object Object]` in img src | Logo should display in header/footer |
| ✅ API calls working | Open DevTools → Network tab → navigate to home page → should NOT see `/api/v1/*` requests returning HTML |
| ✅ ENV vars resolved | In browser console: `window.location` — there should be no `process.env` references visible in page source |

---

## What the Correct `index.html` Should Look Like

After `npm run build`, `build/index.html` will look like:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script type="importmap">{"imports":{"au2DX":"/idlookup_icon_transparent.HASH.png"}}</script>
  <link rel="stylesheet" href="/public.HASH.css">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IDLookup.AI</title>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.13.2/dist/axios.min.js"></script>
  <script src="/public.HASH.js"></script>   <!-- api-wrapper IIFE -->
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/public.HASH.js"></script>   <!-- React app -->
</body>
</html>
```

The currently live `index.html` is missing the `axios` CDN script and the api-wrapper IIFE script entirely.

---

## Summary

| Issue | Fix |
|-------|-----|
| 4-month-old build | Run `npm run build` and deploy fresh output |
| Wrong directory deployed (`dist/` not `build/`) | Deploy from `build/` directory only |
| Missing api-wrapper IIFE on server | Included in `build/` after fresh build |
| `process.env` not resolved (no `.env.production`) | `npm run build` loads `.env.production` automatically |
| Missing assets return `index.html` not 404 | Update nginx `location` block for asset extensions |
