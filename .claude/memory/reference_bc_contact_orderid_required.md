---
name: BC contactMessage requires orderId on category=general
description: BC validates orderId on /api/contactMessage/create for general-category submissions — must match /^[a-zA-Z0-9]{8,24}$/. Workaround in place via sentinel NOORDERID0000.
type: reference
originSessionId: 99b4513c-d322-4f20-865d-5c6f0d43d17e
---
BC's `/api/contactMessage/create` endpoint validates `input.orderId` on `category: 'general'` submissions. Schema (per BC docs 2026-04-17): `orderId: string` (no `?` marker) — required.

Validation rules:
- Must be a string
- Must not be empty
- Must match `/^[a-zA-Z0-9]{8,24}$/` (8–24 alphanumeric characters)

When all three validators fire simultaneously, the request is rejected with 400 and three "must be / must not be empty / must match" messages — that's the canonical signature of a missing required field.

**Workaround:** `api.submitContact` general-category builder sends `'NOORDERID0000'` as a sentinel when no real orderId is available (member without active subscription, visitor). Live since commit on 2026-05-11. CSRs need to know: orderId starting with `NOORDERID` → no order on file, treat as general inquiry.

`category: 'billing'` has `orderId?` (optional) and doesn't need the sentinel — but billing also requires `date`, `zip`, `last4`, so it's not a fallback path for general member inquiries.

**Removal trigger:** when BC ships an update making `orderId` optional for `general` (or adds a `member-inquiry` category), strip the sentinel from `src/api.js submitContact` and BC will accept absent orderId again.
