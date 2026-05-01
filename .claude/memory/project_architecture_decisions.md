---
name: Architecture Decisions
description: Finalized architectural decisions for tracking, email, and deployment
type: project
---

# Architecture Decisions (2026-03-18)

## Tracking Platform
Custom standalone tracking API — independently deployable from the React SPA.
- Separate directory: `tracking-api/`
- Express + relational DB (SQLite for dev, swap to Postgres for prod)
- Endpoints: POST /track (public), GET /events and GET /events/summary (admin-keyed)
- React client calls it via `REACT_APP_TRACKING_API_URL` env var in `trackingService.js`
- CORS configured for the SPA domain
- **Why:** Avoids /server dependency in production; owned infrastructure; simple to scale independently
- **How to apply:** All new tracking instrumentation must target the tracking API, not /server. Remove event endpoints from server/index.js once tracking-api is live.

## Email Service
Will be a separate independent API callable by the client app or ByteCrtrs API directly.
- **DEFERRED** — no work this sprint
- Do not extend server/emailService.js or add new email features until this is scoped
- **Why:** Keeps email infra decoupled from both the SPA and the mock server

## Deployment / Release Process
- **DEFERRED** — no formal CI/CD pipeline this sprint
- Assume the SPA deploys as static assets (Netlify/Vercel/S3 style)
- No server-side rendering, no Express in production for the client app
- **How to apply:** Any feature that requires server-side logic must live in tracking-api, email-api, or ByteCrtrs — not in /server

## Next Sprint After Current
After this sprint: pivot to user transitions — validate all key visitor→member→paid flow transitions are functional end-to-end.
