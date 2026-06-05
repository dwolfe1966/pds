# BC ask — CSR tracking search must scope to one user (PRIVACY)

**Raised:** 2026-06-05 · **Severity: HIGH (cross-user data exposure)**

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

We now filter the returned page client-side by `updaterId === viewedUserId` (admin bundle
after `eac6104b`), so the tabs no longer leak other users. **Limitation:** BC paginates the
`trackings` search **globally** (latest-N across all users), so a user whose events aren't in
the recent global pages shows few/none until the CSR pages back through global history. This
is correctness-safe (no leak) but makes the tabs unreliable/incomplete.

## Ask

Make `/api/database/search` on the `trackings` collection **honor `query.updaterId`** (filter
server-side), OR tell us the correct field/operator to scope a tracking search to one user
(the documented `tracking.findUser({ type, lastId })` exposes no user filter). Server-side
scoping is required for the tabs to paginate correctly and to remove the global-data round-trip.

**Reproduce:** open any CSR user detail → Logins tab → inspect the `/database/search` response;
the docs' `updaterId` won't match the viewed user.
