---
name: BC API documentation locations
description: Where the authoritative BC API CSV docs live in the repo (consumer + CSR + how-to). Always check these before guessing endpoint paths or method names.
type: reference
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
BC ships three CSV documentation files in this repo. **Always grep these first** before assuming an endpoint path/method name — the BC docs are the source of truth and have been updated multiple times in 2026 (most recently 2026-05-27, restructuring admin notes, csrMail → csrReply, etc.).

## File locations

- **Consumer ApiWrapper:** `/Users/davidwolfe/Documents/GitHub/pds/docs/new-api/bc client library - Api.csv`
  - Methods on `window.ApiWrapper.getInstance({...}).api.*`
  - ~1380 lines. Each row: Desc, path, method (post/get), example, param, return, misc.

- **CSR / Admin csrWrapper:** `/Users/davidwolfe/Documents/GitHub/pds/docs/new-api/bc client library - csrApi.csv`
  - Methods on `window.CsrWrapper.getInstance({...}).api.*`
  - ~2408 lines. Same column shape as Api.csv. **This is the BC-side admin source of truth.**

- **How-to / setup:** `/Users/davidwolfe/Documents/GitHub/pds/docs/new-api/bc client library - HowTo.csv`
  - Library bootstrap, ShapeCompiled patterns, captcha behavior, dataLayer hooks, attachments helper.
  - Latest addition (2026-05-13): `apiWrapper.api.shape.setShapeParams({ shn, shl, cascade })` for mid-session shape changes.

## Updated as of 2026-05-27

Notable post-2026-04-17 changes captured in these docs:
- Admin notes restructured: write via `POST /api/message/admin/createNote`, read via `GET /api/message/admin/findNotes?userId=<id>` (separate read endpoint, NOT via `/database/search` anymore).
- CSR reply path: `csrWrapper.api.message.contact.createCsrReply` at `/api/contactMessage/admin/csrReply` (replaces the old `csrMail/create` path which still appears in docs but is the older variant).
- Consumer userContact list endpoint `/api/message/userContact/list` is documented on `apiWrapper.api.user.getContacts` — useful for cross-device support inbox (was thought removed per 2026-04-17 memory note; appears restored or maintained).
- `apiWrapper.api.idLookup.getUserSearchHistory` at `/api/idLookup/userSearchHistory` — search history endpoint added.

## How to inventory methods quickly

```bash
# Consumer methods documented
grep -oE "apiWrapper\.api\.[a-zA-Z]+\.[a-zA-Z]+(\.[a-zA-Z]+)?" \
  "docs/new-api/bc client library - Api.csv" | sort -u

# CSR methods documented
grep -oE "csrWrapper\.api\.[a-zA-Z]+\.[a-zA-Z]+(\.[a-zA-Z]+)?" \
  "docs/new-api/bc client library - csrApi.csv" | sort -u

# Path lookups
awk -F, '$2 ~ /^\/api/ {print $2, "→", $1}' \
  "docs/new-api/bc client library - Api.csv"
```

## Important spelling

BC docs use `/api/commerceMgnt/...` (note: NOT "Mgmt"). Our code currently uses `/commerceMgmt/...`. As of 2026-05-26 our path works on `dev.www.bytecrtrs.com`, suggesting either the docs have a typo or BC accepts both. Verify against deployed BC before any path-renaming. Do NOT auto-correct one to the other without testing.
