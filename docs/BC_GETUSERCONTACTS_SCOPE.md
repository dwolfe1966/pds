# BC ask — `getUserContacts` returns empty for member-submitted threads

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

## Ready-to-send summary (copy-paste for chat/email)

> Thanks for shipping `apiWrapper.api.message.contact.getUserContacts` on 2026-05-28 — we wired it the same day. Empirically though, it returns `docs: []` for a member who has two existing contactMessage threads visible in CSR (`dwolfe666@gmail.com`).
>
> Looking at your example response, `getUserContacts` filters on `content.targetUserId === authenticatedUser._id`. That field doesn't get set when a logged-in member submits via `apiWrapper.api.message.contact.create` — only when CSR creates a thread on the member's behalf (`csrWrapper.api.message.contact.create` sets it explicitly).
>
> Three possible fixes — any one closes it:
>
> 1. **Auto-link on the write side.** `contact.create` reads the authenticated subject (same one `getUserContacts` reads on the read side) and stores it as `content.targetUserId`. You already have the session; this is internal consistency.
> 2. **Honor an explicit `targetUserId` in the create body.** We're shipping that field today; if BC stores it, future member-submitted threads will surface immediately.
> 3. **Broaden `getUserContacts` filter** to also match by `ownerId === authenticatedUser._id` and/or sender `content.input.email`. This is the only option that surfaces *existing* threads without a data backfill.
>
> Whichever path you pick, please confirm so we can stop the empirical-test patches. Existing threads (created before today) will still need a one-time backfill of `content.targetUserId` unless you choose option 3. Full diagnosis in `docs/BC_GETUSERCONTACTS_SCOPE.md` in the repo.

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
