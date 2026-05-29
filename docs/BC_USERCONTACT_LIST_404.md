# BC ask — Consumer needs to enumerate its own contactMessage threads ✅ RESOLVED

**Raised:** 2026-05-27 · **Renewed:** 2026-05-28 · **Closed:** 2026-05-28 (same day)
**Resolved by:** Kwan Park / BC — new endpoint shipped within hours of the renewed ask.

## Resolution

BC added `apiWrapper.api.message.contact.getUserContacts({ lastId })` → `GET /api/contactMessage/getUserContacts` on 2026-05-28. Returns docs where the authenticated user is `targetUserId`, with `hash` inline on every doc — exactly the shape we asked for. Covers both user-submitted threads and CSR-initiated (F8) threads.

Wired in consumer bundle `fef6ef99` (2026-05-28):
- `apiWrapper.getUserContacts` (was a no-op stub) now calls the new endpoint, IIFE-first with `_csrGet` fallback.
- `AccountPage.fetchMessages` enumerates via BC at the top of every load, merges new `(id, hash)` refs into `accountThreads:<email>` localStorage, then walks all refs through histories per the existing flow.

F9 in `docs/qa/pre-launch-test-log.md` is now marked ✅ RESOLVED with retest steps.

---

## Original ask (historical, kept for context)

**Raised:** 2026-05-27 · **Renewed with full evidence:** 2026-05-28
**Owner:** dwolfe66@gmail.com
**Environment:** `https://dev.www.idlookup.ai/`

## Ready-to-send summary (copy-paste for chat/email)

> Consumer support flow is fully working on a per-thread basis — `message.contact.histories(id, hash)` returns the initial doc + every reply, we render them correctly. The remaining gap is **enumeration**: an authenticated member has no consumer-side way to ask BC "what threads do I have?"
>
> `POST /api/message/userContact/list` still returns 404 (intentionally removed 2026-04-17 per `Api.csv:709`). Without a replacement, members lose visibility into:
> - threads they submitted on another device or before signup,
> - threads CSR creates on their behalf via the F8 billing-action flow.
>
> Both cases stay broken until BC restores `/userContact/list` (with consumer auth, returning `hash` inline on each doc) or adds a consumer-auth equivalent of `findUserContactMessages` (e.g. `apiWrapper.api.message.contact.findMine`). Either solves it. Full diagnosis + response shapes in `docs/BC_USERCONTACT_LIST_404.md` in the repo.

---

## TL;DR

Every part of the consumer support flow works once the consumer holds `(contactMessageId, hash)` for a thread. We've verified end-to-end. The only thing missing is a way for the **consumer** (authenticated member) to list its own threads with their hashes. Without it, a member's own messages can be invisible to them in-app even though they're alive in BC.

Two specific proposals at the bottom — either solves the problem.

## What we verified works (no BC action needed)

1. `apiWrapper.api.message.contact.create` returns `{ success, messageResult: { _id, hash, ... }, mailResult }` ✓
2. We extract `_id` + `hash` from `messageResult` and persist them to localStorage at create time ✓
3. `apiWrapper.api.message.contact.histories({ contactMessageId, hash })` returns the full thread — initial `contact` doc + every `contactCsrReply` / `contactUserReply` ✓ (confirmed via diag readout: `bound 1 thread · fetched 2 docs (1 contact, 1 csrReply)`)
4. Consumer renders the thread with correct CSR/member attribution and timestamps ✓

So the BC consumer API is internally consistent and complete **per thread**. The gap is one level up.

## What is still broken — and why it's BC-only

A member who:
- Submitted `/contact` while logged out (then signed up), or
- Submitted on a different device / browser, or
- Has a thread that CSR created on their behalf via `csrCreateContactMessage` + `csrCreateCsrReply` (the F8 "Request Billing Action" flow)

…has **no in-app path** to find that thread. localStorage on this browser has no `(id, hash)` ref for it, and there's no consumer endpoint to ask BC "what threads exist for me?" The thread shows up in `dev.www.bytecrtrs.com/csr` (via the admin `findUserContactMessages` endpoint, which does return `hash` inline per `csrApi.csv:413`), but consumer-side it's invisible.

## Reproduction (curl, anonymous auth)

```
POST https://dev.www.idlookup.ai/api/message/userContact/list?clientId=test&apiId=test
→ HTTP 404
   {"message":"Cannot POST /api/message/userContact/list?...","error":"Not Found","statusCode":404}
```

Per `Api.csv:709` this endpoint is annotated **"Removed on 2026-04-17"** with no replacement documented.

## Earlier BC guidance and why it doesn't close the loop

On 2026-05-27, BC told us: *"`apiWrapper.api.message.contact.histories` — this is the one you should use if a customer wants to see it."*

That's correct for **per-thread display** (we use it, it works). It does not solve **per-user enumeration** — histories requires the caller to already have `(id, hash)` in hand, and BC's consumer surface offers no way to obtain that list. Three of the most common real-world cases (above) leave the consumer without any external trigger to acquire the refs.

## What we need from BC

Either of these unblocks us — pick whichever fits BC's data model best:

### Option A — Restore `/api/message/userContact/list` with consumer auth

The endpoint already exists in BC's history (and is still documented as `apiWrapper.api.user.getContacts` at `Api.csv:712`). Bringing it back, scoped to the authenticated user's contactMessage records and including `hash` on each doc, is the minimal change.

Response shape we need:
```json
{
  "docs": [
    {
      "_id": "...",
      "type": "contact",
      "hash": "...",
      "content": { "input": { "topic": "...", "description": "..." } },
      "createdAt": "...",
      "latestReply": null | { ... }
    }
  ],
  "noMoreDocs": true
}
```

### Option B — Add `apiWrapper.api.message.contact.findMine({ lastId? })`

A new consumer-auth endpoint at `POST /api/contactMessage/findMine` (or similar) that mirrors the CSR side's `findUserContactMessages` but scoped to the authenticated member. Same response shape — must include `hash` per doc so the client can immediately call `histories`.

### Either way: `hash` must be inline on the list response

Otherwise the consumer would have to call a second endpoint per thread to get the hash before it can call `histories`, which is a bad round-trip cost. The CSR-side `findUserContactMessages` already returns `hash` inline (`csrApi.csv:413`); please match that.

## Out of scope for this ask

- Surfacing CSR-initiated threads' refs back to the consumer on the day they're created (we'd want a push, not just enumeration). For now, enumeration covers it — the next login picks up the new thread.
- Aggregating `contactMessage` and the older `userContact` / `userContactCsrMail` collections. If both still get written, the consumer list response should cover both; if `userContact*` is fully deprecated, just contactMessage is fine.

## Code touch points (for context, no action needed from BC)

- Consumer fetch: `src/pages/member/AccountPage.js` → `fetchMessages`
- Create-time capture: `src/pages/member/AccountPage.js` → `handleComposeSubmit` (extracts `messageResult.{_id,hash}`)
- Anonymous → signed-in migration: `src/context/AuthContext.js` (pending refs migrate on user change)
- Wrapper: `src/services/apiWrapper.js` → `getUserContacts` is currently a no-op stub; will be re-wired to the new endpoint once it lands.

## Verification once deployed

We'll re-test against `dev.www.idlookup.ai/` with the consumer build (`npm run build`, current head). Expected: a member with N threads sees all N in `/account → Messages` regardless of which device/session created each one.
