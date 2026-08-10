# Auth-hardening for the footprint write endpoints — decision needed

## The gap
The SEO API's identity/footprint write endpoints — `/api/exposure`, `/api/optout`, `/api/exposure-detection`,
`/api/protection-history`, `/api/partner-referral`, `/api/history`, `/api/suppression` — are protected only by
a **shared app key** (`X-App-Key`, checked in `lib/app-auth.mjs`). The key ships in the consumer bundle, so
it's extractable. Each endpoint then gates on `hasMappedIdentity(userId)` where **`userId` is client-asserted**.

**Impact:** anyone with the (extractable) app key can pass an arbitrary `userId` and act on *that* user's
footprint — mark records removed, change exposure control, write browsing history, add annotations, submit
referrals. It's a horizontal-authorization hole. The code already flags the ceiling:
`// CEILING: userId is client-asserted (app-key only) until WSFY auth-hardening` (exposure route).

## Why it isn't a self-contained fix
Proving the caller *is* that `userId` means verifying the member's session. The consumer holds a **BC access
token** (`localStorage.accessToken`) it can forward — but the SEO app (separate service) can't **verify** a BC
token without one of:
- **(A) BC's JWT verification key** (public key / shared secret) → SEO verifies the token signature locally and
  reads the authoritative `userId` from its claims. Fast, no per-request BC call.
- **(B) A BC token-introspection / "whoami" endpoint** → SEO calls BC with the token, BC returns the userId.
  No shared secret, but a BC round-trip per write.

Decode-only (read the userId out of the token without verifying the signature) is **not** hardening — an
attacker just crafts a fake token with the victim's userId. So a real fix needs (A) or (B) from BC. This is
the standing **WSFY-AUTH BC ask**.

## Recommended path
1. **File the BC ask** for **(A)** — a JWT verification key (or confirm the token is an RS256/HS256 we can
   verify) — it's the cleaner, lower-latency option. Fallback to **(B)** if BC prefers introspection.
2. **Consumer:** forward the BC token to the SEO write endpoints (e.g. `Authorization: Bearer <accessToken>`
   alongside the existing `X-App-Key`). Low-risk, additive.
3. **SEO:** add `verifyMemberToken(req)` → returns the authoritative `userId` (or null). Write endpoints use
   THAT userId, ignoring any client-supplied `userId`.
4. **Rollout, backward-compatible:** gate strict verification behind an env (e.g. `REQUIRE_MEMBER_AUTH=1`).
   Off → today's behavior (nothing breaks pre-cutover). On → reject writes without a valid token. Flip it once
   the consumer forwards tokens everywhere and it's verified in staging.

## Blockers / decisions for the owner
- **BC ask:** which of (A)/(B) can BC provide, and the token format/signing details.
- Until then this stays a known, documented ceiling. It is a **pre-launch risk** for the write endpoints
  (read/enrichment endpoints leak less), so worth filing the BC ask now even if the rest waits.

_Not started in code — needs the BC decision above before implementation._
