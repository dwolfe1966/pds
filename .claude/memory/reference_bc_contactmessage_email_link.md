---
name: reference_bc_contactmessage_email_link
description: "BC consumer contact messages link to a member by sender EMAIL, not targetUserId — per-user endpoint 404s on them"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7cf476e3-95d5-4760-901e-3e85bff7c6de
---

Consumer contact-form messages (contactMessage docs, `type:'contact'`) link to a
member **only by sender email** — they carry NO `targetUserId` and NO `owner` id.
Verified live 2026-06-09 (`scripts/verify-bc-csr-params.js` sibling
`scripts/verify-bc-usercontact-link.js`): inbox docs expose `content.input.email`
only; `targetUserId`/`owner` are null.

Consequence: BC's per-user endpoint `POST /contactMessage/admin/find/:userId`
filters by `targetUserId`, so it returns **404 / 0 docs** for these — proven for
member `mctest1@test.com` (uid `6a28369c20dfea8ea1c0d4e4`): per-user endpoint = 0,
email loose-match over the inbox = 2. That's why consumer→CSR messages showed on
the **general inbox** (`GET /contactMessage/admin/find`) but were MISSING from the
**CSR user-detail Notes & Messages tab**.

Fix (commit on 2026-06-09, admin bundle `0693f646`): `csrFindUserContactMessages`
now ALWAYS runs the email loose-match (`userId === targetUserId` OR
`senderEmail === userEmail`) and merges it with the targetUserId REST path, deduped
by `_id` — not only on a 404 like before. UserDetailPage already passes
`userEmail: user?.email`. Caps: BC has NO server-side email filter on /contactMessage/admin/find (takes only
`{lastId}`), so the email match must PAGE the inbox. Fixed 2026-06-10: the scan was
only reading page 1, so a member's older tickets (e.g. a May 27 ticket viewed in June,
on inbox page 2/3) never matched on their user-detail page. Now pages bounded (40,
early-stops on noMoreDocs). Also fixed a race in UserDetailPage.fetchUserTickets (ran
twice — mount w/o email, then with email; stale empty run could clobber results →
request-token guard) and added an `?email=` hint on the tickets→userDetail link as a
fallback. Real fix still = a BC server-side email filter (BC ask). Separately observed:
BC's `/user/management/detail` (getUserDetail) intermittently returns
`{message,error,statusCode}`, blanking the whole user-detail page — watch this.

Auth gotcha for probes: BC uses a **per-endpoint apiId**, so a `clientId=...` query
captured from one page (e.g. /csr/users) **403s** on `/contactMessage/admin/*`.
Capture auth from the target endpoint's own request (navigate to /csr/tickets and
grab its query string). The `userContact` collection on `/database/search` returns
0 in dev — the real messages are the `contactMessage` collection via the REST
endpoints above, not /database/search. Relates to
[[feedback_no_clientside_filter_on_bc_database_search]] (email IS in displayFields,
so client-matching on it is safe here).
