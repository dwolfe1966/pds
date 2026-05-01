---
name: Production deployment architecture
description: In production this app may deploy as a pure React SPA talking only to ByteCrtrs API — the /server directory may not exist
type: project
---

The `/server` directory is a **development mock only**. In production the app may be deployed as a static React SPA that communicates exclusively with the ByteCrtrs API. No Express server, no mock endpoints, no server-side email service.

**Why:** ByteCrtrs provides the backend. The Express server exists solely to unblock frontend development before the real API is fully integrated.

**How to apply when making suggestions:**
- Do not design features that depend on `/server` being present in production
- Any feature that needs server-side logic (email delivery, scheduled jobs, event persistence, auth) must be designed with a production-safe path:
  - ByteCrtrs API may handle it natively (e.g., transactional emails on signup/payment)
  - A lightweight serverless function (Lambda, Vercel Edge, Netlify Function) can be the production home for anything server-side
  - Third-party client-safe SDKs (e.g., Resend, EmailJS) can handle email from the browser if keys are scoped appropriately
- Feature flags (`REACT_APP_USE_NEW_API_*`) already gate which backend is used per-endpoint — this is the intended swap mechanism
- The pluggable email provider pattern in `server/providers/` is good for dev/staging but is NOT the production email solution

**Production email options to evaluate when the time comes:**
1. ByteCrtrs sends transactional emails automatically (signup confirmation, payment receipt) — check their API docs
2. Serverless function (same domain, no CORS) wrapping SendGrid/SES — minimal surface area
3. Client-side email SDK with restricted publishable key (Resend, EmailJS) — no backend needed
