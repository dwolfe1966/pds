# BC ask — `getUserContacts` returns empty for member-submitted threads

> **✅ RESOLVED GOING FORWARD — verified live 2026-06-13.** BC now enumerates member threads
> that carry the `targetUserId` we send (our consumer fix `abdfa12a` maps `userId`→`targetUserId`
> on `contactMessage/create`). Re-tested test21 in a **fresh context (no cache)**:
> `getUserContacts` returns **1 doc** (was **0** on 06-11) — the thread created on 06-11 with the
> fix. So **new member threads now appear cross-device** once the consumer build (`227ad9b9`+,
> which includes `abdfa12a`) is deployed. Two caveats: (1) only **1** of test21's 5+ threads
> shows → BC is matching the `targetUserId` field, NOT `ownerId`, so **legacy threads** (created
> before the fix, no `targetUserId`) still don't enumerate — needs an `ownerId` match or a
> one-time backfill (LOW priority; owner previously accepted legacy-missing). (2) Passing a query
> param to `getUserContacts` still does nothing (baseline == params == 1) — the param avenue is
> moot now that the session-scoped baseline works. Earlier diagnosis retained below.

> **PINPOINTED 2026-06-11 — it's a read-filter path mismatch; BC already has the link.**
> Created a new member thread (`POST /api/contactMessage/create` → **201**) and inspected the
> stored doc (`_id 6a2af94dc28252975cc73dba`):
> - BC **auto-sets `ownerId: <memberId>` and `updaterId: <memberId>`** on the thread — the
>   member→thread link already exists server-side with no input from us.
> - The `targetUserId` we now send is stored at **`content.input.targetUserId: <memberId>`**
>   (nested under `input`, because the create body is `{ input: {...} }`).
> - There is **no top-level `content.targetUserId`** — which is exactly what `getUserContacts`
>   filters on — so it returns `{docs:[]}` despite the member clearly owning the thread.
>
> **Cleanest fix (zero client change): `getUserContacts` should match by `ownerId`** (BC already
> populates it correctly on every member thread). Alternatively match `content.input.targetUserId`
> or `updaterId`. We have no way to write a top-level `content.targetUserId` from the consumer —
> the create nests everything we send under `content.input`.
>
> **No client-side param workaround — tested 2026-06-11.** Replayed the authenticated
> `GET /api/contactMessage/getUserContacts` with each of `?targetUserId=`, `?ownerId=`,
> `?updaterId=`, `?userId=` (= the member's `_id`). **All returned `200` with `{docs:[]}`**
> (baseline `200/0` too — auth fine). BC ignores undocumented filter params on this endpoint, so
> we cannot scope it from the client. Also tried stuffing the id into the one documented param,
> `?lastId=<memberId>` → `200 {docs:[]}` (lastId is a pagination cursor, not a filter). NB: the
> deployed IIFE exposes **no** `getUserContacts` method (`api.message.contact` = create/reply/
> histories only), so our app always hits the endpoint via a direct GET — the "method call" and
> the raw GET are the identical request, both 0 docs. **This
> requires a BC server-side read-filter change** — have `getUserContacts` match the `ownerId` it
> already stores. Escalation confirmed (no HOLD).

> **❌ STILL OPEN — corrected 2026-06-11 (the 2026-06-10 "resolved" call was WRONG).**
> The earlier "new messages show up" was the per-device **localStorage cache** of
> (contactMessageId, hash) refs — NOT BC enumeration. **Decisive A/B 2026-06-11:** same
> account `test21@test21.com`, same moment —
> - **Normal browser** (has cache): account → Messages shows **all threads**.
> - **Incognito** (no cache): `GET /contactMessage/getUserContacts` → **`{"docs":[],"noMoreDocs":true}`** (0 docs).
>
> So BC is **not** enumerating this member's threads server-side. Net member impact: support
> messages are visible **only on the device where they were created/viewed**; a new browser,
> incognito, or another device shows nothing. **No client-side fix is possible** — the consumer
> has no endpoint to enumerate a member's contactMessages by email/ownerId. Needs BC to set
> `targetUserId` on member-submitted threads (option 1/2) or broaden `getUserContacts` to match
> by `ownerId`/sender email (option 3) — see below. Re-escalate; this is a real cross-device gap.
>
> **NOT legacy-only — confirmed 2026-06-11.** Created a BRAND-NEW thread as test21 (via
> `/contact` → contactMessage.create, captcha solved manually), then checked in a fresh
> incognito session: `getUserContacts` STILL returns 0. So `targetUserId` is **not being set
> on new member-submitted threads either** — the fix is not live at all, it's not just a
> backfill question. Every member-submitted thread is invisible to that member from any device
> without the local cache.

**Raised:** 2026-05-29
**Environment:** `https://dev.www.idlookup.ai/`
**Builds under test:** consumer `ed43a54c` (and successor with `targetUserId` plumbed through)

> **STILL OPEN — re-surfaced 2026-06-10.** The Director of CS flagged that a member's messages
> don't all appear in account → Messages (e.g. `test21@test21.com`). We fixed the *page-1
> truncation* on our side (consumer bundle `9079698d`: `fetchMessages` now pages through every
> page of `getUserContacts` via `lastId`). But the **root cause below is unchanged** — threads
> where BC never set `content.targetUserId` are still missing on a fresh device (we only have a
> per-browser localStorage cache as a stopgap). Please pick one of the three fixes below; option
> 3 (broaden the read filter to also match `ownerId`/sender email) is the only one that surfaces
> existing threads without a backfill.
>
> **DECISIVE REPRO 2026-06-10:** logged in live as `test21@test21.com` (who has 5+ threads
> visible in CSR) and intercepted the call — `GET /contactMessage/getUserContacts` returns
> **`{ docs: [], noMoreDocs: true }`** (0 docs). So this is NOT pagination and NOT a client bug:
> BC returns zero threads for a member who demonstrably has several. The only message the member
> sees in account → Messages is one cached in their browser's localStorage. **No client-side fix
> is possible** — BC must link the threads (option 1/2) or broaden the read filter (option 3) +
> backfill `targetUserId` on existing threads. Now a Director-flagged CS/compliance issue — please
> prioritize.

## TL;DR (one paragraph, 2026-06-11)

> `apiWrapper.api.message.contact.getUserContacts` (`GET /api/contactMessage/getUserContacts`, Api v3.csv:645) returns `{docs:[], noMoreDocs:true}` for members who own threads — verified on `test21@test21.com` (incognito, so no client cache). The link isn't missing on your side: a member create (`POST /api/contactMessage/create`) returns **201** and BC **auto-stamps `ownerId` and `updaterId` = the member's id** on the thread (example `_id 6a2af94dc28252975cc73dba`, `ownerId 6a11ea7daaf121809263f972`). The problem is the read filter: `getUserContacts` matches on **`content.targetUserId`** (top-level), which nothing populates there — the `targetUserId` we now pass is stored at **`content.input.targetUserId`** (nested, because the create body is `{ input: {...} }`), and we can't write a top-level `content.targetUserId` from the consumer. **Cleanest fix, zero change on our side: have `getUserContacts` match by `ownerId`** (you already set it on every member thread); alternatively match `content.input.targetUserId` or `updaterId`. Net impact today: members only see their support messages on the device where they created them.

## Ready-to-send summary (copy-paste for chat/email)

> **Re-escalation 2026-06-11 — `getUserContacts` is not enumerating member-submitted threads at all (not legacy-only).**
>
> `apiWrapper.api.message.contact.getUserContacts` returns `{ docs: [], noMoreDocs: true }` for members who demonstrably have threads. We proved it's a server-side enumeration gap, not a client bug or a stale-data/backfill question, with two tests on `test21@test21.com`:
>
> 1. **Incognito A/B (same account, same moment):** in a normal browser, account → Messages shows all the member's threads; in an **incognito** window (no localStorage), `getUserContacts` returns **0 docs**. → What members "see" today is only our **per-device localStorage cache** of `(contactMessageId, hash)` refs, not your enumeration.
> 2. **Brand-new thread:** created a fresh thread as test21 via `apiWrapper.api.message.contact.create` (captcha solved), then checked a clean incognito session → `getUserContacts` **still returns 0**. So `content.targetUserId` is **not being set on new member-submitted threads either** — this is not just a missing backfill of old threads.
>
> **Member impact:** a member sees their own support messages only on the device where they created/viewed them. New device, new browser, or incognito = blank. This is a real cross-device support gap (Director of CS flagged).
>
> **Root cause (as before):** `getUserContacts` filters on `content.targetUserId === authenticatedUser._id`, but `message.contact.create` doesn't populate `content.targetUserId` for member-submitted threads (only `csrWrapper`'s CSR-side create sets it).
>
> **Any ONE of these closes it:**
> 1. **Auto-link on write:** `contact.create` stores the authenticated subject as `content.targetUserId` (you already have the session — internal consistency).
> 2. **Honor an explicit `targetUserId`** in the create body (we already send it).
> 3. **Broaden `getUserContacts`** to also match `ownerId === authenticatedUser._id` and/or sender `content.input.email` — the only option that surfaces **existing** threads with no backfill.
>
> Please confirm which path + a timeline. We have no client-side fix (the consumer can't enumerate contactMessages by email/ownerId). Full diagnosis: `docs/BC_GETUSERCONTACTS_SCOPE.md`.

---

## Full diagnosis

### What works

- `GET /api/contactMessage/getUserContacts` returns 200 with `{ docs: [], noMoreDocs: true }` for an authenticated member.
- The example response in `docs/new-api/bc client library - Api.csv` (added 2026-05-28) shows that BC's intended filter is `content.targetUserId === authenticatedUser._id`. Both example docs satisfy that.

### What doesn't work

- Member `dwolfe666@gmail.com` has at least two existing contactMessage threads (verified visible in `dev.www.bytecrtrs.com/csr` EmailTickets — sender email matches, CSR replies confirmed).
- That member's `getUserContacts` returns `docs: []`.
- Reason: BC's `contact.create` doesn't set `content.targetUserId` for member-submitted threads. We checked our submit payloads — the only user identifier we send is `email`. The IIFE attaches Bearer/cookie auth so BC has the subject, but it's apparently not read on `contact.create`.

### Evidence of internal inconsistency

- **Read path** (`getUserContacts`) — uses the authenticated subject correctly to scope results. No `userId` / `email` input parameter; the spec is `{ lastId? }` only.
- **Write path** (`contact.create`) — does NOT use the authenticated subject to populate `content.targetUserId`. Member-submitted threads end up with `targetUserId` unset.

Same session context, different code paths. This is what makes option (1) above so attractive — it's a one-line read of the subject on a code path that already has access to it.

## Three fix options, ranked

### Option 1 — Auto-link `contact.create` to authenticated subject (best, no backfill needed for new threads)

```
contact.create handler reads req.user._id (or however BC exposes the session subject)
  → writes it into the new doc's content.targetUserId
```

Closes the gap for everything submitted post-deploy. Existing threads need option 3 to be visible, or a one-time `targetUserId` backfill from `ownerId`.

### Option 2 — Honor explicit `targetUserId` in the create body (we're already trying it)

Consumer build `ed43a54c+` sends `targetUserId: user.id || user._id` in the `contact.create` payload. If BC accepts and stores it, new threads surface immediately. If BC strips unknown fields, we'll see `docs: []` continue and need option 1 or 3.

This is the empirical test we're running today.

### Option 3 — Broaden `getUserContacts` filter to also include `ownerId` and/or `email`

```
filter: {
  $or: [
    { 'content.targetUserId': req.user._id },
    { ownerId:               req.user._id },
    { 'content.input.email': req.user.email },  // optional fallback
  ]
}
```

This is the only option that retroactively surfaces existing threads without a data migration — useful for accounts created during the testing window. The `email` match has obvious caveats (member changes email; spoofed sender on visitor contact form) but if scoped to `req.user.email` rather than arbitrary input, it's safe.

## What we need from you

A single answer: which option are you taking? We'll stop the empirical patches and finalize the consumer wiring once we know.

## Reproduction

1. Log into `dev.www.idlookup.ai` as `dwolfe666@gmail.com`.
2. Open DevTools → Network → filter on `getUserContacts`.
3. Observe: `GET /api/contactMessage/getUserContacts?...` → 200 with body `{ "docs": [], "noMoreDocs": true }`.
4. In parallel, on `dev.www.bytecrtrs.com/csr` → search the same email → confirm two threads visible.

## Code touch points (no action needed from BC)

- `src/api.js` → `submitContact` now forwards `body.targetUserId` (post-2026-05-29)
- `src/pages/member/AccountPage.js` → `handleComposeSubmit` passes `user.id || user._id` as `targetUserId`
- `src/services/apiWrapper.js` → `getUserContacts` wired (no changes needed pending BC's chosen option)
