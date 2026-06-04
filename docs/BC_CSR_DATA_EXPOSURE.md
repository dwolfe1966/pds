# BC ask — Expose CSR-tool data that's stored-but-not-returned

**Raised:** 2026-06-04
**From:** PDS / idlookup CSR-tool QA
**Theme:** same as the CTO list items #5 (BIN/card) and #11 (street) — *"the data exists,
just return/persist it."* These two are smaller and CSR-tool-scoped.

## 1. Add `zip` / `last4cc` / `phone` to the CSR user-**search** projection (primary ask)

Verified live 2026-06-04 against `dev.admin.www.bytecrtrs.com` (bundle `ce2e8005`):

The CSR user object comes back **without** `zip`, `last4cc`, or `phone` on **both**
endpoints:
- `POST /api/database/search` (csr `user.find`) — doc keys are `_id, uniqueId, status,
  brandId, shConId, shColId, email, firstName, lastName, roles, createdAt, …` only.
- `POST /api/user/management/detail` (`getUserDetail`) — same; `'zip' in user` is **false**.

Yet the **advanced search filters by these fields server-side and works** (zip/phone/last4
queries return correct results). So BC indexes/filters on them but doesn't include them in
the response `displayFields`.

**Impact:** the CSR Users-list **Zip** and **CC** columns render `"—"` for every customer,
and per-user ZIP/phone can't be shown on the profile without joining to orders.

**Ask:** add `zip`, `last4cc` (or `bin`+`last4`), and `phone` to the `displayFields` BC
returns for the CSR user search (`/api/database/search`) and `getUserDetail`. If these live
only on the billing token (not the user), say so — we'll source them from orders instead
(we already do this for ZIP on the detail page as a stopgap:
`commercePayments[].commerceToken.billingAddress.zip`).

> Note: this overlaps the CTO list's **#5 (persist BIN/card intelligence)** and **#11 (street
> address)** — same root pattern (data is captured/filterable but not surfaced). Worth solving
> together: define the canonical billing/identity fields the CSR tool can read per user/order.

## 2. FYI / low-priority cleanup — `contactMessage/admin/find/:userId` 404s

`POST /api/contactMessage/admin/find/:userId` (per-user contacts / `findUserContacts`)
returns **404** consistently. We've worked around it (notes display via
`GET /message/admin/findNotes`, which works; per-user messages via the inbox-wide
`GET /api/contactMessage/admin/find` + client-side filter). **No launch impact** — flagging
so the dead per-user endpoint can be fixed or formally retired.

## Not an ask — for the record
- **Admin notes work end-to-end** (`POST /message/admin/createNote` → 201;
  `GET /message/admin/findNotes` returns the note; renders after save and reload). The earlier
  "saved note not visible" QA finding was a stale-bundle artifact, now resolved on `ce2e8005`.
