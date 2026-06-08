# BC ask — CSR tracking search must scope to one user (PRIVACY)

**Raised:** 2026-06-05 · **Severity: HIGH (cross-user data exposure)** · **STILL OPEN**

> **⚠️ RE-VERIFIED 2026-06-08 — docs ahead of backend.** BC's csrApi docs were updated
> 2026-06-08 to add `updaterId` to `tracking.findUser`. We re-tested live the same day
> (`scripts/verify-bc-csr-params.js`): POSTing `{collectionName:'trackings', query:{'data.type':
> 'USER:login', updaterId:'6a11ea7d…'}}` STILL returns 100 docs with **mixed** updaterIds
> (`6943179e…`, `6a23298b…`, `6a11ea7d…`) — i.e. `updaterId` is **not honored server-side**.
> So the param is documented but the backend filter isn't implemented. We are KEEPING our
> client-side scope filter (removing it would leak other users' events). **Ask BC to actually
> implement server-side `updaterId` filtering on the `trackings` collection** — documenting
> the param is not enough.

## Problem (verified live)

The CSR user-detail **Searches / Reports / Logins** tabs show **other users' activity**, not
the viewed user's. Verified live 2026-06-05 against `dev.admin.www.bytecrtrs.com`:

- We POST `/api/database/search` with `{ collectionName: 'trackings', query: { "data.type":
  "USER:login", "updaterId": "<viewedUserId>" } }`.
- **BC ignores `query.updaterId`** and returns the latest events across **all** users:
  - Logins for viewed user `6a2060a7…` → 10 docs, **all** belonging to a *different* user
    (`6943179e…`).
  - Searches → 10 docs spanning **5 distinct `updaterId`s**.
- `updaterId` **is** present and correct on each returned doc — only the **query filter** is
  not applied.

## Stopgap shipped on our side

1. We filter the returned page client-side by `updaterId === viewedUserId` so the tabs no
   longer leak other users.
2. The default page was capped at **10** docs (global, across all users), which buried most
   users' events — a user with reports on their dashboard showed **none** on their CSR detail.
   We now request **`perPage: 100`** on the trackings search (verified honored — `limit`/`size`/
   `pageSize` are NOT), so the per-user filter actually has the user's events to surface.

**Limitation:** still global pagination — at production scale (>perPage recent events across all
users) a user whose events fall beyond the fetched page(s) will still under-show. Correctness-safe
(no leak), but only server-side scoping fully fixes it.

## Related finding — CSR user-search by email

Exact `query.email` match for a known address returned **0** docs (the field filter IS honored),
and the `users` collection ignores `perPage` (caps at 10). So locating a user by exact email can
fail/fall back to the default list. Please confirm the supported user-search query shape
(exact vs partial; is the email on `email` or an `emails[]` array; cross-brand visibility?).

## Ask

Make `/api/database/search` on the `trackings` collection **honor `query.updaterId`** (filter
server-side), OR tell us the correct field/operator to scope a tracking search to one user
(the documented `tracking.findUser({ type, lastId })` exposes no user filter). Server-side
scoping is required for the tabs to paginate correctly and to remove the global-data round-trip.

**Reproduce:** open any CSR user detail → Logins tab → inspect the `/database/search` response;
the docs' `updaterId` won't match the viewed user.
