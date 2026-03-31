# BC Deployment — Files to Upload
**Built:** 2026-03-31
**Deploy to:** https://dev.www.idlookup.ai/

---

## Upload these 5 files to the web root

All files are in the `build/` directory of the project.

| File | Size | Notes |
|------|------|-------|
| `index.html` | 494 B | **Entry point — must replace existing** |
| `public.c7a3c5f9.js` | 1.25 MB | Main app bundle (minified) |
| `public.a57ef1ae.js` | 19.8 KB | API wrapper IIFE — **was missing, must add** |
| `public.3a950c7d.css` | 153 KB | Styles |
| `idlookup_icon_transparent.613765cd.png` | 14.7 KB | Logo asset |

Do NOT upload `.map` files — they are source maps for debugging, not needed for the app to run.

---

## What to delete from the server

Remove these stale files from the previous deployment:

| File | Reason |
|------|--------|
| `public.31b563d9.js` | Old dev build — no longer referenced |
| `public.d91c94e1.css` | Old CSS — replaced by `public.3a950c7d.css` |

---

## Required nginx config change

The current nginx config returns `index.html` for missing asset files (`.js`, `.css`). This causes the app to silently fail when a file is missing. Add this block:

```nginx
# Return 404 (not index.html) for missing static assets
location ~* \.(js|css|png|jpg|ico|svg|woff|woff2|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}
```

---

## Verification steps after deploying

1. Open https://dev.www.idlookup.ai/ in a browser
2. Open DevTools → Network tab
3. Confirm these requests all return **200 OK**:
   - `index.html`
   - `public.c7a3c5f9.js`
   - `public.a57ef1ae.js`  ← this was 404 before, must now be 200
   - `public.3a950c7d.css`
   - `idlookup_icon_transparent.613765cd.png`
4. The app should load with a green nav bar and the IDLookup.AI logo visible
5. Navigating to `/login` should show the login form (not a blank page)

---

## Why the previous deployment failed

- **Wrong directory**: Files from `dist/` (dev server output) were deployed instead of `build/` (production build)
- **Missing file**: `public.a57ef1ae.js` (the ByteCrtrs API wrapper) was never uploaded
- **Stale build**: The live site was running a December 2025 dev build — 4 months out of date
- **`.env.production` not loaded**: `process.env` variables were unresolved in the bundle

The correct command to build is always: `npm run build` (not `npm start`)
Output goes to: `build/` directory (not `dist/`)
