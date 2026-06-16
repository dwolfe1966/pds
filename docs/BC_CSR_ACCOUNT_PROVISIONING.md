# BC ask — CSR account provisioning (login works, data calls 403)

**Filed:** 2026-06-16 · **From:** PDS / idlookup (integration) · **For:** BC CTO + dev
**Status:** OPEN — blocks CSR app usage for the accounts we've been given.

## Summary

We need the CSR/admin app to work for **multiple CSR logins** at launch. Testing the
account we were handed — `frontend@csrManager.pds` — surfaced two issues. We fixed the
one on our side; the remaining one is BC-side account provisioning.

## What we verified live (2026-06-16)

Probed the deployed admin host `dev.admin.www.bytecrtrs.com` with the given creds
(`scripts/probe-csr-login-response.js`):

1. **Login succeeds.** `POST /api/auth/login` → **201**. BC returns:
   ```json
   {
     "email": "frontend@csrManager.pds",
     "roles": ["csrManager"],
     "brandId": "bytecrtrs",
     "permissions": [{ "name": "frontend", "desc": "Frontend dev's",
       "targets": [ {allow /api/shape/management/search},
                    {allow /api/shape/management/update},
                    {block shape container/collection search},
                    {block shape container/collection update} ] }]
   }
   ```

2. **CSR data calls 403.** Same authenticated session, the call the Customers list makes:
   ```
   POST /api/database/search  { brandId, collectionName: "users", query: {} }
   → 403 { "message": "Forbidden resource", "error": "Forbidden", "statusCode": 403 }
   ```

## Our side — FIXED (no BC action needed)

Our role mapping only promoted exact `'csr'`/`'admin'` role strings; `'csrManager'` fell
through to `'member'` and the app's `role === 'admin'` gates denied login. Fixed in
`src/services/apiRouter.js` to recognize any `admin*`/`csr*` role (+ optional
`REACT_APP_ADMIN_ROLES` env list). Ships in the next build-admin upload.

## BC ask

The `frontend@csrManager.pds` permission set is **"Frontend dev's"** — scoped to
`/api/shape/management/*` and explicitly **blocking** shape container/collection search.
That is not a CSR permission profile, so the account 403s on the CSR data collections
(`users`, `commerceMgmt/*`, optOut, contact, tracking, etc.).

Please clarify / provide **one** of:

1. **A correctly-provisioned CSR account** (or the right permission set attached to the
   accounts we'll use) that can call `POST /api/database/search` for `users` and the
   `commerceMgmt/*` endpoints the CSR app needs — OR
2. **The canonical CSR role + permission template** BC issues for real CSR staff, so we
   can confirm what role string(s) and permission `targets` to expect for the "multiple
   CSR logins" at launch (we currently only recognize `admin*`/`csr*` role names).

**Question:** Is `frontend@csrManager.pds` intended to be a CSR login at all, or a dev
account that happened to be created under the `csrManager` role? If real CSR accounts use
a different role string than `csrManager`, tell us the value(s) so the allow-list is right.

## Endpoints the CSR app must reach (for the permission grant)

- `POST /api/database/search` — collections: `users`, `optOutRequest`, `userContact`, `managedContact`, tracking
- `POST /api/user/management/detail | update | create`
- `POST /api/commerceMgmt/userOrders | getUserOrder | orderPayments | orderHistories | cancelUncancelOrder | updateScheduleDueTimestamp`
- `POST /api/commerceBilling/correct` (refund/void)
- `GET/POST /api/contactMessage/admin/*` and `/api/message/admin/*` (tickets, notes, replies)
