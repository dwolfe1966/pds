---
name: BC consumer support model — enumeration + per-thread (post-2026-05-28)
description: BC's consumer surface for support. Enumeration via getUserContacts (added 2026-05-28); per-thread content via histories(id, hash). localStorage is a cache, BC is source of truth.
type: project
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
**Updated 2026-05-28** — BC restored consumer enumeration. The earlier "per-thread only, no aggregate" framing is OBSOLETE.

## Current state

Two BC endpoints carry the consumer support flow:

1. **Enumeration** — `apiWrapper.api.message.contact.getUserContacts({ lastId })` → `GET /api/contactMessage/getUserContacts` (added 2026-05-28).
   - Returns `{ docs: [...], noMoreDocs }` where each doc is a contactMessage thread the user has access to (own submissions + CSR-initiated where they're `targetUserId`).
   - Each doc carries `hash` inline, so no second round-trip is needed before calling histories.
   - Example shape in `docs/new-api/bc client library - Api.csv` under "Get User Contacts Added on 2026-05-28".

2. **Per-thread content** — `apiWrapper.api.message.contact.histories({ contactMessageId, hash, lastId? })` → `GET /api/contactMessage/histories`.
   - Returns the full thread: initial `contact` doc + every `contactCsrReply` / `contactUserReply`.
   - One call per thread; we walk the enumeration list and call this per `(id, hash)` pair.

## Read flow on `/account → Messages`

`AccountPage.fetchMessages` has two stages:

1. Call `api.getUserContacts()` → for each new `(id, hash)` in the response, merge into `accountThreads:<email>` localStorage (dedupe by id). BC is source of truth; localStorage is a cache.
2. Walk all refs (BC-enumerated + anon-migrated from `pendingContactThreads:<email>`) and call `api.getContactHistories({ id, hash })` per thread. Merge docs, sort, render.

## What this fixes vs. the old model

- **Cross-device** — member submits on phone, opens `/account` on laptop. getUserContacts surfaces the thread; histories renders it. ✓
- **Fresh browser / cleared storage** — same as above; BC enumeration repopulates the cache. ✓
- **CSR-initiated F8 billing-action threads** — CSR opens a thread on the member's behalf via `csrCreateContactMessage`. Because `targetUserId` is the member, it shows up in their `getUserContacts`. ✓
- **Anonymous `/contact` → signup** — covered by the older `pendingContactThreads:<email>` migration in `AuthContext` (preserved). BC's enumeration scopes by authenticated user, so it can't surface anonymous-era submissions retroactively.

## Code touch points (current)

- `src/services/apiWrapper.js` → `getUserContacts(lastId)` calls IIFE primary + `_csrGet('/contactMessage/getUserContacts')` fallback.
- `src/pages/member/AccountPage.js` → `fetchMessages` does the two-stage fetch.
- `src/pages/sales/ContactPage.js` → `persistContactThreadRef` still captures (id, hash) at create time for instant feedback; the cache is now also kept fresh by getUserContacts on every load.
- `src/context/AuthContext.js` → `pendingContactThreads:<email>` migration kept for the anon→signup case.
- Spec doc: `docs/BC_USERCONTACT_LIST_404.md` (status: ✅ resolved by BC adding the new endpoint).

## Historical context

- 2026-04-17: BC removed `/api/message/userContact/list` (the older aggregate). Triggered the 7-day gap where consumer enumeration was impossible.
- 2026-05-27: BC told us "use histories" — implying no aggregate would return. We exhausted client-side workarounds.
- 2026-05-28: We renewed the ask with full evidence (every other piece works once we have (id, hash)). BC shipped `getUserContacts` the same day.

Don't relitigate the "histories only" framing — it was correct for ~24 hours and is now obsolete.
