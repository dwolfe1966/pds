# BC ask — Add SPA catch-all rewrite for the admin app under `/csr/`

> **STATUS: RESOLVED live 2026-06-02 — ARCHIVED 2026-06-08.** `/csr/*` deep-links now
> serve the SPA shell (verified 200 on `/csr/login`, `/csr/users`, `/csr/tickets`).
> Host catch-all is working. Kept for history.

**Raised:** 2026-06-01
**Bug ref:** Bugs.csv rows **#61 / #62** (CSR — "Direct deep-links don't work (SPA refresh)")
**Environment:** `https://dev.admin.www.bytecrtrs.com/csr/` (also `dev.gwhubadmin.www.bytecrtrs.com/csr/`)
**Surface:** the admin/CSR React app you serve under `/csr/`. It's a single-page app using React Router with `basename="/csr"`.

## Copy-paste summary

> The CSR admin app loads fine when you land on `https://dev.admin.www.bytecrtrs.com/csr/`
> and navigate around. But **any direct hit or browser refresh on a sub-route
> returns a 404** from the host — the app never gets a chance to render. This
> blocks bookmarking CSR pages, refreshing the page you're on, and the
> `?contactMessageId=` deep-link we send CSRs into the tickets view.
>
> It's a single-page app: the server needs to serve `/csr/index.html` for any
> path under `/csr/` that isn't a real file, and let the client-side router take
> over. Right now only the exact `/csr/` path resolves.
>
> **Requested nginx change:**
>
> ```nginx
> location /csr/ {
>     try_files $uri $uri/ /csr/index.html;
> }
> ```
>
> (Keep the existing static-asset handling — real files like
> `/csr/admin.<hash>.js` and `/csr/admin.<hash>.css` already 200 correctly and
> should continue to be served directly. This rule only changes the behavior for
> paths that don't map to a file on disk.)

## Evidence (curl against the live host, 2026-06-01)

| URL | Current result | Expected after fix |
|---|---|---|
| `GET /csr/` | ✅ 200 (serves the app) | 200 |
| `GET /csr/index.html` | ✅ 200 | 200 |
| `GET /csr/admin.93d93b68.js` | ✅ 200 (real file) | 200 (unchanged) |
| `GET /csr/admin.de3592b0.css` | ✅ 200 (real file) | 200 (unchanged) |
| `GET /csr/login` | ❌ **404** | 200 (serves index.html) |
| `GET /csr/users` | ❌ **404** | 200 (serves index.html) |
| `GET /csr/tickets` | ❌ **404** | 200 (serves index.html) |

All the 404s return a 146-byte generic nginx "Not Found" page, not our app shell —
confirming the request never reaches the SPA.

## Why we can't fully fix this client-side

This is a server-rewrite concern: the host decides what to return for
`/csr/<path>` *before* any JavaScript runs, so our React Router can't intercept a
cold load or refresh. The only client-side alternative is switching to a
hash-based router (URLs become `/csr/#/users`), which we'd prefer to avoid since
it makes the URLs uglier and changes the `?contactMessageId=` deep-link format.
The one-line nginx rule above is the clean fix and matches the same SPA
requirement already documented for the consumer app in `docs/BC_DEPLOY_NOW.md`.

## Affected routes (all of these 404 on direct load / refresh today)

`/csr/login`, `/csr/my-dashboard`, `/csr/users`, `/csr/users/:id`, `/csr/orders`,
`/csr/purchases`, `/csr/purchases/:id`, `/csr/data-removal`, `/csr/unsubscribe`,
`/csr/notes`, `/csr/tickets`, `/csr/mail-log`, `/csr/cs-reps`, `/csr/analytics`,
`/csr/permissions`, `/csr/content`, `/csr/offers`, `/csr/sessions`,
`/csr/payments`, `/csr/phone-optout`, `/csr/email-search`, `/csr/timesheets`,
`/csr/logs`, `/csr/ux`, `/csr/uxc-history`.
