---
name: project-wsfy-auth-2026-07-14
description: ASK WSFY-AUTH — verifiable BC member-auth token (signed JWT via HMAC or RS256+JWKS) so the external idlookup.me backend can authenticate a BC member + read paid status for the WSFY reveal-identity tier; registered 2026-07-14, blocked-on-BC, NOT sent
metadata:
  type: project
---

**ASK WSFY-AUTH — registered 2026-07-14 in `docs/BC_CONSUMER_FEATURE_ASKS.md`. Status: blocked-on-BC, NOT sent.**

Consumer track (NOT a CSR letter — deliberately labeled `WSFY-AUTH` to avoid colliding with the CSR A–H
letter namespace). Capability ask, so the demo-gate does not apply; evidence is a verified code fact, not a
live demo.

**Ask (one capability, two purposes):** on successful login BC issues a **verifiable credential** the
idlookup.me backend can validate **server-side without calling BC per request** — signed JWT via either
(i) a **shared HMAC secret** we set as a Vercel env, or (ii) an **RS256 key + JWKS URL**. Must carry at
minimum `userId` (stable), member `name`, and `paid`/subscription status. Short TTL + refresh is fine. One
capability unblocks both **identity-binding** (member sees only who's searching for themselves) and the
**paid-tier gate** (real searcher names / paid detail gated to the actual paid owner).

**Why it's needed:** WSFY ("Who's Searching For You") is now built entirely on our own idlookup.me infra
(Vercel + Neon), independent of BC for feature/data. But some WSFY responses reveal real searcher
identities (proof name in the tease, full detail for paid members), which must be authenticated + paid-gated.

**Blocker (verified 2026-07-14):** `src/services/apiRouter.js:22-37` — comment: *"BC uses cookie-based
sessions and does not issue JWTs to clients."* Consumer `accessToken` = `createBcSessionToken` →
`btoa(JSON.stringify({bcSession,user,iat,exp}))`, explicitly *"NOT cryptographically verified — it exists
only for client-side route-gating"* → forgeable. Real BC session is a cookie scoped to BC's domain;
idlookup.me is a different domain and cannot see/validate it. So idlookup.me has no verifiable way to
authenticate a BC member or confirm paid status.

**Associated open question (track like the `userContact` CONFIRM):** is BC's session cookie `httpOnly`?
If NOT → a forwardable session id could enable an interim server-side validation call from idlookup.me;
if YES (likely) → the verifiable-token ask is the only route. Ask BC to confirm.

**Supersede note:** this replaces the WISFY Cluster-1 *data* ask (inbound-activity finder) in the same doc —
the finder is withdrawn because WSFY data is now self-hosted. Cluster 1 now carries a supersede pointer to
WSFY-AUTH so the handoff doc is not self-contradictory. Related: [[project-asks-e-h-2026-07-02]] (same
register, consumer-side asks).

**How to apply:** BC-facing note lives in `docs/BC_CONSUMER_FEATURE_ASKS.md` under the `WSFY-AUTH` section
+ Summary table. When drafting for BC, anchor on the quoted `apiRouter.js:22-37` code fact (the Kwan-proof
hook — the analog of a literal BC response string for a demo-less ask). Register count of consumer asks:
WSFY-AUTH (1) + Alerts (4); WISFY data ask now 0 (superseded).
