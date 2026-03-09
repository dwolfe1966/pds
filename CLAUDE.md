# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start frontend dev server (port 3000)
npm start

# Start mock API server (port 3001)
npm run server

# Run both concurrently
npm run dev

# Build for production
npm run build

# Install server dependencies (run once)
npm run install-server
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
