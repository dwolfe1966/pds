---
name: BC's downstream provider IDIData — whitelist AND privilege provisioning
description: Search failures (412/401 loops, fulfilled+empty results, cloned subStatus) on idLookup teaser are almost always upstream IDI issues — either IP whitelist or BC's account privileges on IDI. Recurring on every new environment.
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

**Additional symptom signature observed 2026-05-12:**
- After IP whitelist was supposedly fixed, search returned `status: "fulfilled"`, `subStatus: "cloned"`, `transient.total: 16`, `transient.identities: []`
- BC's cache layer was cloning earlier failed-IDI commerceContents instead of re-querying — empty identity payload propagated through "cloned" entries
- Owner confirmed this was again an IDI side issue (privilege provisioning on the BC account at IDI). Two distinct IDI failure modes have hit us so far: (1) IP whitelist, (2) account privilege provisioning.

**Pattern of "cloned empty teasers":** If BC returns `subStatus: "cloned"` with `transient.total > 0` but `transient.identities: []`, the chain is usually:
1. Earlier search ran while IDI was failing (whitelist, auth, or privilege)
2. BC stored an empty commerceContent for that query
3. Cache cloning returned the empty result on subsequent calls
4. Fixing IDI alone doesn't help — BC also needs to invalidate the stale empty cache entries (or skip cache when `identities.length === 0`)

**How to apply:**
- Whenever search misbehaves (404s, 412 loops, empty identities, cloned subStatus), assume IDI first — whitelist, auth, or privilege provisioning. Don't burn cycles on consumer-side code first.
- Tell BC: "Confirm IDI status — IP whitelist applied, account credentials valid, account has search/identity privileges, no rate limits. After fix, please clear/invalidate stale teaser commerceContents with empty identities."
- Per-environment: dev and prod are separate IDI registrations. Fixing dev does not fix prod and vice versa.
- Don't conflate IDI issues with the genuine `password.v0` captcha on `/contactMessage/create` — that one is real and separate.
