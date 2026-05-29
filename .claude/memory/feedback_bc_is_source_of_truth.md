---
name: BC is the source of truth — always go to BC for state
description: Core principle. Display state must come from BC, not localStorage / sessionStorage / synthetic caches. Until after launch, BC is the only backend; no BFF / no tracking-api dependency for product surfaces.
type: feedback
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
**Always go to BC for accurate state.** Owner stated this is a **core principle** (2026-05-28).

## What this means in practice

- **Display state must be fetched from BC every load.** Don't render from localStorage / sessionStorage / synthetic caches as the canonical source. They're acceptable only as ephemeral instant-feedback between submit and BC round-trip — never as the answer the user reads.
- **localStorage may store pointers / refs** (e.g., `(contactMessageId, hash)` to call BC histories), but never message content, profile fields, subscription status, or anything else that BC owns.
- **No optimistic UI that survives without a follow-up BC fetch.** After a create/update, trigger the canonical re-fetch immediately (don't wait for the next tab visit).
- **Surface errors instead of degrading to local mirror.** If BC fails, show the error — don't pretend things worked by showing cached data.

## Launch constraint (2026-05-28)

> "we have to only rely on BC api for now. No reliance on our tracking API until after launch"

So even though `tracking-api/` is independently deployable and could serve as a BFF for things BC doesn't expose (e.g., consumer enumeration via cached CSR creds), **don't build that path before launch**. Gaps in BC's API (like consumer message enumeration) stay as gaps for launch; we negotiate with BC for endpoints, or accept the limitation with clear UX.

## How to apply

When you're about to write code that reads from localStorage / sessionStorage / a synthetic cache to populate user-visible state, **stop and ask: can BC tell us this?** If yes, fetch it. If no, the answer is to negotiate with BC, not to invent a local truth.

Already-validated examples (where we go to BC):
- `subscription` — always `billing.getOrders()`; no local `isPaid` flag (see `feedback_subscription_state_authority.md`)
- Message thread content — always `message.contact.histories(id, hash)`; never the sessionStorage mirror
- Search results — always BC, never cached locally

Code touch points where this principle is currently honored:
- `src/services/apiWrapper.js` — BC IIFE is the canonical path; direct POST fallbacks only on missing IIFE methods
- `src/pages/member/AccountPage.js` `fetchMessages` — pure BC histories walk
- `src/pages/member/AccountPage.js` `handleComposeSubmit` — re-fetches from BC after create
