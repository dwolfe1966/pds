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

## 2. Intermittent **403 on `/message/admin/findNotes`** (+ 404 on `:userId`) — session/auth race?

Observed live 2026-06-04 on the CSR tool: on **cold page loads**, CSR-protected reads
**intermittently return 403** before settling — e.g. `GET /api/message/admin/findNotes → 403`,
then `200` on retry. Consistently, `POST /api/contactMessage/admin/find/:userId` (per-user
contacts) returns **404**.

Why it matters: a transient 403 on `findNotes` makes a customer's notes briefly vanish from the
CSR tool — the likely cause of the QA "saved a note but don't see it in the profile" report
(QA row 38). We've hardened our client (a failed fetch now shows "Couldn't load notes — Retry"
instead of a false "no notes"), but the underlying 403 is BC-side.

**Questions for the CTO/dev:**
- Is the CSR session/auth gate **racing on cold load** (request fires before the session cookie
  is validated)? Same intermittent-403 signature shows on `/api/database/search` and may relate
  to the "Register Member worked before, not today" report (row 4).
- Is `POST /contactMessage/admin/find/:userId` a **dead endpoint** (always 404) that should be
  fixed or formally retired? We already fall back to the inbox-wide
  `GET /api/contactMessage/admin/find` + client filter.

*(For the record: when the session is warm, notes work end-to-end — `createNote` 201,
`findNotes` returns the note, renders after save and reload. The bug is the cold-load 403, not
note creation.)*
