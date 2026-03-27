# Build & Run Reference

## Local Development

### First-Time Setup

```bash
npm install
npm run install-server      # installs server/node_modules
npm run install-tracking    # installs tracking-api/node_modules
```

### Running the App

Start all three services at once:

```bash
npm run dev
```

Or individually:

```bash
npm start          # React frontend       → http://localhost:3000
npm run server     # Express mock + proxy → http://localhost:3001
npm run tracking   # Tracking API         → http://localhost:3002
```

### Accessing the Apps Locally

| App | URL |
|---|---|
| Consumer (search funnel + member dashboard) | http://localhost:3000 |
| Admin / CS | http://localhost:3000/login → auto-routes to `/admin/users` after CSR login |

> In local dev, BC API calls are proxied through the Express server at `localhost:3001/api/proxy/*` to avoid CORS. The proxy is enabled by default (`.env` has `REACT_APP_USE_API_PROXY=true`).

---

## Production Build & Deploy

### Build

```bash
npm run build
```

Parcel reads `.env` first, then `.env.production` overrides it. Output goes to `dist/`.

### Deploy

Upload the entire `dist/` folder to the web host serving `dev.www.idlookup.ai`.

**No Express server is needed in production.** The React app calls the ByteCrtrs API directly — BC handles CORS for the production domain.

### Accessing the Apps in Production

| App | URL |
|---|---|
| Consumer | https://dev.www.idlookup.ai |
| Admin / CS | https://dev.www.idlookup.ai/login → auto-routes to `/admin/users` after CSR login |

### SPA Routing Requirement

The host must serve `index.html` for all routes (catch-all redirect). Without this, direct navigation to any path other than `/` will return a 404.

---

## Key Configuration Files

| File | Purpose |
|---|---|
| `.env` | Dev defaults — proxy on, mock on, BC API URL |
| `.env.production` | Production overrides — proxy off, mock off |
| `server/index.js` | Express mock API + BC proxy (local dev only) |
| `tracking-api/index.js` | Event tracking service (local dev only) |

### `.env` (dev)

```
REACT_APP_NEW_API_ENABLED=true
REACT_APP_NEW_API_URL=https://dev1.dev.www.bytecrtrs.com/api
REACT_APP_USE_API_PROXY=true           # routes BC calls through Express proxy
REACT_APP_PROXY_URL=http://localhost:3001/api/proxy
REACT_APP_USE_MOCK_API=true            # enables mock fallback
REACT_APP_API_URL=http://localhost:3001/api/v1
REACT_APP_USE_NEW_API_SEARCH=true
```

### `.env.production`

```
REACT_APP_USE_API_PROXY=false          # call BC directly (no proxy)
REACT_APP_USE_MOCK_API=false           # no mock fallback
```

---

## Admin / CS App Notes

- Admin users must have the `csr` role in ByteCrtrs — the app maps `csr` → `role: 'admin'` at login.
- Logging in at `/login` with CSR credentials auto-redirects to `/admin/users`.
- Orders are accessed from the User Detail page (`/admin/users/:id`) — the BC API requires a `userId` to fetch orders.
- Order detail and refund are at `/admin/purchases/:orderId?userId=:userId`.

---

## Pre-Deploy Checklist

- [ ] `npm run build` completed without errors
- [ ] `dist/` uploaded to host
- [ ] Host configured with catch-all redirect to `index.html`
- [ ] BC has CORS enabled for the production domain on all required endpoints
- [ ] CSR credentials tested at `/login`
