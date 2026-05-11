---
name: BC's downstream provider IDIData needs production IPs whitelisted
description: Search failures on www.idlookup.ai (412 / 401 loops on /idLookup/teaser/search) were caused by IDIData not having the production VPS IPs whitelisted, not by BC captcha. Likely re-surfaces on any new prod-side IP change.
type: project
originSessionId: 99b4513c-d322-4f20-865d-5c6f0d43d17e
---
When `/api/idLookup/teaser/search` returns 412 (captcha) or 401 loops in production but works fine on `dev.www.idlookup.ai`, suspect IDIData first — they're the downstream data provider BC fans out to for identity searches, and they whitelist by source IP.

**Why this matters when debugging:**
- The symptom looks like a BC captcha problem (412 with `password.v0` + repeating verify cycle) but the root cause is upstream: BC's backend can't reach IDIData → BC returns a generic error that surfaces as captcha-shaped 412.
- Don't waste cycles on captcha workarounds (sentinels, password.v0 modal, etc.) before confirming IDIData has whitelisted the production VPS IP for `www.idlookup.ai`.
- Whitelist applies per-environment: `dev.www.idlookup.ai` has its own (working) entry; production needs separate registration.

**Symptom signature observed 2026-05-11:**
- `dev.www.idlookup.ai` search works (captcha modal pops or auto-resolves)
- `www.idlookup.ai` search → 412 four times then 401 — captcha verify returns 200 but each retry gets a NEW captcha challenge → looks like an unsolvable captcha loop
- BC console showed the actual upstream failure once IDIData was checked

**How to apply:**
- On any new prod environment / new VPS / new IP allocation: confirm with BC that IDIData has the source IP whitelisted before declaring "search is broken."
- When a search call 412-loops only on production, ping BC with: "Is IDIData seeing requests from our prod IP? If not, please whitelist."
- Don't conflate this with the genuine `password.v0` captcha issue on `/contactMessage/create` — that one is real and separate (see `reference_bc_contact_orderid_required.md` neighborhood).
