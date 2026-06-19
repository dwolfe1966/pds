---
name: patterns-viacsr
description: Structural hazards in the CSR service layer's shared _viaCsr lib-first-with-fallback helper
metadata:
  type: project
---

`src/services/apiWrapperCsr.js` `_viaCsr(dotPath, args, fallback)` is the CSR layer's
most critical primitive (~20 methods route through it, including all mutations).

Two structural hazards (both confirmed by reading code, not speculation):

1. **Mutations re-run on post-send throw.** The catch fires `fallback()` on ANY throw
   from the lib path, including throws AFTER the request reached BC (parse fail, timeout-
   after-send, malformed 200). It conflates "method absent (safe to retry)" with "method
   present but threw (NOT safe for mutations)". Blast radius: csrCreateCsrReply (double
   reply), setTags/setActor/setTargetUser, cancelUncancelOrder, updateUser — and LATENT
   csrCreateOrder/csrRefundVoidOrder the day BC exposes `billing.sale` (the target is
   pre-wired). Fix = fall back only on method-absent/404/405; re-throw for mutations.

2. **Wrong-shaped lib success → silent empty list.** A lib call that succeeds with an
   unexpected truthy envelope returns straight through `_unwrapBcResponse` with no shape
   check; the router degrades it to `[]`. No throw, no fallback. This is the f156c11
   regression (documented in-code ~line 660). Defenses are per-method dated comments
   ("verified _id-equivalent 2026-06-16") which rot on BC redeploy. Fix = shape-guard the
   lib branch so mismatch triggers fallback.

**Why:** #1 has financial-integrity blast radius; #2 silently empties admin lists.
**How to apply:** Whenever reviewing CSR lib-migration commits, check whether the migrated
method is idempotent. Reads = current pattern OK. Mutations = flag the double-execution risk.

Related: many inbox/userContact defenses only hold while a BC endpoint is closed/broken —
EmailTicketsPage inbox dedup bug + wrong-shaped-lib bugs both activate when the `userContact`
collection ask lands. See [[reference-csr-docs]].
