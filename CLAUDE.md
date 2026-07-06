# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Autonomous mode (launch sprint)

The owner has explicitly requested autonomous operation for the launch sprint (set 2026-05-07). Default behavior on this repo:

- **Proceed without per-step confirmation** for routine work: file edits, builds (`npm run build`), local servers, manual smoke tests, memory updates, and committing directly to `main` (no feature branch needed unless asked).
- **Still pause and confirm** before: destructive git operations (force-push, `reset --hard`, branch deletion), pushing to remote, opening PRs, posting outside the repo, adding npm dependencies (small/well-known acks in passing are fine; bigger ones surface first), or touching admin/CSR code while focused on consumer (and vice-versa).
- **Wide-open audit/cleanup tasks**: produce a tight findings report first, then start applying — don't bulk-edit before the owner has seen the scope.
- This is sprint-level; revisit after launch.

## Commands

```bash
# Start frontend dev server (port 3000)
npm start

# Start mock API server (port 3001)
npm run server

# Start tracking API (port 3002)
npm run tracking

# Run all three concurrently
npm run dev

# Build for production
npm run build

# Install server dependencies (run once each)
npm run install-server
npm run install-tracking
```

There is no test suite configured.

## Architecture Overview

This is a **React 18 + React Router v6** people-search SPA bundled with **Parcel 2**. It has a local **Express mock API server** (`server/`) for development and integrates with an external **ByteCrtrs API** via a browser-loaded IIFE library (`public/libs/api-wrapper/index.iife.js`).

### Three-tier routing (all in `src/App.js`)
- **Sales/public** — unauthenticated routes for landing pages, search funnels, signup, and legal pages
- **Member** — protected routes under `/dashboard`, `/profile`, `/people-search`, etc. (requires JWT token)
- **Admin** — protected routes under `/admin/*` (requires `role === 'admin'`)

Route protection is handled by `src/pages/ProtectedRoute.js`, which reads from `AuthContext`.

### Auth flow (`src/context/AuthContext.js`)
JWT tokens are stored in `localStorage` (`accessToken`, `refreshToken`, `user`). `AuthContext` exposes `{ user, token, loading, login, logout }`. The token is injected into all API calls via `setTokenGetter`.

### Hybrid API routing (`src/services/apiRouter.js`)
All API calls go through `src/api.js` → `routeApiRequest()` in `apiRouter.js`, which routes to one of two backends:

1. **ByteCrtrs new API** — uses `window.ApiWrapper` (IIFE loaded in `public/index.html`). Enabled per-endpoint via `.env` feature flags (`REACT_APP_USE_NEW_API_SEARCH`, etc.). Proxied through the Express server at `/api/proxy` to avoid CORS in development.
2. **Mock API** — local Express server at `http://localhost:3001/api/v1`. In-memory data store seeded from `server/seed.js` on startup.

Key env vars in `.env`:
- `REACT_APP_NEW_API_ENABLED` — master toggle for ByteCrtrs API
- `REACT_APP_USE_NEW_API_SEARCH` / `_REPORTS` / `_OPTOUT` / `_AUTH` — per-endpoint feature flags
- `REACT_APP_USE_MOCK_API` — enable/disable mock fallback
- `REACT_APP_API_URL` — mock API base URL (default: `http://localhost:3001/api/v1`)
- `REACT_APP_NEW_API_URL` — ByteCrtrs API base URL

Certain endpoints (`create-report`, `get-report`, `report-list`, `opt-out-search`, `commerce-billing-sale`) always force the new API and never fall back to mock.

### Page structure
- `src/pages/sales/` — public-facing search funnels: name/phone/email landing → loader → results → signup/payment
- `src/pages/member/` — authenticated member dashboard, search, profile, alerts, account
- `src/pages/admin/` — admin-only management pages
- `src/components/` — shared components (`Header`, `Footer`, `MemberNav`, `AdminNav`, `SalesNav`, `ResultCard`, `ProfileVCard`, `Modal`, `NotificationBell`)

### Design system
`src/styles/designSystem.js` exports JS token objects (colors, typography, spacing, etc.) for use in inline styles. Global CSS variables live in `src/styles/variables.css`. CSS Modules are used for component-scoped styles (e.g., `Header.module.css`).

### Mock server
`server/index.js` is a standalone Express app with its own `node_modules` (install separately via `npm run install-server`). It uses an in-memory data store seeded from `server/seed.js`. Auth uses `jsonwebtoken` via `server/middleware/auth.js`.

### Tracking API — ⚠️ DEPRECATED (not in the production path, 2026-07)
`tracking-api/index.js` is a standalone Express service (port 3002). **It is NOT used in production**: the consumer client only posts to it when `REACT_APP_TRACKING_API_URL` is set, which is **commented out in `.env.production`**. Real analytics go to **BC** (`createTracking`) + **GA4/GTM dataLayer** (the live conversion tracking). The client's dev auto-fallback to `:3002` was removed (`src/services/trackingService.js`), so local dev no longer errors on it.

Note: despite older docs, storage is now **SQLite via `better-sqlite3`** (a NATIVE module) — so it **won't start on newer Node** (Node 26 → `ERR_DLOPEN_FAILED`). Kept only for the optional Admin Analytics page; delete once that's retired or repointed at BC/GA4.
